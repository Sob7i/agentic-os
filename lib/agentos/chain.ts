/**
 * Chain instantiate and advance — Stage 4 §3.2, §3.3 (instantiate, T2) and §3.4, §3.5 (advance,
 * T3). `instantiateTemplate` turns one `TaskTemplate` into one `Chain` row plus N `Task` rows, all
 * in `todo`, linked by `chainId`/`chainOrd` — nothing dispatches yet. `advanceChainAfterDone` is
 * what a task reaching `done` calls next, from the three call sites named in
 * docs/specs/stage-4-tickets.md's inherited fact 2 (`moveTaskForSlug` and `approveDoneForSlug` in
 * `app/p/[slug]/[tab]/actions.ts`, and the `done` branch of `task_update_status` in
 * `lib/agentos/mcp/agentos-server.ts`).
 *
 * **All-or-nothing (spec §3.3).** Every check below runs before any row is written: every
 * `{{variable}}` in every step's prompt binds, every non-`human` `assigneeAgentName` resolves to an
 * agent in this project, and the project itself has an execution layer (an `agentos.yml`, mirroring
 * `dispatch.ts`'s own precondition 1) and a primary repo on disk. The first failure, in step order,
 * is the one returned — the reason always names the step and the specific thing that failed, never
 * a generic "instantiate failed." A refusal writes zero rows: no `Chain`, no `Task`.
 *
 * **Advance goes through the funnel, never around it (spec §3.4).** `advanceChainAfterDone` does
 * not itself decide whether to start a session — it looks up the next step, claims it atomically
 * (AC-10), and calls `dispatch(nextTaskId, 'chain')`, exactly the function and the same five
 * preconditions (Stage 3 §7.3) every other caller goes through. A refusal **halts the chain** with
 * that reason rather than retrying (`haltChain`) — a chain that retries is a scheduler, and D24
 * declined to build one. **One exception:** when the next step is deliberately human-only
 * (`assigneeAgentId === null`), a refusal there is not a failure to halt over — spec §3.5 is
 * explicit that "a human-only step ends the chain's automation, not the chain," so that refusal is
 * silent and the chain stays `running`, waiting for a human to close that task by hand (which calls
 * this same function again, same as any other step).
 */
