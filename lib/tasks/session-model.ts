import type { AgentRow, DriftAtSpawn, ProjectRow, SessionRow, TaskRow, ToolCallRow } from "@/lib/agentos/types";
import { parseJsonColumn } from "@/lib/agentos/db";
import { pushControlLabel } from "@/lib/agentos/delivery-render";
import { shortSessionId, shortSha } from "./model";

/**
 * The session view (design brief §6.5): "the finished-session view, designed with as much care as
 * the live one — it is the one people will actually use, and it is the evidence D19 requires: tool
 * calls, duration, cost, commits, and the task it served." No live streaming — §7.4: "the UI never
 * holds the run; it reads the same rows on load," so this is a plain server render, refreshed by
 * reloading the page, not a polling client component.
 */

export interface ToolCallModel {
  seq: number;
  name: string;
  /** Parsed at the edge — `db.ts`'s own rule for JSON-bearing columns. */
  input: unknown;
}

export interface SessionViewModel {
  id: string;
  shortId: string;
  status: SessionRow["status"];
  /** True while the session still owns the work — running or waiting on the inbox. */
  live: boolean;
  taskId: string;
  taskName: string;
  agentName: string;
  agentMonogram: string;
  triggerKind: SessionRow["triggerKind"];
  startedAtISO: string;
  /** Null only while `live` — a running session has no end yet. */
  endedAtISO: string | null;
  durationMinutes: number;
  costUsd: number | null;
  commitShas: string[];
  toolCalls: ToolCallModel[];
  failureReason: string | null;
  /** §7.5: a snapshot, rendered in the past tense — this is what was true when the session spawned,
   *  never re-read as current state. */
  driftAtSpawn: DriftAtSpawn;
  /** D37/Stage 4b §3.2: null only for a session that predates Stage 4b (worktree.ts's own
   *  `--detach` era) — never for one dispatched after migration 4. */
  branchName: string | null;
  /** D40/§3.6: null means "no `verify:` key," never "passed." A non-null, non-zero value — real
   *  exit code or `dispatch.ts`'s `VERIFY_DID_NOT_COMPLETE` sentinel alike — is what makes the
   *  push control in §3.8 render its confirm step. */
  verifyExitCode: number | null;
  /** D41/§3.8: set together, by the same click. `prUrl !== null` means the gesture already ran. */
  pushedAtISO: string | null;
  prUrl: string | null;
  /** §3.8: settled + a branch + at least one commit — the three preconditions the push control's
   *  own visibility is gated on (mirrors `pushAndOpenPr`'s own checks in `lib/agentos/push.ts`,
   *  restated here since this module has no `db` to call it with). */
  canPush: boolean;
  /** T3's own label (`pushControlLabel`), pre-rendered here since it is pure and this is already
   *  the one module that turns raw rows into everything the page needs to print. Null when
   *  `canPush` is false — there is nothing to label. */
  pushLabel: string | null;
}

export interface SessionViewInput {
  session: SessionRow;
  task: TaskRow;
  agent: AgentRow;
  /** D38/Stage 4b §3.1: `integrationBranch` is the PR base the push label names — needed here
   *  only for that string, never for anything this view writes. */
  project: Pick<ProjectRow, "integrationBranch">;
  toolCalls: ToolCallRow[];
  commitShas: string[];
  nowMs?: number;
}

export function sessionViewModel(input: SessionViewInput): SessionViewModel {
  const { session } = input;
  const nowMs = input.nowMs ?? Date.now();
  const live = session.status === "running" || session.status === "waiting-inbox";
  const endMs = session.endedAtISO ? new Date(session.endedAtISO).getTime() : nowMs;
  const durationMinutes = Math.max(
    0,
    Math.round((endMs - new Date(session.startedAtISO).getTime()) / 60_000),
  );

  // §3.8: settled (not live) + a branch + at least one commit. Mirrors `pushAndOpenPr`'s own
  // preconditions in `lib/agentos/push.ts` — restated, not imported: that module pulls in `db`
  // and `node:child_process` transitively, which this leaf-ish view model must never reach
  // (`verify:stage3c` AC-1, inherited fact 7).
  const canPush = !live && session.branchName !== null && input.commitShas.length > 0;

  return {
    id: session.id,
    shortId: shortSessionId(session.id),
    status: session.status,
    live,
    taskId: input.task.id,
    taskName: input.task.name,
    agentName: input.agent.name,
    agentMonogram: input.agent.monogram,
    triggerKind: session.triggerKind,
    startedAtISO: session.startedAtISO,
    endedAtISO: session.endedAtISO,
    durationMinutes,
    costUsd: session.costUsd,
    commitShas: input.commitShas,
    toolCalls: input.toolCalls
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((tc) => ({ seq: tc.seq, name: tc.name, input: parseJsonColumn<unknown>(tc.inputJson) })),
    failureReason: session.failureReason,
    driftAtSpawn: parseJsonColumn<DriftAtSpawn>(session.driftAtSpawnJson),
    branchName: session.branchName,
    verifyExitCode: session.verifyExitCode,
    pushedAtISO: session.pushedAtISO,
    prUrl: session.prUrl,
    canPush,
    pushLabel:
      canPush && session.branchName
        ? pushControlLabel(session.branchName, input.project.integrationBranch ?? "develop")
        : null,
  };
}

export { shortSessionId, shortSha };
