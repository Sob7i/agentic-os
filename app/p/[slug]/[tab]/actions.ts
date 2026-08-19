"use server";

import type { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import {
  answerInboxMessage,
  createProject,
  getDb,
  getInboxMessage,
  getSession,
  getTask,
  listProjects,
  parseJsonColumn,
  writeTaskTransition,
} from "@/lib/agentos/db";
import { dispatch, resumeSession } from "@/lib/agentos/dispatch";
import { parseAgentosYml } from "@/lib/agentos/config";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav } from "@/lib/shell/model";
import { loadProjectExecutionData } from "@/lib/tasks/data";

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
  } catch {
    return {
      ok: false,
      alreadyInitialized: false,
      reason: `no agentos.yml found at ${yamlPath} — this project has not opted in to the execution layer`,
    };
  }

  const parsed = parseAgentosYml(text);
  if (!parsed.ok) {
    return { ok: false, alreadyInitialized: false, reason: `agentos.yml is malformed: ${parsed.error}` };
  }

  const db = deps.db ?? getDb();

  // Idempotent (AC-3): a second click reports the existing row rather than colliding with
  // `Project.slug`'s UNIQUE constraint or minting a duplicate for the same repo.
  const existing = listProjects(db).find((p) => p.primaryRepoPath === nav.project.path);
  if (existing) {
    return { ok: true, alreadyInitialized: true, reason: "already initialized" };
  }

  createProject(db, {
    slug: parsed.slug ?? slug,
    primaryRepoPath: nav.project.path,
    yamlPath,
    maxConcurrentSessions: parsed.maxConcurrentSessions,
  });

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
async function resolveOwnedTask(slug: string, taskId: string) {
  const nav = await resolveNav(slug);
  if (!nav) return null;
  const data = loadProjectExecutionData(nav.project.path);
  if (!data) return null;
  const task = getTask(getDb(), taskId);
  if (!task || task.projectId !== data.project.id) return null;
  return { task, project: data.project };
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

export async function approveDoneAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!taskId || !slug) return;
  const owned = await resolveOwnedTask(slug, taskId);
  if (!owned) {
    console.error(`approveDoneAction: refused — task ${taskId} does not belong to project '${slug}'`);
    return;
  }
  const db = getDb();
  // §7.6: "any -> any, human, ... recorded as hand-moved." No gate check here — the gate exists
  // to stop a *session*, never a human; a human clicking this button is the approval itself.
  writeTaskTransition(db, {
    taskId,
    toStatus: "done",
    actorType: "human",
    actorId: HUMAN_ACTOR_ID,
    reason: "approved by owner",
  });
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
