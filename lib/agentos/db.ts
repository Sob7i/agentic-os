/**
 * SQLite schema and data layer for the AgentOS execution layer.
 * Spec: docs/specs/stage-3-execution-mvp.spec.md §3.7 (schema), §5 decision 4 (why a separate
 * file from D3's transcript cache), §6.1 (build order). Ticket: docs/specs/stage-3-tickets.md T1.
 *
 * No ORM — plain SQL, one file. Driver: Node's own built-in `node:sqlite` (`DatabaseSync`),
 * available unflagged on the Node version this repo runs (v23.11.0; stable since Node 22.13/23.4).
 * It ships in Node itself, so this adds no dependency and needs no native build step — see the T1
 * report for the fuller reasoning. `@types/node` already carries its types.
 *
 * This is **not** D3's transcript cache. Different file (`data/agentos.sqlite` vs. the cache's own
 * home in Stage 7), different lifetime: the cache is derived and disposable, this is the execution
 * layer's record of what actually ran, and losing it loses evidence (§5 decision 4).
 *
 * `lib/reconcile/` must never import this module (D19, `docs/specs/stage-3-tickets.md`
 * "Standing constraints"). The reverse direction — this layer reading the portfolio's checks — is
 * permitted and is what §7.5's `driftAtSpawnJson` does, one layer up in `dispatch.ts` (T5).
 */

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type {
  ProjectRow,
  AgentRow,
  TaskRow,
  TaskEventRow,
  SessionRow,
  ToolCallRow,
  InboxMessageRow,
  CommitShaRow,
  InboxKind,
  InboxStatus,
  TaskStatus,
  ActorType,
  TriggerKind,
  DriftAtSpawn,
} from "./types";

/** Gitignored — see `.gitignore`'s `data/` entry. Losing this file loses session evidence. */
export const DEFAULT_DB_PATH = "data/agentos.sqlite";

// ---------------------------------------------------------------------------
// Schema + migrations
// ---------------------------------------------------------------------------

