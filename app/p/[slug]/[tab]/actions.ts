"use server";

import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { dropVerdict, handMoveReason } from "@/lib/tasks/dnd";
import { normalizeBaseRefInput } from "@/lib/tasks/baseref";
import { gateModelFor } from "@/lib/tasks/model";
import {
  answerInboxMessage,
  createProject,
  createTask,
  getDb,
  getInboxMessage,
  getSession,
  getTask,
  listProjects,
  listTemplatesByProject,
  parseJsonColumn,
  writeTaskTransition,
} from "@/lib/agentos/db";
import { dispatch, resumeSession } from "@/lib/agentos/dispatch";
import type { Runner } from "@/lib/agentos/runner/runner";
import { advanceChainAfterDone, instantiateTemplate } from "@/lib/agentos/chain";
import { parseAgentosYml } from "@/lib/agentos/config";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav } from "@/lib/shell/model";
import { loadProjectExecutionData } from "@/lib/tasks/data";
import { seedBuiltInTemplates } from "@/lib/agentos/templates/seed";

/**
 * Server actions for the Tasks board and the Inbox — the thin, non-pure edge that calls the real
 * funnel T5 already built and T6 already tested. Nothing here decides anything; each function does
 * exactly one write and revalidates the page that rendered the form.
 *
 * `slug` travels as a hidden form field, not a bound argument — the same convention
 * `app/actions.ts` (the Board's own approval gate) already established, so a form here reads the
 * same way every other form in this codebase does.
 *
 * §2's behaviour rows this closes: "Creates a task and runs it now" (`runNowAction` → `dispatch`),
 * "Accepts the same transition from the human" (`approveDoneAction` → `writeTaskTransition`), and
 * "Resumes with the answer in context" (`answerInboxAction` → `resumeSession`).
 */

/** The only human identity this slice has — matches the fixture convention `verify-stage3.mts`
 *  already established (`actorId: "owner"`). A real multi-user identity is out of scope here. */
const HUMAN_ACTOR_ID = "owner";

/**
 * The one place in this file that reads the board. `verify:stage3a`'s AC-3 asserts at most one
 * `boardOnce` call site per module ("every surface reads through boardOnce, at most once per
 * module"); every action below that needs the board resolves through this function instead of
 * reading the board itself.
 */
async function resolveNav(slug: string) {
  const board = await boardOnce();
  return projectNav(board, slug);
}

/** What the Initialize button, and `scripts/verify-stage3b.mts`, both read back. */
export interface InitializeResult {
  ok: boolean;
  /** True only for the idempotent no-op path (AC-3) — `ok` is also true there. */
  alreadyInitialized: boolean;
  /** The stated reason: why it refused, or why it was a no-op. Null on a fresh success. */
  reason: string | null;
}

/**
 * The connector's testable core (T1: docs/specs/stage-3b-tickets.md, spec §5.1/D30).
 *
 * Resolves the board project **from the slug, server-side** (never a path the browser supplied —
 * same posture as `resolveOwnedTask` below), reads `agentos.yml` from the Board's own path for
 * that project, and writes a `Project` row with `primaryRepoPath` set to that same path — never
 * from the file and never from a form field (spec §3.2: the Board slug and `Project.slug` are two
 * independently-typed strings with no shared source of truth; the repo path is the one fact both
 * records derive from the same place).
 *
 * Split from `initializeProjectAction` below so it can be called directly, with an injected `db`,
 * from `scripts/verify-stage3b.mts` — `revalidatePath` throws when called outside a real Next.js
 * request (`Invariant: static generation store missing`, confirmed empirically), so the bound
 * action is the only thing here that touches it. `boardOnce` itself is not an injectable seam
 * (spec §7's seam table lists only `Runner` and the fixture repo); the suite substitutes a
 * fixture project by splicing `projects.config.ts`'s `PROJECTS`, the same trick
 * `verify-stage3.mts`'s `withOnlyProject` already established for `dispatch()`'s own drift read.
 */
