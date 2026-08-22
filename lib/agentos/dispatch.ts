/**
 * `dispatch()` and the boot sweep — spec §7 in full, D24.
 *
 * This is the only door to a session (§7.2's "ONE funnel" — AC-14 asserts it structurally). It
 * owns the five preconditions (§7.3), the request/run split (§7.4), the drift snapshot (§7.5),
 * and hands the state machine's legality (§7.6) to `writeTaskTransition` — the one write path
 * every caller, including T4's MCP tool handler, already funnels through (see the note on
 * `assertLegalTransition` in `db.ts`, added here per T1's own comment that this ticket owns it).
 * The boot sweep (§7.7) lives in `sweep.ts`, a sibling file, and is re-exported from here for
 * convenience — nothing else in this file depends on it.
 *
 * **Nothing here scans the `todo` column.** `dispatch(taskId, trigger)` only ever acts on a task
 * id something else already named (§7.1). There is no poller, no worker, no queue.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { CanUseTool, McpServerConfig, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  createSession,
  createToolCall,
  getAgent,
  getDb,
  getProject,
  getSession,
  getTask,
  haltChain,
  listSessionsByProject,
  listSessionsByTask,
  recordCommitShas,
  updateSession,
  writeTaskTransition,
} from "./db";
import type { AgentRow, DriftAtSpawn, ProjectRow, SessionRow, TriggerKind } from "./types";
import {
  createWorktree,
  readWorktreeCommits,
  removeWorktree,
  type Worktree,
} from "./worktree";
import { LocalRunner, composeOptions } from "./runner/local";
import type { Runner } from "./runner/runner";
import { createAgentosServer } from "./mcp/agentos-server";
import { createInboxServer } from "./mcp/inbox-server";
import { createApprovalGate } from "./mcp/gate";
import { AGENTOS_SERVER, INBOX_SERVER } from "./mcp/names";
import type { SessionCtx } from "./mcp/context";
import { boardOnce } from "../reconcile/cached";
import type { ProjectReport } from "../types";
import { run } from "../collectors/exec";

// ---------------------------------------------------------------------------
// The funnel's own surface — §7.2
// ---------------------------------------------------------------------------

/** §7.3's five preconditions, named for `refusedBy` — the order they are checked in. */
export type Precondition = "agentos.yml" | "dispatchable" | "concurrency" | "agent" | "baseRef";

export type DispatchResult =
  | { started: true; sessionId: string }
  | { started: false; refusedBy: Precondition; reason: string };

/**
 * Test seam, mirroring `RunParams` in `runner/runner.ts`. Production callers (T7) call
 * `dispatch(taskId, trigger)` with no third argument — `db` defaults to the process-wide
 * singleton (`getDb()`) and `runner` to a real `LocalRunner`. The suite substitutes a fixture
 * `db` and a `FakeRunner` here rather than dispatch importing either concretely, per §6's build
 * note ("the suite substitutes FakeRunner; dispatch must take its runner injected").
 */
export interface DispatchDeps {
  db?: DatabaseSync;
  runner?: Runner;
  /** Overrides the process boot id — the sweep's own seam (§7.7, §9), reused here so a test can
   *  dispatch and then simulate a restart without a real one. */
  bootId?: string;
  /** Overrides worktree teardown. Exists so AC-9a can drive the one failure path that has no
   *  other way in: `removeWorktree` throws only when `git worktree remove` **and** `git worktree
   *  prune` both fail, which a fixture cannot arrange without corrupting a real repo. */
  removeWorktree?: (wt: Worktree) => Promise<void>;
}

/**
 * Minted once per module load — "a uuid minted once per server process" (§7.7). `sweep.ts` does
 * **not** import this: `runBootSweep(db, currentBootId)` takes the boot id as a parameter, so
 * whoever wires app startup passes this constant in and the two cannot disagree. Keeping the
 * dependency pointed that way is what lets a test sweep against an arbitrary boot id (and what
 * the `bootId` deps hook above overrides) without reaching into module state.
 */
