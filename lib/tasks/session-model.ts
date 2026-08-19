import type { AgentRow, DriftAtSpawn, SessionRow, TaskRow, ToolCallRow } from "@/lib/agentos/types";
import { parseJsonColumn } from "@/lib/agentos/db";
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
}

export interface SessionViewInput {
  session: SessionRow;
  task: TaskRow;
  agent: AgentRow;
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
  };
}

export { shortSessionId, shortSha };