export async function initializeProject(
  slug: string,
  deps: { db?: DatabaseSync } = {},
): Promise<InitializeResult> {
  const nav = await resolveNav(slug);
  if (!nav) {
    return { ok: false, alreadyInitialized: false, reason: `no such project '${slug}'` };
  }

  const yamlPath = join(nav.project.path, "agentos.yml");
  let text: string;
  try {
    text = readFileSync(yamlPath, "utf8");
  } catch (err) {
    // Only a genuinely absent file means "has not opted in". A permission error or an I/O
    // failure is a different fact, and reporting it as opt-out would be this dashboard asserting
    // something it did not check — invariant 2, inside the product built to enforce it. Review of
    // #20 found the original `catch {}` flattened every read failure into the same sentence.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return {
        ok: false,
        alreadyInitialized: false,
        reason: `no agentos.yml found at ${yamlPath} — this project has not opted in to the execution layer`,
      };
    }
    return {
      ok: false,
      alreadyInitialized: false,
      reason: `agentos.yml at ${yamlPath} could not be read (${code ?? "unknown error"}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const parsed = parseAgentosYml(text);
  if (!parsed.ok) {
    return { ok: false, alreadyInitialized: false, reason: `agentos.yml is malformed: ${parsed.error}` };
  }

  const db = deps.db ?? getDb();

  // Idempotent (AC-3): a second click reports the existing row rather than colliding with
  // `Project.slug`'s UNIQUE constraint or minting a duplicate for the same repo. Stage 4: also
  // seed here, on the replay path — a project that opted in before Stage 4 shipped only ever hits
  // this branch, and it still needs the built-in template seeded exactly once
  // (`lib/agentos/templates/seed.ts`'s own idempotency guard).
  const existing = listProjects(db).find((p) => p.primaryRepoPath === nav.project.path);
  if (existing) {
    seedBuiltInTemplates(db, existing.id);
    return { ok: true, alreadyInitialized: true, reason: "already initialized" };
  }

  // `Project.slug` is UNIQUE, and the idempotency check above is keyed on `primaryRepoPath` —
  // deliberately, since that is the one fact the Board and this row derive from the same place
  // (§3.2). The two are therefore not the same guard: a *different* repo whose `agentos.yml`
  // declares a slug already taken passes the check above and then violates the constraint. Left
  // uncaught that is a 500, which bypasses the whole point of D30's button — that a refusal is
  // stated on the screen. Review of #20.
  try {
    const project = createProject(db, {
      slug: parsed.slug ?? slug,
      primaryRepoPath: nav.project.path,
      yamlPath,
      maxConcurrentSessions: parsed.maxConcurrentSessions,
      // D38/Stage 4b §3.1: a project onboarded through this button always supplies a real value —
      // `parsed.integrationBranch` defaults to 'develop' inside the parser itself, never to
      // 'HEAD'. Omitting these two here is exactly the compatibility shim `createProject`'s own
      // doc comment describes, and it must never apply to a project created through this path.
      integrationBranch: parsed.integrationBranch,
      defaultBaseRef: parsed.defaultBaseRef,
    });
    // Stage 4: the built-in template ships with every project from the moment it exists.
    seedBuiltInTemplates(db, project.id);
  } catch (err) {
    return {
      ok: false,
      alreadyInitialized: false,
      reason: `could not create the project row: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true, alreadyInitialized: false, reason: null };
}

/**
 * The bound server action `useActionState` calls from the *not initialized* pane's Initialize
 * button (spec §5.1/D30 — an explicit click, never automatic). `slug` travels as a hidden form
 * field, the same convention every other action in this file uses.
 */
export async function initializeProjectAction(
  _prevState: InitializeResult,
  formData: FormData,
): Promise<InitializeResult> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { ok: false, alreadyInitialized: false, reason: "missing project slug" };
  const result = await initializeProject(slug);
  revalidatePath(`/p/${slug}/tasks`);
  return result;
}

/**
 * Resolve the execution-layer project **from the slug, server-side**, and confirm the id the form
 * supplied actually belongs to it.
 *
 * Spec §6 said this in advance — *"the `app/actions.ts` pattern where the server rebuilds the
 * request rather than trusting the browser; the reason the browser never names a path in Stage 2
 * applies unchanged to a task id"* — and T7 shipped without it. A crafted form post carrying any
 * `taskId` would dispatch or close a task in **a different project** (review of #17).
 *
 * Returns null when the pair does not check out; every caller treats null as "do nothing".
 */