export const PROCESS_BOOT_ID = randomUUID();

function refuse(refusedBy: Precondition, reason: string): DispatchResult {
  return { started: false, refusedBy, reason };
}

// ---------------------------------------------------------------------------
// §7.5 — what a session records about its own premise
// ---------------------------------------------------------------------------

/** Mirrors `lib/reconcile/checks.ts`'s own (unexported) severity ranking — duplicated rather
 *  than imported because it is four literals, not a shared algorithm, and importing an
 *  unexported symbol across the layer boundary is exactly the wrong direction to reach for. */
/**
 * Projects the portfolio layer's `ProjectReport` for this project onto the session-record shape
 * §7.5 wants. **Never returns null** — an in-sync or unverifiable project still gets a record,
 * with that severity named explicitly, because "an absent record and a clean project must not
 * look alike" (AC-17).
 *
 * This is the one call that crosses the layer boundary, and the permitted direction: it reads
 * `lib/reconcile/`'s output via `boardOnce` — never `buildBoard` directly (`verify:stage3a`'s
 * AC-3 asserts that structurally) — and `lib/reconcile/` itself never imports anything from here.
 */
export function driftAtSpawnFromReport(report: ProjectReport | undefined, fallbackISO: string): DriftAtSpawn {
  if (!report) {
    // The project isn't on the Board at all (e.g. no matching `projects.config.ts` entry).
    // Recorded, not thrown — §7.5 says drift is a record, never a rail, and this is the
    // limiting case of "nothing was verifiable."
    return {
      severity: "unverifiable",
      claim: "no reconciliation record for this project",
      verified: "primaryRepoPath matched no entry on the Board",
      source: "lib/reconcile/cached.ts",
      check: "none",
      checkedAtISO: fallbackISO,
    };
  }

  // The check that explains the project's overall severity, if any fired. Empty for an
  // in-sync (or state-doc-less/unverifiable) project — see `overallSeverity` in checks.ts.
  const primary = report.checks.find((c) => c.severity === report.severity) ?? report.checks[0] ?? null;

  if (primary) {
    return {
      severity: primary.severity,
      claim: primary.claimed ?? primary.headline,
      verified: primary.verified ?? primary.headline,
      source: primary.source ?? report.path,
      check: primary.id,
      checkedAtISO: report.checkedAtISO,
    };
  }

  return {
    severity: report.severity,
    claim: "no outstanding claim contradicted by git or GitHub",
    verified: "reconciliation found no discrepancies",
    source: report.docs.stateDocPath ?? report.path,
    check: "none",
    checkedAtISO: report.checkedAtISO,
  };
}

async function computeDriftAtSpawn(project: ProjectRow): Promise<DriftAtSpawn> {
  const board = await boardOnce();
  const report = board.projects.find((p) => p.path === project.primaryRepoPath);
  return driftAtSpawnFromReport(report, board.checkedAtISO);
}

// ---------------------------------------------------------------------------
// dispatch() — §7.2 … §7.5
// ---------------------------------------------------------------------------

