/**
 * Row types for the AgentOS execution layer's SQLite store.
 * Spec: docs/specs/stage-3-execution-mvp.spec.md §3.7. Schema + accessors: lib/agentos/db.ts.
 *
 * These mirror the literal columns `db.ts` creates, one interface per table. Columns that hold
 * JSON store it as **text** here, never as a parsed object — "parse at the edge" (the T1 ticket's
 * words) means the caller that actually needs the value parses it, not this file and not `db.ts`.
 * `parseJsonColumn` in `db.ts` exists for exactly that edge.
 *
 * **These were open when T1 was built and are now closed** — the build is what surfaced them, and
 * spec §3.7 was amended on 2026-08-18 rather than left to a later guess:
 * - A session that finishes cleanly is **`completed`**. The spec had named every *failure* state
 *   and no success state, which is invisible while writing a schema and unavoidable while building
 *   against one.
 * - `InboxMessage.kind` is `'question'` — the only kind in this slice — and `.status` is
 *   `'open' | 'answered'`.
 */

/** §7.6: the four columns of the Kanban. `blocked` is a chip on a card, never a fifth value. */
export type TaskStatus = "todo" | "doing" | "review" | "done";

/** §7.6 / §3.7: who moved a Task, on every `TaskEvent` row. */
export type ActorType = "session" | "human" | "system";

/** §3.7: the only inbox kind in this slice. `inbox.send` deliberately does not exist (§5.8). */
export type InboxKind = "question";

/** §3.7: an inbox message is open until the human answers it. */
export type InboxStatus = "open" | "answered";

/**
 * §7.2: what asked for a dispatch. Only `'manual'` is reachable in Stage 3 — the other four are
 * future callers of the same `dispatch()` funnel, not future mechanisms (D24).
 */
export type TriggerKind = "manual" | "chain" | "goal" | "cron" | "webhook";

/**
 * `Session.status`. `'running'`, `'waiting-inbox'`, `'failed'` and `'interrupted'` are named
 * explicitly in the spec (§3.5, §7.4, AC-9, AC-18). `'completed'` is this file's placeholder for
 * the successful-completion case the spec never names — see the module doc comment above.
 */
export type SessionStatus = "running" | "waiting-inbox" | "completed" | "failed" | "interrupted";

export interface ProjectRow {
  id: string;
  slug: string;
  /** D21: `repos[]` arrives with Stage 4 — one repo per project for now. */
  primaryRepoPath: string;
  yamlPath: string;
  /** Null until an `Agent` exists to point at. */
  defaultAgentId: string | null;
  maxConcurrentSessions: number;
  createdAt: string;
}

export interface AgentRow {
  id: string;
  projectId: string;
  name: string;
  monogram: string;
  /** §5 decision 10: `claude-opus-5` for the MVP agent. Not enforced here — a config value. */
  model: string;
  rolePrompt: string;
  /** JSON array of tool name/pattern strings (e.g. `Bash(rm *)`). Raw text; parse at the edge. */
  allowedToolsJson: string;
  /** Same shape as `allowedToolsJson`. */
  disallowedToolsJson: string;
  /** §5 decision 12: seeded `false` per D27. Stored as 0/1; the accessor layer converts. */
  canCommit: boolean;
  maxTurns: number | null;
  maxBudgetUsd: number | null;
}

export interface TaskRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  /** A label on the card (§7.6), not a fifth status value. Null when nothing is blocking it. */
  blockedReason: string | null;
  approvalGate: boolean;
  /** Null means human-only (§7.1) — never defaulted at dispatch time, only at task creation. */
  assigneeAgentId: string | null;
  /** `'manual'` is the only reachable value in Stage 3. */
  scheduleKind: string;
  createdAt: string;
}

export interface TaskEventRow {
  id: string;
  taskId: string;
  /** Never `from` / `to` — both are SQL reserved words. Caught in review; do not "simplify" back. */
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  actorType: ActorType;
  /** A session id, a human's identifier, or null for a system-authored sweep event. */
  actorId: string | null;
  reason: string | null;
  atISO: string;
}

/**
 * §7.5: what the project's portfolio-layer reconciler claimed at the moment a session spawned.
 * Stored as `Session.driftAtSpawnJson`. Crosses the layer boundary in the permitted direction —
 * execution reads the portfolio, never the reverse (D19).
 */
export interface DriftAtSpawn {
  severity: "drift" | "attention" | "in-sync" | "unverifiable";
  claim: string;
  verified: string;
  source: string;
  check: string;
  checkedAtISO: string;
}

export interface SessionRow {
  id: string;
  taskId: string;
  agentId: string;
  /** Null until the SDK's init message arrives; set by a later `updateSession` call. */
  sdkSessionId: string | null;
  status: SessionStatus;
  triggerKind: TriggerKind;
  /** Null once torn down (AC-2, AC-9) — a live session always has one. */
  worktreePath: string | null;
  baseRef: string;
  costUsd: number | null;
  pid: number;
  /** Minted once per server process (§7.7). A stale `bootId` marks a session dead on boot. */
  bootId: string;
  /** Raw JSON text of a `DriftAtSpawn`; parse at the edge. Never null — AC-17 records in-sync too. */
  driftAtSpawnJson: string;
  startedAtISO: string;
  endedAtISO: string | null;
  failureReason: string | null;
}

export interface ToolCallRow {
  id: string;
  sessionId: string;
  /** Ordering within a session (AC-3). */
  seq: number;
  name: string;
  /** Raw JSON text of the tool's input; parse at the edge. */
  inputJson: string;
  atISO: string;
}

export interface InboxMessageRow {
  id: string;
  sessionId: string;
  taskId: string;
  /** §3.7: `'question'` is the only kind in Stage 3. */
  kind: InboxKind;
  body: string;
  /** Raw JSON text of offered choices, if any; parse at the edge. Null for a free-text ask. */
  choicesJson: string | null;
  answer: string | null;
  /** §3.7: `'open'` until the human answers. */
  status: InboxStatus;
  askedAtISO: string;
  answeredAtISO: string | null;
}

/** No `id` column in the spec's own schema block — the primary key is the pair. */
export interface CommitShaRow {
  sessionId: string;
  sha: string;
}