async function resolveOwnedTask(slug: string, taskId: string, dbOverride?: DatabaseSync) {
  const nav = await resolveNav(slug);
  if (!nav) return null;
  // `dbOverride` must reach BOTH reads or the guard is tested against the wrong store. Until T3
  // this helper called `loadProjectExecutionData` with no override and `getDb()` directly, so a
  // suite passing `{ db }` to an action that reuses it would have exercised the real
  // `data/agentos.sqlite` instead of its crafted fixture — a hostile check that never touches the
  // hostile data reports green and proves nothing (review of #27).
  const data = loadProjectExecutionData(nav.project.path, dbOverride);
  if (!data) return null;
  const task = getTask(dbOverride ?? getDb(), taskId);
  if (!task || task.projectId !== data.project.id) return null;
  return { task, project: data.project };
}

/**
 * The create-task form's testable core (T3, docs/specs/stage-3b-tickets.md). Injectable `db` for
 * `scripts/verify-stage3b.mts`, the same split `initializeProject` and `createAgentForSlug`
 * already established.
 *
 * Resolves the execution-layer project **from the slug, server-side** — never a path or id the
 * browser supplied — and confirms a submitted assignee id actually belongs to this project before
 * it ever reaches `createTask`. Without that check a crafted form post could bind a task to an
 * agent in a *different* project (`resolveOwnedTask`'s own comment above explains why this
 * posture exists in this file; T2's `updateAgentForSlug` needed the identical guard and review
 * found it missing — AC-8b there, the same shape here).
 *
 * `""` on the `assigneeAgentId` field means **deliberately human-only** (spec §7.1 of the Stage 3
 * spec), never "unassigned" — resolved to `null` and passed straight to `createTask`, which does
 * not default it from `Project.defaultAgentId` and must not start.
 */
export interface CreateTaskResult {
  ok: boolean;
  reason: string | null;
  taskId: string | null;
}

const EMPTY_TASK_RESULT: CreateTaskResult = { ok: false, reason: null, taskId: null };

async function resolveExecutionProject(slug: string, db: DatabaseSync) {
  const nav = await resolveNav(slug);
  if (!nav) return null;
  return loadProjectExecutionData(nav.project.path, db);
}

export async function createTaskForSlug(
  slug: string,
  formData: FormData,
  deps: { db?: DatabaseSync } = {},
): Promise<CreateTaskResult> {
  const db = deps.db ?? getDb();
  const data = await resolveExecutionProject(slug, db);
  if (!data) {
    return { ...EMPTY_TASK_RESULT, reason: `no such project '${slug}', or it has not been initialized` };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ...EMPTY_TASK_RESULT, reason: "title is required" };
  const description = String(formData.get("description") ?? "").trim();
  const approvalGate = formData.get("approvalGate") === "on";

  // "" is the select's own "human-only" option value — resolved to null, never to a guess.
  const rawAssignee = String(formData.get("assigneeAgentId") ?? "");
  let assigneeAgentId: string | null = null;
  if (rawAssignee !== "") {
    if (!data.agentsById.has(rawAssignee)) {
      return {
        ...EMPTY_TASK_RESULT,
        reason: `agent ${rawAssignee} does not belong to project '${slug}'`,
      };
    }
    assigneeAgentId = rawAssignee;
  }

  // D38/Stage 4b §3.1: blank or whitespace-only means "use the project's default" — null, never
  // "". The normalisation is a pure function in lib/ (`normalizeBaseRefInput`) rather than an
  // inline ternary here, so the suite asserts it directly.
  const baseRef = normalizeBaseRefInput(String(formData.get("baseRef") ?? ""));

  const task = createTask(db, {
    projectId: data.project.id,
    name,
    description,
    approvalGate,
    assigneeAgentId,
    baseRef,
  });

  return { ok: true, reason: null, taskId: task.id };
}

export async function createTaskAction(
  _prevState: CreateTaskResult,
  formData: FormData,
): Promise<CreateTaskResult> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { ...EMPTY_TASK_RESULT, reason: "missing project slug" };
  const result = await createTaskForSlug(slug, formData);
  revalidatePath(`/p/${slug}/tasks`);
  return result;
}