export async function dispatch(
  taskId: string,
  trigger: TriggerKind,
  deps: DispatchDeps = {},
): Promise<DispatchResult> {
  const db = deps.db ?? getDb();
  const runner = deps.runner ?? new LocalRunner();
  const bootId = deps.bootId ?? PROCESS_BOOT_ID;

  // Not one of §7.3's five — a taskId that names nothing, or a task whose project row is gone,
  // is a caller bug (the "Run now" control only ever fires on a task it already rendered), not a
  // normal refusal. Throwing here rather than inventing a sixth Precondition keeps that type
  // exhaustive over the cases §7.3 actually names.
  const task = getTask(db, taskId);
  if (!task) throw new Error(`dispatch: no Task ${taskId}`);
  const project = getProject(db, task.projectId);
  if (!project) throw new Error(`dispatch: no Project ${task.projectId} (Task ${taskId})`);

  // ── Precondition 1 — the project has an execution layer ──────────────────────────────────
  if (!existsSync(project.yamlPath)) {
    return refuse("agentos.yml", `project '${project.slug}' has no agentos.yml at ${project.yamlPath}`);
  }

  // ── Precondition 2 — the task is dispatchable ─────────────────────────────────────────────
  if (task.status !== "todo") {
    return refuse("dispatchable", `task ${taskId} is '${task.status}', not 'todo'`);
  }
  const taskSessions = listSessionsByTask(db, taskId);
  const taskLive = taskSessions.find((s) => s.status === "running" || s.status === "waiting-inbox");
  if (taskLive) {
    return refuse(
      "dispatchable",
      `task ${taskId} already has a live session ${taskLive.id} (${taskLive.status})`,
    );
  }

  // ── Precondition 3 — the project is under its concurrency cap ────────────────────────────
  const projectSessions = listSessionsByProject(db, project.id);
  const liveInProject = projectSessions.filter(
    (s) => s.status === "running" || s.status === "waiting-inbox",
  ).length;
  if (liveInProject >= project.maxConcurrentSessions) {
    return refuse(
      "concurrency",
      `project '${project.slug}' is at its concurrency cap (${liveInProject}/${project.maxConcurrentSessions} running)`,
    );
  }

  // ── Precondition 4 — the agent resolves ───────────────────────────────────────────────────
  // A null assignee means human-only (§7.1) — never defaulted here. Defaulting happens once,
  // at task creation, from Project.defaultAgentId.
  if (task.assigneeAgentId === null) {
    return refuse(
      "agent",
      `task ${taskId} has no assignee — this is deliberately human-only work (§7.1), never defaulted at dispatch`,
    );
  }
  const agent = getAgent(db, task.assigneeAgentId);
  if (!agent) {
    return refuse("agent", `assigned agent ${task.assigneeAgentId} does not exist`);
  }
  try {
    // cwd is a placeholder here — composeOptions never inspects it, only stores it on the
    // returned Options object (local.ts). This call exists purely to prove the agent's tool
    // grants compose without throwing, "loudly, rather than silently spawning with default
    // permissions" (§7.3).
    composeOptions({ agent, cwd: project.primaryRepoPath });
  } catch (err) {
    return refuse(
      "agent",
      `agent ${agent.id} could not be composed into SDK options: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Precondition 5 — the base ref resolves ────────────────────────────────────────────────
  // Always the primary repo's current HEAD — the schema has no per-project or per-task branch
  // column (§3.7), and "the primary repo" (§7.3) is the only ref a dispatch can mean without one.
  const BASE_REF = "HEAD";
  const resolvedHead = await run("git", ["rev-parse", BASE_REF], project.primaryRepoPath);
  if (resolvedHead === null) {
    return refuse(
      "baseRef",
      `git rev-parse ${BASE_REF} failed in ${project.primaryRepoPath} — no base to branch the worktree from`,
    );
  }

  // ── All five pass — record the premise, mint the identity, materialize the workspace ─────
  const driftAtSpawn = await computeDriftAtSpawn(project);

  const sessionId = randomUUID();
  // "The session id is the caller's identity to assign" (worktree.ts's own docstring on
  // createWorktree) — minted here so the worktree's directory name and the Session row's
  // primary key are the same value, readable end-to-end from a session id alone.
  const wt = await createWorktree(project.primaryRepoPath, BASE_REF, sessionId);

  const session = createSession(db, {
    id: sessionId,
    taskId,
    agentId: agent.id,
    triggerKind: trigger,
    worktreePath: wt.path,
    baseRef: wt.baseRef, // the resolved sha, never "HEAD" verbatim — see worktree.ts's own trap note
    pid: process.pid,
    bootId,
    driftAtSpawn,
  });

  writeTaskTransition(db, {
    taskId,
    toStatus: "doing",
    actorType: "session",
    actorId: session.id,
    reason: `dispatch (${trigger})`,
  });

  // §7.4: "the run then proceeds in the Next.js Node process" — started here, awaited by
  // nothing. The request returns at the line below; this promise settles on its own time.
  const prompt = `Task: ${task.name}\n\n${task.description}`;
  void runSessionToCompletion({ db, runner, session, agent, taskId, worktree: wt, prompt, removeWt: deps.removeWorktree }).catch((err) => {
    // A last-resort net: runSessionToCompletion already records failure state onto the Session
    // row itself. Reaching here means that bookkeeping threw too, which must not become an
    // unhandled rejection that crashes the process the run is supposed to survive.
    console.error(`dispatch: session ${session.id}'s own completion handling failed`, err);
  });

  return { started: true, sessionId: session.id };
}