/**
 * Nine tables per spec §3.7 and this ticket — see the T1 report: the schema block in §3.7 itself
 * enumerates eight (`Project`, `Agent`, `Task`, `TaskEvent`, `Session`, `ToolCall`, `InboxMessage`,
 * `CommitSha`). That is a spec/ticket miscount, not a ninth table this file is free to invent, so
 * this migration creates exactly the eight §3.7 actually defines.
 *
 * Each statement is `IF NOT EXISTS` so re-running a migration that already applied is a no-op,
 * independent of the `user_version` tracking below — belt and suspenders for "running it twice is
 * safe."
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS Project (
        id                     TEXT PRIMARY KEY,
        slug                   TEXT NOT NULL UNIQUE,
        primaryRepoPath        TEXT NOT NULL,
        yamlPath               TEXT NOT NULL,
        defaultAgentId         TEXT REFERENCES Agent(id),
        maxConcurrentSessions  INTEGER NOT NULL DEFAULT 1,
        createdAt              TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Agent (
        id                  TEXT PRIMARY KEY,
        projectId           TEXT NOT NULL REFERENCES Project(id),
        name                TEXT NOT NULL,
        monogram            TEXT NOT NULL,
        model               TEXT NOT NULL,
        rolePrompt          TEXT NOT NULL,
        allowedToolsJson    TEXT NOT NULL,
        disallowedToolsJson TEXT NOT NULL,
        canCommit           INTEGER NOT NULL DEFAULT 0,
        maxTurns            INTEGER,
        maxBudgetUsd        REAL
      );

      CREATE TABLE IF NOT EXISTS Task (
        id               TEXT PRIMARY KEY,
        projectId        TEXT NOT NULL REFERENCES Project(id),
        name             TEXT NOT NULL,
        description      TEXT NOT NULL,
        status           TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'review', 'done')),
        blockedReason    TEXT,
        approvalGate     INTEGER NOT NULL DEFAULT 0,
        assigneeAgentId  TEXT REFERENCES Agent(id),
        scheduleKind     TEXT NOT NULL DEFAULT 'manual',
        createdAt        TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS TaskEvent (
        id          TEXT PRIMARY KEY,
        taskId      TEXT NOT NULL REFERENCES Task(id),
        fromStatus  TEXT NOT NULL CHECK (fromStatus IN ('todo', 'doing', 'review', 'done')),
        toStatus    TEXT NOT NULL CHECK (toStatus IN ('todo', 'doing', 'review', 'done')),
        actorType   TEXT NOT NULL CHECK (actorType IN ('session', 'human', 'system')),
        actorId     TEXT,
        reason      TEXT,
        atISO       TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Session (
        id                TEXT PRIMARY KEY,
        taskId            TEXT NOT NULL REFERENCES Task(id),
        agentId           TEXT NOT NULL REFERENCES Agent(id),
        sdkSessionId      TEXT,
        status            TEXT NOT NULL
                            CHECK (status IN ('running', 'waiting-inbox', 'completed', 'failed', 'interrupted')),
        triggerKind       TEXT NOT NULL CHECK (triggerKind IN ('manual', 'chain', 'goal', 'cron', 'webhook')),
        worktreePath      TEXT,
        baseRef           TEXT NOT NULL,
        costUsd           REAL,
        pid               INTEGER NOT NULL,
        bootId            TEXT NOT NULL,
        driftAtSpawnJson  TEXT NOT NULL,
        startedAtISO      TEXT NOT NULL,
        endedAtISO        TEXT,
        failureReason     TEXT
      );

      CREATE TABLE IF NOT EXISTS ToolCall (
        id         TEXT PRIMARY KEY,
        sessionId  TEXT NOT NULL REFERENCES Session(id),
        seq        INTEGER NOT NULL,
        name       TEXT NOT NULL,
        inputJson  TEXT NOT NULL,
        atISO      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS InboxMessage (
        id            TEXT PRIMARY KEY,
        sessionId     TEXT NOT NULL REFERENCES Session(id),
        taskId        TEXT NOT NULL REFERENCES Task(id),
        kind          TEXT NOT NULL,
        body          TEXT NOT NULL,
        choicesJson   TEXT,
        answer        TEXT,
        status        TEXT NOT NULL,
        askedAtISO    TEXT NOT NULL,
        answeredAtISO TEXT
      );

      CREATE TABLE IF NOT EXISTS CommitSha (
        sessionId  TEXT NOT NULL REFERENCES Session(id),
        sha        TEXT NOT NULL,
        PRIMARY KEY (sessionId, sha)
      );

      CREATE INDEX IF NOT EXISTS idx_agent_project        ON Agent(projectId);
      CREATE INDEX IF NOT EXISTS idx_task_project          ON Task(projectId);
      CREATE INDEX IF NOT EXISTS idx_taskevent_task        ON TaskEvent(taskId);
      CREATE INDEX IF NOT EXISTS idx_session_task          ON Session(taskId);
      CREATE INDEX IF NOT EXISTS idx_session_status        ON Session(status);
      CREATE INDEX IF NOT EXISTS idx_toolcall_session_seq  ON ToolCall(sessionId, seq);
      CREATE INDEX IF NOT EXISTS idx_inbox_session         ON InboxMessage(sessionId);
    `,
  },
];

/** Applies every migration above `PRAGMA user_version` hasn't seen yet, in order, transactionally. */
function migrate(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  const current = row.user_version;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

/**
 * Opens (creating if absent) a database at `dbPath` and brings it up to the latest migration.
 * Tests should call this with a fresh temp-dir path per run — never `DEFAULT_DB_PATH` — matching
 * the fixture-in-a-temp-dir pattern `verify-stage2.mts` established. Production code should
 * generally prefer `getDb()` below rather than opening its own handle.
 */
export function openDb(dbPath: string = DEFAULT_DB_PATH): DatabaseSync {
  const dir = dirname(dbPath);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  migrate(db);
  return db;
}

let singleton: DatabaseSync | null = null;

/** Lazily opens (once per process) and returns the app's own database at `DEFAULT_DB_PATH`. */
export function getDb(): DatabaseSync {
  if (!singleton) singleton = openDb(DEFAULT_DB_PATH);
  return singleton;
}

/**
 * The store, but only if it already exists — otherwise `null`.
 *
 * `getDb()` **creates** `data/agentos.sqlite` (mkdirSync + migrate), so calling it to *read* means
 * merely visiting a page materializes the execution layer's database on a machine where no project
 * has opted in. That was fixed at boot (`instrumentation.ts`) and missed on the page path; review
 * of #17 caught the second half. Read paths use this; write paths still use `getDb()`, because a
 * write is the thing that legitimately brings the store into existence.
 */
export function dbIfExists(): DatabaseSync | null {
  if (!singleton && !existsSync(DEFAULT_DB_PATH)) return null;
  return getDb();
}

/** Closes and forgets the process-wide singleton, if one was opened. For tests only. */
export function closeDb(): void {
  singleton?.close();
  singleton = null;
}

// ---------------------------------------------------------------------------
// Small conversions — SQLite has no boolean type; JSON columns store text, never objects.
// ---------------------------------------------------------------------------

function toSqliteBool(b: boolean): number {
  return b ? 1 : 0;
}

function fromSqliteBool(v: number): boolean {
  return v !== 0;
}

/** The one place a JSON-bearing column's text gets turned back into a value — call at the edge. */
export function parseJsonColumn<T>(text: string): T {
  return JSON.parse(text) as T;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  slug: string;
  primaryRepoPath: string;
  yamlPath: string;
  defaultAgentId?: string | null;
  maxConcurrentSessions?: number;
}

export function createProject(db: DatabaseSync, input: CreateProjectInput): ProjectRow {
  const row: ProjectRow = {
    id: randomUUID(),
    slug: input.slug,
    primaryRepoPath: input.primaryRepoPath,
    yamlPath: input.yamlPath,
    defaultAgentId: input.defaultAgentId ?? null,
    maxConcurrentSessions: input.maxConcurrentSessions ?? 1,
    createdAt: nowISO(),
  };
  db.prepare(
    `INSERT INTO Project (id, slug, primaryRepoPath, yamlPath, defaultAgentId, maxConcurrentSessions, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.slug,
    row.primaryRepoPath,
    row.yamlPath,
    row.defaultAgentId,
    row.maxConcurrentSessions,
    row.createdAt,
  );
  return row;
}

export function getProject(db: DatabaseSync, id: string): ProjectRow | null {
  return (db.prepare("SELECT * FROM Project WHERE id = ?").get(id) as ProjectRow | undefined) ?? null;
}

export function getProjectBySlug(db: DatabaseSync, slug: string): ProjectRow | null {
  return (
    (db.prepare("SELECT * FROM Project WHERE slug = ?").get(slug) as ProjectRow | undefined) ?? null
  );
}

export function listProjects(db: DatabaseSync): ProjectRow[] {
  return db.prepare("SELECT * FROM Project ORDER BY createdAt").all() as unknown as ProjectRow[];
}

export function setProjectDefaultAgent(db: DatabaseSync, projectId: string, agentId: string | null): void {
  db.prepare("UPDATE Project SET defaultAgentId = ? WHERE id = ?").run(agentId, projectId);
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface CreateAgentInput {
  projectId: string;
  name: string;
  monogram: string;
  model: string;
  rolePrompt: string;
  /** Parsed array in, JSON text out — this function is the edge for these two columns. */
  allowedTools: string[];
  disallowedTools: string[];
  canCommit: boolean;
  maxTurns?: number | null;
  maxBudgetUsd?: number | null;
}

export function createAgent(db: DatabaseSync, input: CreateAgentInput): AgentRow {
  const row: AgentRow = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    monogram: input.monogram,
    model: input.model,
    rolePrompt: input.rolePrompt,
    allowedToolsJson: JSON.stringify(input.allowedTools),
    disallowedToolsJson: JSON.stringify(input.disallowedTools),
    canCommit: input.canCommit,
    maxTurns: input.maxTurns ?? null,
    maxBudgetUsd: input.maxBudgetUsd ?? null,
  };
  db.prepare(
    `INSERT INTO Agent (id, projectId, name, monogram, model, rolePrompt, allowedToolsJson, disallowedToolsJson, canCommit, maxTurns, maxBudgetUsd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.projectId,
    row.name,
    row.monogram,
    row.model,
    row.rolePrompt,
    row.allowedToolsJson,
    row.disallowedToolsJson,
    toSqliteBool(row.canCommit),
    row.maxTurns,
    row.maxBudgetUsd,
  );
  return row;
}

function hydrateAgent(raw: Record<string, unknown>): AgentRow {
  return { ...(raw as unknown as AgentRow), canCommit: fromSqliteBool(raw.canCommit as number) };
}

/**
 * Rewrites every **editable** column — the whole row the caller built, with no partial-update
 * variant. `id` and `projectId` are deliberately not among them: an agent does not move between
 * projects, and `Session`/`Task` rows already name it where it is. Said "every column
 * `createAgent` accepts" until review of #21 pointed out that implied edits could reparent one. Lives here, beside `createAgent`,
 * rather than in the route that calls it: T2 wrote this statement inline in
 * `app/p/[slug]/config/actions.ts` because `db.ts` was outside its file list, which put schema
 * knowledge about `Agent` in two places. The failure mode is silent — add a column to `Agent` and
 * the inline statement quietly stops writing it. Moved in review, 2026-08-19.
 *
 * Refusing the edit while a session is live is the **caller's** job (§5.3) and deliberately not
 * enforced here: this function is the write, not the gate.
 */
export function updateAgent(
  db: DatabaseSync,
  id: string,
  input: Omit<CreateAgentInput, "projectId">,
): void {
  db.prepare(
    `UPDATE Agent
     SET name = ?, monogram = ?, model = ?, rolePrompt = ?,
         allowedToolsJson = ?, disallowedToolsJson = ?, canCommit = ?, maxTurns = ?, maxBudgetUsd = ?
     WHERE id = ?`,
  ).run(
    input.name,
    input.monogram,
    input.model,
    input.rolePrompt,
    JSON.stringify(input.allowedTools),
    JSON.stringify(input.disallowedTools),
    input.canCommit ? 1 : 0,
    input.maxTurns ?? null,
    input.maxBudgetUsd ?? null,
    id,
  );
}

export function getAgent(db: DatabaseSync, id: string): AgentRow | null {
  const raw = db.prepare("SELECT * FROM Agent WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return raw ? hydrateAgent(raw) : null;
}

export function listAgentsByProject(db: DatabaseSync, projectId: string): AgentRow[] {
  const rows = db
    .prepare("SELECT * FROM Agent WHERE projectId = ? ORDER BY name")
    .all(projectId) as unknown as Record<string, unknown>[];
  return rows.map(hydrateAgent);
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  projectId: string;
  name: string;
  description: string;
  approvalGate: boolean;
  /** Null means human-only (§7.1) — this function does not default it from the project. */
  assigneeAgentId: string | null;
  scheduleKind?: string;
}

/** Every task starts in `todo` with no `blockedReason` — both are set by later transitions. */
export function createTask(db: DatabaseSync, input: CreateTaskInput): TaskRow {
  const row: TaskRow = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    description: input.description,
    status: "todo",
    blockedReason: null,
    approvalGate: input.approvalGate,
    assigneeAgentId: input.assigneeAgentId,
    scheduleKind: input.scheduleKind ?? "manual",
    createdAt: nowISO(),
  };
  db.prepare(
    `INSERT INTO Task (id, projectId, name, description, status, blockedReason, approvalGate, assigneeAgentId, scheduleKind, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.projectId,
    row.name,
    row.description,
    row.status,
    row.blockedReason,
    toSqliteBool(row.approvalGate),
    row.assigneeAgentId,
    row.scheduleKind,
    row.createdAt,
  );
  return row;
}

function hydrateTask(raw: Record<string, unknown>): TaskRow {
  return { ...(raw as unknown as TaskRow), approvalGate: fromSqliteBool(raw.approvalGate as number) };
}

export function getTask(db: DatabaseSync, id: string): TaskRow | null {
  const raw = db.prepare("SELECT * FROM Task WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return raw ? hydrateTask(raw) : null;
}

export function listTasksByProject(db: DatabaseSync, projectId: string): TaskRow[] {
  const rows = db
    .prepare("SELECT * FROM Task WHERE projectId = ? ORDER BY createdAt")
    .all(projectId) as unknown as Record<string, unknown>[];
  return rows.map(hydrateTask);
}

/** Sets or clears the card's `blocked` chip (§7.6) without touching `status`. */
export function setTaskBlockedReason(db: DatabaseSync, taskId: string, blockedReason: string | null): void {
  db.prepare("UPDATE Task SET blockedReason = ? WHERE id = ?").run(blockedReason, taskId);
}

/**
 * §7.6's table — which `(from, to)` arrows exist, per actor. **Closed here, by T5**, per T1's own
 * note above (kept for history in git blame) that this was left open on purpose: `writeTaskTransition`
 * is the *only* path that writes `Task.status` (every caller — T4's MCP tool handler, `dispatch.ts`,
 * `sweep.ts` — funnels through it), so this is the one place a check can hold for every caller at
 * once, including ones this ticket is not allowed to edit directly (`lib/agentos/mcp/*`).
 *
 * A human may always move a card (§7.6: "any → any, human, … hand-moved"), so there is no `human`
 * row — every pair is legal for that actor and the check below short-circuits before consulting
 * this table at all. The `doing → done` carve-out on `approvalGate` is **not** re-encoded here:
 * that is §3.4's gate, already enforced independently by the MCP tool handler (T4) before it ever
 * reaches this function, and this table only judges the arrow's *shape*, not the task's own flags.
 */
const LEGAL_TRANSITIONS: Record<Exclude<ActorType, "human">, ReadonlySet<string>> = {
  session: new Set(["todo>doing", "doing>review", "doing>done"]),
  system: new Set(["doing>todo"]),
};

function assertLegalTransition(from: TaskStatus, to: TaskStatus, actorType: ActorType): void {
  if (actorType === "human") return;
  if (!LEGAL_TRANSITIONS[actorType].has(`${from}>${to}`)) {
    throw new Error(
      `illegal transition: '${from}' -> '${to}' by actorType '${actorType}' is not in spec §7.6's table`,
    );
  }
}

/**
 * Moves a task's status and writes the paired `TaskEvent` in one transaction — the data-layer
 * guarantee AC-10 needs (no `Task.status` without a matching `TaskEvent`), and now also the
 * guarantee AC-19 needs (an illegal arrow — e.g. `todo → done` from a session — is rejected here,
 * before either write happens, regardless of which module called this).
 */
export function writeTaskTransition(
  db: DatabaseSync,
  params: {
    taskId: string;
    toStatus: TaskStatus;
    actorType: ActorType;
    actorId: string | null;
    reason: string | null;
  },
): TaskEventRow {
  const task = getTask(db, params.taskId);
  if (!task) throw new Error(`writeTaskTransition: no Task ${params.taskId}`);
  assertLegalTransition(task.status, params.toStatus, params.actorType);
  const event: TaskEventRow = {
    id: randomUUID(),
    taskId: params.taskId,
    fromStatus: task.status,
    toStatus: params.toStatus,
    actorType: params.actorType,
    actorId: params.actorId,
    reason: params.reason,
    atISO: nowISO(),
  };
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE Task SET status = ? WHERE id = ?").run(params.toStatus, params.taskId);
    db.prepare(
      `INSERT INTO TaskEvent (id, taskId, fromStatus, toStatus, actorType, actorId, reason, atISO)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(event.id, event.taskId, event.fromStatus, event.toStatus, event.actorType, event.actorId, event.reason, event.atISO);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return event;
}

export function listTaskEvents(db: DatabaseSync, taskId: string): TaskEventRow[] {
  return db
    .prepare("SELECT * FROM TaskEvent WHERE taskId = ? ORDER BY atISO")
    .all(taskId) as unknown as TaskEventRow[];
}

// ---------------------------------------------------------------------------
// Session — createSession is the ONLY function in the codebase that inserts a Session row.
// T5's AC-14 asserts nothing else imports it (docs/specs/stage-3-tickets.md T1).
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  /**
   * Caller-supplied primary key. Optional and defaults to a fresh `randomUUID()` for any
   * existing caller that doesn't pass one (T4's fixtures). `dispatch.ts` (T5) always supplies
   * one: it must know the session id *before* this call, to name the worktree directory
   * `<tmp>/agentos/<sessionId>` (`worktree.ts`'s own docstring: "the session id is the caller's
   * identity to assign") — `worktreePath` below is required, so the worktree has to exist first,
   * which means the id has to exist before that.
   */
  id?: string;
  taskId: string;
  agentId: string;
  triggerKind: TriggerKind;
  worktreePath: string;
  baseRef: string;
  pid: number;
  bootId: string;
  /** Parsed object in, JSON text out (§7.5) — never stored as an object. */
  driftAtSpawn: DriftAtSpawn;
}

/**
 * The sole insert path for a `Session` row (§7.4's pseudocode: `INSERT Session(status='running', …)`).
 * Every new session starts `running`, with no `sdkSessionId` yet (the SDK's init message hasn't
 * arrived) and no `endedAtISO` / `failureReason`. Callers update the row afterwards via
 * `updateSession`.
 */
export function createSession(db: DatabaseSync, input: CreateSessionInput): SessionRow {
  const row: SessionRow = {
    id: input.id ?? randomUUID(),
    taskId: input.taskId,
    agentId: input.agentId,
    sdkSessionId: null,
    status: "running",
    triggerKind: input.triggerKind,
    worktreePath: input.worktreePath,
    baseRef: input.baseRef,
    costUsd: null,
    pid: input.pid,
    bootId: input.bootId,
    driftAtSpawnJson: JSON.stringify(input.driftAtSpawn),
    startedAtISO: nowISO(),
    endedAtISO: null,
    failureReason: null,
  };
  db.prepare(
    `INSERT INTO Session (id, taskId, agentId, sdkSessionId, status, triggerKind, worktreePath, baseRef, costUsd, pid, bootId, driftAtSpawnJson, startedAtISO, endedAtISO, failureReason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.taskId,
    row.agentId,
    row.sdkSessionId,
    row.status,
    row.triggerKind,
    row.worktreePath,
    row.baseRef,
    row.costUsd,
    row.pid,
    row.bootId,
    row.driftAtSpawnJson,
    row.startedAtISO,
    row.endedAtISO,
    row.failureReason,
  );
  return row;
}

export function getSession(db: DatabaseSync, id: string): SessionRow | null {
  return (db.prepare("SELECT * FROM Session WHERE id = ?").get(id) as SessionRow | undefined) ?? null;
}

export function listSessionsByTask(db: DatabaseSync, taskId: string): SessionRow[] {
  return db
    .prepare("SELECT * FROM Session WHERE taskId = ? ORDER BY startedAtISO")
    .all(taskId) as unknown as SessionRow[];
}

export function listSessionsByProject(db: DatabaseSync, projectId: string): SessionRow[] {
  return db
    .prepare(
      `SELECT Session.* FROM Session
       JOIN Task ON Task.id = Session.taskId
       WHERE Task.projectId = ?
       ORDER BY Session.startedAtISO`,
    )
    .all(projectId) as unknown as SessionRow[];
}

/** For the boot sweep (§7.7) — sessions that still claim to be live. */
export function listSessionsByStatus(db: DatabaseSync, statuses: SessionRow["status"][]): SessionRow[] {
  if (statuses.length === 0) return [];
  const placeholders = statuses.map(() => "?").join(", ");
  return db
    .prepare(`SELECT * FROM Session WHERE status IN (${placeholders})`)
    .all(...statuses) as unknown as SessionRow[];
}

export interface SessionPatch {
  sdkSessionId?: string | null;
  status?: SessionRow["status"];
  worktreePath?: string | null;
  costUsd?: number | null;
  endedAtISO?: string | null;
  failureReason?: string | null;
}

/** Partial update for the fields that change over a session's life. Never inserts a row. */
export function updateSession(db: DatabaseSync, id: string, patch: SessionPatch): void {
  const fields = Object.keys(patch) as (keyof SessionPatch)[];
  if (fields.length === 0) return;
  const set = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (patch[f] ?? null) as string | number | null);
  db.prepare(`UPDATE Session SET ${set} WHERE id = ?`).run(...values, id);
}

// ---------------------------------------------------------------------------
// ToolCall
// ---------------------------------------------------------------------------

export interface CreateToolCallInput {
  sessionId: string;
  seq: number;
  name: string;
  /** Parsed object in, JSON text out. */
  input: unknown;
}

export function createToolCall(db: DatabaseSync, input: CreateToolCallInput): ToolCallRow {
  const row: ToolCallRow = {
    id: randomUUID(),
    sessionId: input.sessionId,
    seq: input.seq,
    name: input.name,
    inputJson: JSON.stringify(input.input),
    atISO: nowISO(),
  };
  db.prepare(
    `INSERT INTO ToolCall (id, sessionId, seq, name, inputJson, atISO) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.sessionId, row.seq, row.name, row.inputJson, row.atISO);
  return row;
}

export function listToolCallsBySession(db: DatabaseSync, sessionId: string): ToolCallRow[] {
  return db
    .prepare("SELECT * FROM ToolCall WHERE sessionId = ? ORDER BY seq")
    .all(sessionId) as unknown as ToolCallRow[];
}

// ---------------------------------------------------------------------------
// InboxMessage
// ---------------------------------------------------------------------------

export interface CreateInboxMessageInput {
  sessionId: string;
  taskId: string;
  /** §3.7: `'question'` is the only kind in Stage 3; defaults to it. */
  kind?: InboxKind;
  body: string;
  /** Parsed array in, JSON text out. Omit for a free-text ask. */
  choices?: unknown;
  /** §3.7: a new message is `'open'` until answered; defaults to it. */
  status?: InboxStatus;
}

export function createInboxMessage(db: DatabaseSync, input: CreateInboxMessageInput): InboxMessageRow {
  const row: InboxMessageRow = {
    id: randomUUID(),
    sessionId: input.sessionId,
    taskId: input.taskId,
    kind: input.kind ?? "question",
    body: input.body,
    choicesJson: input.choices === undefined ? null : JSON.stringify(input.choices),
    answer: null,
    status: input.status ?? "open",
    askedAtISO: nowISO(),
    answeredAtISO: null,
  };
  db.prepare(
    `INSERT INTO InboxMessage (id, sessionId, taskId, kind, body, choicesJson, answer, status, askedAtISO, answeredAtISO)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.sessionId,
    row.taskId,
    row.kind,
    row.body,
    row.choicesJson,
    row.answer,
    row.status,
    row.askedAtISO,
    row.answeredAtISO,
  );
  return row;
}

export function getInboxMessage(db: DatabaseSync, id: string): InboxMessageRow | null {
  return (
    (db.prepare("SELECT * FROM InboxMessage WHERE id = ?").get(id) as InboxMessageRow | undefined) ?? null
  );
}

export function listInboxMessagesBySession(db: DatabaseSync, sessionId: string): InboxMessageRow[] {
  return db
    .prepare("SELECT * FROM InboxMessage WHERE sessionId = ? ORDER BY askedAtISO")
    .all(sessionId) as unknown as InboxMessageRow[];
}

/**
 * The rail's Inbox counter (D32) — one `COUNT(*)`, not the N+1 loader.
 *
 * Joined through `Task` because `InboxMessage` carries `taskId` and the project
 * lives one hop away. `loadProjectExecutionData` would answer the same question
 * by fetching every task, session, tool call and commit sha for the project;
 * the rail renders on four routes, so that cost would be paid on every page.
 *
 * Matches `inboxModel`'s rule exactly — `status = 'open'` — and AC-4 asserts the
 * two agree on a fixture rather than trusting that they were written the same.
 */
export function countOpenInboxByProject(db: DatabaseSync, projectId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM InboxMessage m
         JOIN Task t ON t.id = m.taskId
        WHERE t.projectId = ? AND m.status = 'open'`,
    )
    .get(projectId) as unknown as { n: number };
  return Number(row?.n ?? 0);
}

export function answerInboxMessage(db: DatabaseSync, id: string, answer: string, status: string): void {
  db.prepare("UPDATE InboxMessage SET answer = ?, status = ?, answeredAtISO = ? WHERE id = ?").run(
    answer,
    status,
    nowISO(),
    id,
  );
}

// ---------------------------------------------------------------------------
// CommitSha — read from git, never from us (§3.7). Insert-only, no update.
// ---------------------------------------------------------------------------

export function recordCommitShas(db: DatabaseSync, sessionId: string, shas: string[]): void {
  if (shas.length === 0) return;
  const stmt = db.prepare("INSERT OR IGNORE INTO CommitSha (sessionId, sha) VALUES (?, ?)");
  for (const sha of shas) stmt.run(sessionId, sha);
}

export function listCommitShas(db: DatabaseSync, sessionId: string): CommitShaRow[] {
  return db
    .prepare("SELECT * FROM CommitSha WHERE sessionId = ?")
    .all(sessionId) as unknown as CommitShaRow[];
}