/**
 * The instantiate form's testable core (T4, docs/specs/stage-4-tickets.md, spec §5.8: "on the
 * Tasks board beside `+ Task`, not in setup — a template is setup, instantiating one is work").
 * Injectable `db`, the same split every action in this file already uses.
 *
 * **Ownership check** (the AC-8b/AC-6b shape, `docs/specs/stage-4-tickets.md`'s "standing
 * constraints"): the submitted `templateSlug` must belong to *this* project, confirmed by looking
 * it up in `listTemplatesByProject(db, data.project.id)` rather than trusting the form — the same
 * posture `createTaskForSlug`'s `assigneeAgentId` check above already takes, and for the same
 * reason: a crafted post naming another project's template slug must not instantiate it here.
 *
 * Every `variable_<name>` field the form submits is read as a plain string — `""` for a field the
 * human left blank — and handed to `instantiateTemplate` unchanged. `chain-render.ts`'s
 * `bindPrompt` (Stage 4, T4 Step 3) is what refuses that `""`, not this function: refusing here too
 * would just be a second, divergent copy of the same rule.
 */
export interface InstantiateResult {
  ok: boolean;
  reason: string | null;
  chainId: string | null;
}

const EMPTY_INSTANTIATE_RESULT: InstantiateResult = { ok: false, reason: null, chainId: null };

export async function instantiateTemplateForSlug(
  slug: string,
  formData: FormData,
  deps: { db?: DatabaseSync } = {},
): Promise<InstantiateResult> {
  const db = deps.db ?? getDb();
  const data = await resolveExecutionProject(slug, db);
  if (!data) {
    return { ...EMPTY_INSTANTIATE_RESULT, reason: `no such project '${slug}', or it has not been initialized` };
  }

  const templateSlug = String(formData.get("templateSlug") ?? "");
  if (!templateSlug) return { ...EMPTY_INSTANTIATE_RESULT, reason: "no template selected" };

  const template = listTemplatesByProject(db, data.project.id).find((t) => t.slug === templateSlug);
  if (!template) {
    return {
      ...EMPTY_INSTANTIATE_RESULT,
      reason: `template '${templateSlug}' does not belong to project '${slug}'`,
    };
  }

  const variableNames = parseJsonColumn<string[]>(template.variablesJson);
  const variables: Record<string, string> = {};
  for (const name of variableNames) {
    variables[name] = String(formData.get(`variable_${name}`) ?? "");
  }

  const result = instantiateTemplate({
    db,
    projectId: data.project.id,
    templateSlug,
    variables,
  });
  if (!result.ok) return { ok: false, reason: result.reason, chainId: null };
  return { ok: true, reason: null, chainId: result.chainId };
}

export async function instantiateTemplateAction(
  _prevState: InstantiateResult,
  formData: FormData,
): Promise<InstantiateResult> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { ...EMPTY_INSTANTIATE_RESULT, reason: "missing project slug" };
  const result = await instantiateTemplateForSlug(slug, formData);
  revalidatePath(`/p/${slug}/tasks`);
  return result;
}

/**
 * The drag path's testable core (T3, D33). Injectable `db`, the split every action in this file
 * already uses.
 *
 * **The refusal has to happen here.** §3.2: `assertLegalTransition` returns early for `human`, so
 * `LEGAL_TRANSITIONS` constrains sessions and the system and nothing else — there is no layer
 * beneath this one that would reject an illegal human move. A UI-only check would be bypassable by
 * any crafted post, which is what AC-13 sends.
 *
 * Three refusals, in order, and none of them writes: an unowned task (`resolveOwnedTask`, the same
 * guard `runNowAction` and `approveDoneAction` use — never a fourth copy), then `dropVerdict`,
 * which covers an unknown destination, a same-column no-op, and a gated card.
 *
 * **It does not dispatch.** `Run now` remains the only path into `dispatch()` (D24) — a card
 * dragged to `doing` means "I am working on this", and carries no evidence line because nothing
 * has happened. AC-15 asserts the invocation, not the absence of a session row: dispatch itself
 * only accepts `todo`, so a wrong implementation that moves the task *then* dispatches would be
 * refused by dispatch and leave zero sessions behind, passing a row-count check while the guard
 * was gone.
 */