// ---------------------------------------------------------------------------
// The run itself — §7.4, §3.3's two MCP servers, §3.4's gate, §3.5's pause/resume
// ---------------------------------------------------------------------------

interface RunSessionParams {
  db: DatabaseSync;
  runner: Runner;
  session: SessionRow;
  agent: AgentRow;
  taskId: string;
  worktree: Worktree;
  prompt: string;
  /** Set only when resuming a paused session (§3.5) — the prior run's `sdkSessionId`. */
  resume?: string;
  /** Injected teardown (`DispatchDeps.removeWorktree`), defaulting to the real one. */
  removeWt?: (wt: Worktree) => Promise<void>;
}

function buildSessionSurface(ctx: SessionCtx): {
  mcpServers: Record<string, McpServerConfig>;
  canUseTool: CanUseTool;
} {
  return {
    mcpServers: {
      [AGENTOS_SERVER]: createAgentosServer(ctx),
      [INBOX_SERVER]: createInboxServer(ctx),
    },
    canUseTool: createApprovalGate(ctx),
  };
}

/**
 * Runs one turn (fresh dispatch or an inbox resume) to settlement and writes back everything
 * §3.7's schema wants recorded: `ToolCall` rows as they happen, then — once the run is no longer
 * live — `costUsd`, commit shas, and a terminal status. Never touches `Task.status`; that is
 * either the agent's own `task_update_status` call (T4) or, on a genuine failure, this
 * function's own `doing -> todo` transition below (§7.6's table).
 */
/**
 * Teardown that cannot strand a session.
 *
 * `removeWorktree` throws when `git worktree remove --force` **and** `git worktree prune` both
 * fail. Awaiting it before the terminal `updateSession` meant a teardown failure left the row
 * saying `running` (or `waiting-inbox`) forever, with no `endedAtISO` and no reason — **a stored
 * claim contradicted by reality, inside the product whose subject is exactly that** (§7.7). The
 * boot sweep would only notice after a restart.
 *
 * So teardown is best-effort and the terminal write always happens. On failure the session
 * **keeps its `worktreePath`**, because the path is the only pointer to a directory that may
 * still exist — nulling it would lose the one thing needed to clean it up later.
 */