import type { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import {
  claimChainOrd,
  createChain,
  createTask,
  getChain,
  getDb,
  getProject,
  getTask,
  getTemplateBySlug,
  haltChain,
  listAgentsByProject,
  listTasksByChain,
  listTemplateSteps,
  setTaskBlockedReason,
} from "./db";
import { bindPrompt } from "./chain-render";
import { dispatch, type DispatchDeps } from "./dispatch";

export interface InstantiateTemplateInput {
  db: DatabaseSync;
  projectId: string;
  templateSlug: string;
  /** Supplied values, keyed by variable name — e.g. `{ branchName: "feat/x", featureTitle: "X" }`. */
  variables: Record<string, string>;
}

export type InstantiateTemplateResult =
  | { ok: true; chainId: string; taskIds: string[] }
  | { ok: false; reason: string };

/** A snapshot of one step, as copied into `Chain.templateVersionJson` (spec §3.1, decision 6). */
interface TemplateVersionStep {
  ord: number;
  name: string;
  promptTemplate: string;
  assigneeAgentName: string;
  approvalGate: boolean;
  notes: string | null;
}

/** The whole snapshot stored on `Chain.templateVersionJson` — plain data, not a row reference. */
interface TemplateVersion {
  template: { id: string; slug: string; name: string; description: string };
  steps: TemplateVersionStep[];
}

function refuse(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

export function instantiateTemplate(input: InstantiateTemplateInput): InstantiateTemplateResult {
  const { db, projectId, templateSlug, variables } = input;

  const project = getProject(db, projectId);
  if (!project) {
    return refuse(`instantiate refused: no project ${projectId}`);
  }

  // ── §3.3 rule 3 — the project has an execution layer and a primary repo ──────────────────
  // Mirrors dispatch.ts's own precondition 1 (an execution layer is "there is an agentos.yml"),
  // one level earlier: a project with no opt-in file or no repo on disk cannot run a chain any
  // more than it can run a manual dispatch, and instantiate should say so before writing cards
  // nothing can ever run.
  if (!existsSync(project.yamlPath)) {
    return refuse(
      `instantiate refused: project '${project.slug}' has no execution layer — no agentos.yml at ${project.yamlPath}`,
    );
  }
  if (!existsSync(project.primaryRepoPath)) {
    return refuse(
      `instantiate refused: project '${project.slug}' has no primary repo at ${project.primaryRepoPath}`,
    );
  }

  const template = getTemplateBySlug(db, projectId, templateSlug);
  if (!template) {
    return refuse(`instantiate refused: no template '${templateSlug}' in project '${project.slug}'`);
  }

  const steps = listTemplateSteps(db, template.id);
  if (steps.length === 0) {
    return refuse(`instantiate refused: template '${templateSlug}' has no steps`);
  }

  /**
   * **A duplicate agent name refuses the whole instantiate.** Raised in review of #36.
   * `Agent` has no uniqueness constraint on `(projectId, name)`, so building a `Map` keyed on the
   * name silently keeps the last row and binds every step naming it to an arbitrary agent — one
   * with different tool grants, a different model, and a different budget than whoever wrote the
   * template meant. Nothing downstream could detect it: the chain would run, cost money, and look
   * correct.
   *
   * §3.1 makes a template portable by resolving *names* rather than ids, and that portability is
   * exactly what makes an ambiguous name unresolvable rather than merely awkward. So this is the
   * same all-or-nothing refusal as an unbound variable (§3.3): stated, before anything is written.
   * Only names a step actually references are checked — an unrelated duplicate elsewhere in the
   * project is not this template's problem.
   */
  const allAgents = listAgentsByProject(db, projectId);
  const countByName = new Map<string, number>();
  for (const a of allAgents) countByName.set(a.name, (countByName.get(a.name) ?? 0) + 1);
  const agentsByName = new Map(allAgents.map((a) => [a.name, a]));

  // ── Resolve every step before writing anything (§3.3) ─────────────────────────────────────
  const resolved: { ord: number; boundPrompt: string; assigneeAgentId: string | null }[] = [];
  for (const step of steps) {
    const bound = bindPrompt(step.promptTemplate, variables);
    if (!bound.ok) {
      return refuse(
        `instantiate refused at step ${step.ord} ('${step.name}'): unbound variable(s) ${bound.missing.join(", ")}`,
      );
    }

    let assigneeAgentId: string | null;
    if (step.assigneeAgentName === "human") {
      // §3.5: the literal `human` becomes `null` — human-only, never unassigned.
      assigneeAgentId = null;
    } else {
      const duplicates = countByName.get(step.assigneeAgentName) ?? 0;
      if (duplicates > 1) {
        return refuse(
          `instantiate refused at step ${step.ord} ('${step.name}'): assignee '${step.assigneeAgentName}' matches ${duplicates} agents in project '${project.slug}' — rename them so one step names one agent`,
        );
      }
      const agent = agentsByName.get(step.assigneeAgentName);
      if (!agent) {
        return refuse(
          `instantiate refused at step ${step.ord} ('${step.name}'): assignee '${step.assigneeAgentName}' does not match any agent in project '${project.slug}'`,
        );
      }
      assigneeAgentId = agent.id;
    }

    resolved.push({ ord: step.ord, boundPrompt: bound.text, assigneeAgentId });
  }

  // ── Every check passed — snapshot the template, then write ────────────────────────────────
  const templateVersion: TemplateVersion = {
    template: {
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
    },
    steps: steps.map((s) => ({
      ord: s.ord,
      name: s.name,
      promptTemplate: s.promptTemplate,
      assigneeAgentName: s.assigneeAgentName,
      approvalGate: s.approvalGate,
      notes: s.notes,
    })),
  };

  db.exec("BEGIN");
  try {
    const chain = createChain(db, {
      projectId,
      templateId: template.id,
      templateVersion,
      variables,
    });

    const taskIds: string[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const r = resolved[i];
      // Steps 2..N carry a blockedReason naming their predecessor (§3.2, AC-3); the first step
      // carries none — nothing precedes it.
      const predecessor = i > 0 ? steps[i - 1] : null;
      const blockedReason = predecessor
        ? `waiting on step ${predecessor.ord} ('${predecessor.name}')`
        : null;

      const task = createTask(db, {
        projectId,
        name: step.name,
        description: r.boundPrompt,
        approvalGate: step.approvalGate,
        assigneeAgentId: r.assigneeAgentId,
        chainId: chain.id,
        chainOrd: step.ord,
      });
      if (blockedReason) {
        setTaskBlockedReason(db, task.id, blockedReason);
      }
      taskIds.push(task.id);
    }

    db.exec("COMMIT");
    return { ok: true, chainId: chain.id, taskIds };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// advanceChainAfterDone — T3, spec §3.4 / §3.5
// ---------------------------------------------------------------------------

/**
 * Advances a chain after one of its tasks reaches `done`. Called from the three sites that can
 * produce `done` (docs/specs/stage-4-tickets.md, inherited fact 2) — every caller is expected to
 * have already checked `task.chainId !== null` before calling this, since a hand-made task has no
 * chain to advance; this function re-reads the row itself rather than trusting that gate, so an
 * incorrect call site simply finds nothing to do instead of misbehaving.
 *
 * A silent no-op when: the task does not exist, or has no `chainId`/`chainOrd`; its chain is not
 * `running` (already `halted` or `completed` — a halted chain never resumes on its own, §3.4); there
 * is no task at the next `chainOrd` (this was the chain's last step — "nothing dispatches after
 * step 9 because there is no step 10... the absence of a special case, not a special case," spec
 * §3.5); or another caller already claimed this step (AC-10's atomic guard below).
 *
 * `deps` is exactly `dispatch`'s own `DispatchDeps` — this function does not add a seam of its own,
 * it forwards whatever the caller (production or a fixture) already threads through to `dispatch`.
 */
export async function advanceChainAfterDone(taskId: string, deps: DispatchDeps = {}): Promise<void> {
  const db = deps.db ?? getDb();

  const task = getTask(db, taskId);
  if (!task || !task.chainId || task.chainOrd === null) return;

  const chain = getChain(db, task.chainId);
  if (!chain || chain.status !== "running") return;

  const nextOrd = task.chainOrd + 1;
  const next = listTasksByChain(db, task.chainId).find((t) => t.chainOrd === nextOrd);
  if (!next) return; // no step past this one — the chain's automation simply ends here (§3.5)

  // AC-10: claim atomically before doing anything else observable. Zero rows affected means a
  // racing `done` transition (or a re-issued one) already claimed this ord — return without
  // dispatching. This is a compare-and-set on `Chain.lastDispatchedOrd`, never a "does a Session
  // row already exist for the next task" check: that would be a read-then-write two racing callers
  // can both pass, and a Session row cannot be made unique per task anyway (a legitimately
  // re-dispatched failed step has two).
  if (!claimChainOrd(db, task.chainId, nextOrd)) return;

  // The next card stops reading "blocked" the moment its predecessor finishes, regardless of
  // whether the dispatch below succeeds — spec §3.5: a human-only step "becomes an ordinary card
  // waiting for a person" once unblocked, and an automated step that is about to fail is not
  // "still waiting on its predecessor" either. What happens to it next is a dispatch outcome, not a
  // blocked-on-dependency fact.
  setTaskBlockedReason(db, next.id, null);

  /**
   * **A throw is not a refusal, and both have to halt.** Raised in review of #38. `dispatch`
   * returns `{ started: false }` for its five preconditions, but it can also *reject* — worktree
   * creation, the session insert, or the transition write failing. By this line `lastDispatchedOrd`
   * is already claimed and the next card's `blockedReason` is already cleared, so an uncaught
   * rejection would leave a chain that is `running`, shows an unblocked card, has no session, and
   * can never advance again — the claim guarantees no second attempt. That is the silent stall
   * AC-8 exists to prevent, reached by the one path AC-8 did not cover.
   */
  let result: Awaited<ReturnType<typeof dispatch>>;
  try {
    result = await dispatch(next.id, "chain", deps);
  } catch (err) {
    haltChain(
      db,
      task.chainId,
      next.id,
      `chain halted at step ${next.chainOrd} ('${next.name}'): dispatch threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  if (!result.started) {
    // §3.5: a human-only step's assignee is `null` by construction (never defaulted, §7.1), and
    // dispatch's precondition 4 refuses it for exactly that reason. That refusal is the chain
    // working as designed — it "ends the chain's automation, not the chain" — so it must not halt.
    // Any OTHER precondition 4 refusal (an agent that no longer resolves, or fails to compose) is a
    // genuine misconfiguration and should halt like any other refused step.
    const isDeliberateHumanStep = result.refusedBy === "agent" && next.assigneeAgentId === null;
    if (!isDeliberateHumanStep) {
      haltChain(
        db,
        task.chainId,
        next.id,
        `chain halted at step ${next.chainOrd} ('${next.name}'): dispatch refused (${result.refusedBy}) — ${result.reason}`,
      );
    }
  }
}