export interface MoveTaskResult {
  ok: boolean;
  reason: string | null;
}

export async function moveTaskForSlug(
  slug: string,
  taskId: string,
  to: string,
  deps: { db?: DatabaseSync; runner?: Runner } = {},
): Promise<MoveTaskResult> {
  const owned = await resolveOwnedTask(slug, taskId, deps.db);
  if (!owned) return { ok: false, reason: `task ${taskId} is not in project '${slug}'` };

  const gate = gateModelFor(owned.task);
  const verdict = dropVerdict(
    {
      taskId: owned.task.id,
      from: owned.task.status,
      gate: gate ? { humanRefusalReason: gate.humanRefusalReason } : null,
      // Read from the owned row, never from the request — the browser does not get to say
      // whether a card is blocked (review of #38).
      blockedReason: owned.task.blockedReason,
    },
    to,
  );
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const db = deps.db ?? getDb();
  writeTaskTransition(db, {
    taskId: owned.task.id,
    toStatus: verdict.to,
    actorType: "human",
    actorId: HUMAN_ACTOR_ID,
    reason: handMoveReason(verdict.from, verdict.to),
  });

  // T3, spec §3.4: a hand-dragged card that lands on 'done' advances its chain exactly like any
  // other route to 'done' — only ungated chain steps ever reach this branch, since `dropVerdict`
  // already refuses a gated card's drop onto 'done' above (§3.4's gate is layer 2 there too).
  if (verdict.to === "done" && owned.task.chainId) {
    await advanceChainAfterDone(owned.task.id, { db, runner: deps.runner });
  }

  return { ok: true, reason: null };
}

/**
 * The form-boundary half of the move: read three fields, refuse an incomplete request, delegate.
 *
 * **The empty-field guard is not defensive decoration** (raised in review of #30). Without it an
 * empty `slug` revalidated the literal path `/p//tasks` — a route that does not exist, so the
 * revalidation is silently wasted — and the refusal read `task  is not in project ''`, a sentence
 * that describes a missing field as a missing task. `runNowAction` and `approveDoneAction` below
 * both already refuse this way; this action was the one that did not, and a server action is
 * reachable by any POST, not only by the board that renders it.
 *
 * The reason is worded for a person because `DragBoard` renders it verbatim (D36) — a drag that
 * lost its own task id is a bug in this page, and saying so beats naming an empty string.
 */
export async function moveTaskAction(formData: FormData): Promise<MoveTaskResult> {
  const slug = String(formData.get("slug") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!slug || !taskId || !to) {
    return { ok: false, reason: "the move request was incomplete — nothing was changed" };
  }
  const result = await moveTaskForSlug(slug, taskId, to);
  revalidatePath(`/p/${slug}/tasks`);
  return result;
}

export async function runNowAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!taskId || !slug) return;
  const owned = await resolveOwnedTask(slug, taskId);
  if (!owned) {
    console.error(`runNowAction: refused — task ${taskId} does not belong to project '${slug}'`);
    return;
  }
  const result = await dispatch(taskId, "manual");
  if (!result.started) {
    // §7.3: "a refused dispatch is over; nothing is remembered and nothing retries." There is no
    // toast/banner surface in this slice to carry `result.reason` to — logged so the refusal is at
    // least visible somewhere, and the page re-renders showing the task exactly where it was.
    console.error(`runNowAction: dispatch refused (${result.refusedBy}): ${result.reason}`);
  }
  revalidatePath(`/p/${slug}/tasks`);
}

/**
 * The approve button's testable core (T3, docs/specs/stage-4-tickets.md), split out from
 * `approveDoneAction` the same way `moveTaskForSlug`/`moveTaskAction` already split — an injectable
 * `db` and `runner` for `scripts/verify-stage4.mts`, never reachable from the form itself.
 */
export interface ApproveDoneResult {
  ok: boolean;
  reason: string | null;
}