async function tearDownBestEffort(
  wt: Worktree,
  remove: (wt: Worktree) => Promise<void>,
): Promise<string | null> {
  try {
    await remove(wt);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function runSessionToCompletion(params: RunSessionParams): Promise<void> {
  const removeWt = params.removeWt ?? removeWorktree;
  const { db, runner, session, agent, taskId, worktree, prompt, resume } = params;
  const ctx: SessionCtx = { db, sessionId: session.id, taskId };
  const { mcpServers, canUseTool } = buildSessionSurface(ctx);

  let seq = 0;
  const onMessage = (message: SDKMessage) => {
    if (message.type !== "assistant") return;
    for (const block of message.message.content) {
      if (block.type === "tool_use" || block.type === "mcp_tool_use") {
        createToolCall(db, { sessionId: session.id, seq: seq++, name: block.name, input: block.input });
      }
    }
  };

  let outcome: { sdkSessionId: string | null; costUsd: number | null } | null = null;
  let runError: Error | null = null;
  try {
    outcome = await runner.run({ agent, cwd: worktree.path, prompt, resume, mcpServers, canUseTool, onMessage });
  } catch (err) {
    // Finding (c), spec §3.1: the result — with a real session id and cost — may already have
    // arrived via onMessage before this throw. This function does not need it from `outcome`
    // (which the throw path never produces); it only needs to know a failure happened.
    runError = err instanceof Error ? err : new Error(String(err));
  }

  // The inbox tool handler (T4) may have flipped status to 'waiting-inbox' mid-run. Re-read
  // rather than trust `session` — it is the only up-to-date source by now.
  const latest = getSession(db, session.id);

  if (latest?.status === "waiting-inbox") {
    // §3.5: the worktree is removed once the paused turn ends, whatever it did or didn't
    // commit — the tool's own description is what tells the agent to commit before asking.
    const teardownError = await tearDownBestEffort(worktree, removeWt);
    updateSession(db, session.id, {
      worktreePath: teardownError ? worktree.path : null,
      sdkSessionId: outcome?.sdkSessionId ?? latest.sdkSessionId,
      costUsd: outcome?.costUsd ?? latest.costUsd,
      failureReason: teardownError ? `worktree teardown failed: ${teardownError}` : latest.failureReason,
    });
    return;
  }

  // Not paused — a genuine completion or a genuine failure. Commits are read BEFORE teardown
  // in both cases (§3.2's trap: nothing survives `worktree remove` but what's already read).
  let commitShas: string[] = [];
  try {
    commitShas = await readWorktreeCommits(worktree);
  } catch {
    // Best-effort: a failed read here must not block teardown from happening at all.
  }
  if (commitShas.length) recordCommitShas(db, session.id, commitShas);
  const teardownError = await tearDownBestEffort(worktree, removeWt);

  // Both facts are recorded, and neither is allowed to hide the other: `status` reports what the
  // *run* did, and a teardown failure is appended to the reason rather than reclassifying a
  // completed run as failed.
  const reasons = [
    runError ? runError.message : null,
    teardownError ? `worktree teardown failed: ${teardownError}` : null,
  ].filter((r): r is string => r !== null);

  updateSession(db, session.id, {
    worktreePath: teardownError ? worktree.path : null,
    sdkSessionId: outcome?.sdkSessionId ?? latest?.sdkSessionId ?? null,
    costUsd: outcome?.costUsd ?? latest?.costUsd ?? null,
    status: runError ? "failed" : "completed",
    endedAtISO: new Date().toISOString(),
    failureReason: reasons.length > 0 ? reasons.join("; ") : null,
  });

  // §7.6: "doing -> todo, system, the session failed or was interrupted; reason recorded." Only
  // on a genuine failure — a clean completion leaves Task.status wherever the agent's own
  // task_update_status calls left it (most often 'review'), which this function must not touch.
  if (runError) {
    const currentTask = getTask(db, taskId);
    if (currentTask && currentTask.status === "doing") {
      writeTaskTransition(db, {
        taskId,
        toStatus: "todo",
        actorType: "system",
        actorId: null,
        reason: `session ${session.id} failed: ${runError.message}`,
      });
    }

    // T3, spec §3.4: a chain step's failure halts the chain rather than retrying — "a chain that
    // retries is a scheduler, and D24 declined to build one." This is the ONE hook this ticket adds
    // to this file, and it lives here rather than beside `advanceChainAfterDone` in `chain.ts`
    // because a `Runner` that throws is handled entirely inside this function (it marks the session
    // `failed` and writes `doing -> todo` above); the failure never passes through `done`, so a hook
    // that only fired after `done` would leave `haltChain` with no production caller at all — the
    // chain would silently stall instead of halting. Read from `currentTask` (fetched above,
    // independent of whatever `Task.status` ends up being) because `chainId` is the only fact this
    // halt needs, and it does not change across a transition.
    if (currentTask?.chainId) {
      haltChain(
        db,
        currentTask.chainId,
        taskId,
        `session ${session.id} failed at step ${currentTask.chainOrd ?? "?"}: ${runError.message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Resuming a paused session — §3.5's flow diagram, second half
// ---------------------------------------------------------------------------

/**
 * Answers an open inbox question and resumes the session that asked it. Not exercised by
 * AC-14…AC-19 (T6's AC-6 owns pause/resume) — built here because §7.4's request/run split and
 * §3.5's pause/resume are one lifecycle, and T7 (UI) has nowhere else to put the call that must
 * exist for the inbox surface to do anything.
 */
export async function resumeSession(
  sessionId: string,
  answer: string,
  deps: DispatchDeps = {},
): Promise<void> {
  const db = deps.db ?? getDb();
  const runner = deps.runner ?? new LocalRunner();

  const session = getSession(db, sessionId);
  if (!session) throw new Error(`resumeSession: no Session ${sessionId}`);
  if (session.status !== "waiting-inbox") {
    throw new Error(`resumeSession: session ${sessionId} is '${session.status}', not 'waiting-inbox'`);
  }
  const task = getTask(db, session.taskId);
  if (!task) throw new Error(`resumeSession: no Task ${session.taskId}`);
  const agent = getAgent(db, session.agentId);
  if (!agent) throw new Error(`resumeSession: no Agent ${session.agentId}`);
  const project = getProject(db, task.projectId);
  if (!project) throw new Error(`resumeSession: no Project ${task.projectId}`);

  // A paused session normally has no worktree — §3.5 removes it when the turn ends. It can still
  // have one if that teardown FAILED, in which case `worktreePath` was deliberately kept as the
  // only pointer to the directory left behind (see `tearDownBestEffort`). Creating the new
  // worktree without clearing it first would collide: `createWorktree` derives the same path from
  // the same session id, so `git worktree add` would fail with a low-level error naming neither
  // the cause nor the fix. Clear it here, and if it still will not go, say so in terms a human can
  // act on. Raised in review of #14 — an interaction created by the teardown fix in the same PR.
  if (session.worktreePath !== null) {
    const stale = await tearDownBestEffort(
      { path: session.worktreePath, repoPath: project.primaryRepoPath, baseRef: session.baseRef },
      deps.removeWorktree ?? removeWorktree,
    );
    if (stale !== null) {
      throw new Error(
        `resumeSession: session ${sessionId} still holds a worktree at ${session.worktreePath} ` +
          `that could not be removed (${stale}). Remove it by hand, then resume again.`,
      );
    }
    updateSession(db, sessionId, { worktreePath: null });
  }

  // A fresh worktree from the SAME base ref (§3.5) — the conversation resumes, the filesystem
  // does not. Uncommitted work from the paused turn is gone; the inbox tool's own description is
  // what told the agent to commit first.
  const wt = await createWorktree(project.primaryRepoPath, session.baseRef, sessionId);
  updateSession(db, sessionId, { status: "running", worktreePath: wt.path });

  const resumed: SessionRow = { ...session, status: "running", worktreePath: wt.path };
  void runSessionToCompletion({
    db,
    runner,
    removeWt: deps.removeWorktree,
    session: resumed,
    agent,
    taskId: task.id,
    worktree: wt,
    prompt: answer,
    resume: session.sdkSessionId ?? undefined,
  }).catch((err) => {
    console.error(`resumeSession: session ${sessionId}'s own completion handling failed`, err);
  });
}

export { runBootSweep } from "./sweep";
