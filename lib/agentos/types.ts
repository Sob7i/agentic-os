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
  /**
   * D38/Stage 4b §3.1: the PR base — from `agentos.yml`, default `'develop'` once a project is
   * initialized through it (T2). Migration 4 backfills existing rows to `'develop'` rather than
   * leaving them `NULL`, since D38's base-ref fallback chain ends here and a `NULL` terminus would
   * refuse every dispatch. A row this migration cannot see (created after it, by a caller that
   * still supplies nothing) is the one case this column stays genuinely unset for.
   */
  integrationBranch: string | null;
  /** D38: defaults to `integrationBranch` when unset — never to `HEAD`. Nullable; `null` means
   *  "use the project's `integrationBranch`," not "use `HEAD`." */
  defaultBaseRef: string | null;
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
  /**
   * Stage 4 §3.1: both nullable, set together only by `instantiateTemplate` (T2). A hand-made task
   * has neither — `chainId` names the `Chain` it belongs to, `chainOrd` its 1-based position in it.
   */
  chainId: string | null;
  chainOrd: number | null;
  /** D38/Stage 4b §3.1: overrides both of the project's base-ref columns when set. Nullable — a
   *  hand-made task has none, and the resolution chain falls through to the project's own default. */
  baseRef: string | null;
  createdAt: string;
}

/**
 * Stage 4 §3.1: a named, ordered list of steps. `slug` is the stable key ('compound-engineer-
 * workflow'); `name` is display only ('compound-engineer') — a card renders the name, never the
 * slug, and nothing is keyed on the name (§3.1's "one template, one identifier on screen" rule).
 * `seeded` distinguishes the built-in template from one a project defines later; both live in the
 * same table.
 */
export interface TaskTemplateRow {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  description: string;
  /** Raw JSON text of the variable names this template's prompts bind (e.g. `["branchName"]`); parse at the edge. */
  variablesJson: string;
  seeded: boolean;
  createdAt: string;
}

/**
 * Stage 4 §3.1: one step of a `TaskTemplate`. `assigneeAgentName` is a **name**, not an id — either
 * an agent's name or the reserved literal `human` — because a template is portable across projects
 * and an agent id is not; resolution to `Task.assigneeAgentId` happens at instantiate (T2), never
 * here.
 */
export interface TemplateStepRow {
  id: string;
  templateId: string;
  /** 1-based position in the chain; §3.2 materialises all N steps as cards up front. */
  ord: number;
  name: string;
  /** Raw `{{var}}` text, unbound. Binding happens at instantiate (§3.3), never stored bound here. */
  promptTemplate: string;
  assigneeAgentName: string;
  approvalGate: boolean;
  notes: string | null;
}

/** Stage 4 §3.1: what a `Chain` becomes once every step has run, or the point past which it will not. */
export type ChainStatus = "running" | "halted" | "completed";

/**
 * Stage 4 §3.1: a running instance of a `TaskTemplate`. `templateVersionJson` is the template and
 * its steps **as they were at instantiate**, copied rather than referenced, so a running chain
 * cannot change because someone edited the template underneath it (AC-11) and a halt reason stays
 * meaningful after the template moves on.
 */
export interface ChainRow {
  id: string;
  projectId: string;
  templateId: string;
  /** Raw JSON text: the template + its steps, copied at instantiate. Parse at the edge. */
  templateVersionJson: string;
  /** Raw JSON text: the variables this chain was instantiated with. Parse at the edge. */
  variablesJson: string;
  status: ChainStatus;
  haltedAtTaskId: string | null;
  haltReason: string | null;
  /**
   * Not in spec §3.1's schema block — a T1 build-level addition (`docs/specs/stage-4-tickets.md`
   * T1, raised in review of #33) so T3's advance can claim the next step atomically
   * (`UPDATE Chain SET lastDispatchedOrd = :ord WHERE id = :id AND lastDispatchedOrd < :ord`)
   * instead of reading the chain's tasks then writing, which two racing `done` transitions could
   * both pass.
   */
  lastDispatchedOrd: number;
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
  /**
   * D37/Stage 4b §3.2: `agentos/<slug>-<first 8 of sessionId>`, set at spawn (`createSession`'s
   * caller always supplies it — see `CreateSessionInput`'s own comment). Null only for a session
   * row this migration cannot see: one created before Stage 4b, when a worktree still used
   * `--detach`.
   */
  branchName: string | null;
  /** D39/§3.5: the `prepare:` command's exit code. Never `0` unless it actually ran and passed —
   *  `null` means "no `prepare:` key in `agentos.yml`," a fact distinct from a clean pass. */
  prepareExitCode: number | null;
  /** D39: how long `prepare:` took to run, in milliseconds. Null alongside `prepareExitCode`. */
  prepareMs: number | null;
  /** D40/§3.6: the `verify:` command's exit code, recorded by the runner — never by anything the
   *  session said. `null` means "no `verify:` key," never "passed." A configured `verify:` that
   *  never produced a clean exit (killed by its own timeout, or the executable could not be
   *  spawned) is recorded as `dispatch.ts`'s `VERIFY_DID_NOT_COMPLETE` sentinel (`-1`, never a
   *  real process exit code), not as `null` — collapsing the two would let a check that never ran
   *  clean read as "nothing configured" (T4 finding 2, docs/specs/stage-4b-tickets.md). */
  verifyExitCode: number | null;
  /** D40: the last 40 lines of `verify:`'s combined output. Null alongside `verifyExitCode`. */
  verifyTail: string | null;
  /** D41/§3.8: when the one push-and-open-PR click fired. Null until it does. */
  pushedAtISO: string | null;
  /** D41: the opened PR's URL, stored by the same click that set `pushedAtISO`. */
  prUrl: string | null;
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