export async function approveDoneForSlug(
  slug: string,
  taskId: string,
  deps: { db?: DatabaseSync; runner?: Runner } = {},
): Promise<ApproveDoneResult> {
  const db = deps.db ?? getDb();
  const owned = await resolveOwnedTask(slug, taskId, db);
  if (!owned) return { ok: false, reason: `task ${taskId} is not in project '${slug}'` };

  /**
   * **The action re-derives what it is approving; it never trusts that the UI only offered it.**
   * Raised in review of #38. This is a server action, so it is reachable by a crafted POST naming
   * any task id in the project — and `writeTaskTransition` deliberately exempts `human` from
   * `LEGAL_TRANSITIONS` (`db.ts`), so `any -> done` is permitted at the data layer by design. The
   * combination meant a request could close a **blocked** chain step sitting in `todo` and, through
   * T3's hook, dispatch its successor — running step 6 before step 5 had ever started.
   *
   * The gate check that was absent here is not the session gate. §7.6 and D36 are both right that
   * "the gate exists to stop a session, never a human" — a human clicking this *is* the approval.
   * What has to be checked is that there is something to approve: the card is in `review` and
   * carries `approvalGate`. That is the shape Stage 2 established for the fix-proposal button —
   * the server rebuilds the proposal from its own state rather than accepting what the browser
   * sends — and it is the same reasoning one layer up.
   */
  if (owned.task.status !== "review" || !owned.task.approvalGate) {
    return {
      ok: false,
      reason:
        `task ${taskId} is '${owned.task.status}'` +
        (owned.task.approvalGate ? "" : " and carries no approval gate") +
        ` — "approve & mark done" closes a gated card awaiting review, and this is not one`,
    };
  }

  writeTaskTransition(db, {
    taskId,
    toStatus: "done",
    actorType: "human",
    actorId: HUMAN_ACTOR_ID,
    reason: "approved by owner",
  });

  // T3, spec §3.4: this is the button a human uses to close a *gated* chain step (a drag straight
  // to 'done' is refused for one — `moveTaskForSlug` above), so it is the primary path by which a
  // gated step's chain actually advances.
  if (owned.task.chainId) {
    await advanceChainAfterDone(taskId, { db, runner: deps.runner });
  }

  return { ok: true, reason: null };
}

export async function approveDoneAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!taskId || !slug) return;
  const result = await approveDoneForSlug(slug, taskId);
  if (!result.ok) {
    console.error(`approveDoneAction: refused — ${result.reason}`);
  }
  revalidatePath(`/p/${slug}/tasks`);
}

export async function answerInboxAction(formData: FormData): Promise<void> {
  const messageId = String(formData.get("messageId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!messageId || !sessionId || !answer || !slug) return;
  const db = getDb();

  // Same ownership check, one hop further: the message must belong to the named session, and that
  // session's task must belong to this project. Without it a crafted post could answer — and
  // resume — a session in someone else's project (review of #17).
  const message = getInboxMessage(db, messageId);
  const session = getSession(db, sessionId);
  if (!message || !session || message.sessionId !== sessionId) return;
  const owned = await resolveOwnedTask(slug, session.taskId);
  if (!owned) {
    console.error(`answerInboxAction: refused — session ${sessionId} does not belong to project '${slug}'`);
    return;
  }

  // When the question offered choices, the answer must be one of them. The UI renders buttons, so
  // a value outside that set can only have been crafted — and it goes straight into the agent's
  // next turn, which makes it the one field on this page an attacker would actually want to
  // control. A free-text question (no `choicesJson`) accepts anything by design (review of #17).
  const choices = parseJsonColumn<string[] | null>(message.choicesJson ?? "null");
  if (Array.isArray(choices) && choices.length > 0 && !choices.includes(answer)) {
    console.error(
      `answerInboxAction: refused — answer was not one of the ${choices.length} offered choices`,
    );
    return;
  }

  // Resume FIRST, mark answered second. The old order marked the message answered and then called
  // `resumeSession`, so a throw there — a stale worktree that will not clear, a missing agent —
  // left an `answered` message whose session never resumed: an inbox item that looks handled and
  // is not. The reverse order can at worst resume twice, which `dispatch`'s own preconditions
  // already refuse; it cannot strand a question (review of #17).
  await resumeSession(sessionId, answer);
  answerInboxMessage(db, messageId, answer, "answered");
  revalidatePath(`/p/${slug}/inbox`);
}
