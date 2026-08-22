/**
 * AC-0a, AC-0b, AC-0c from docs/specs/stage-4-tickets.md T1 — schema, the seeded template, and this
 * suite itself. Numbered outside the spec's AC-1…AC-11 range so a later reader can see at a glance
 * that these are ticket-level structural checks, not spec-numbered behaviour (T1 closes no spec AC
 * — every one of AC-1…AC-11 needs `lib/agentos/chain.ts`, which T2 creates).
 *
 * Fixture-based; the model is never called. Style, PASS/FAIL format and exit-code behaviour match
 * `scripts/verify-stage3b.mts`. A fresh temp dir per check, one unconditional cleanup sweep at the
 * true end — never `data/agentos.sqlite`.
 *
 * Run: pnpm verify:stage4
 */
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  openDb,
  createProject,
  getTask,
  listTemplatesByProject,
} from "../lib/agentos/db";
import { seedBuiltInTemplates } from "../lib/agentos/templates/seed";
import { COMPOUND_ENGINEER_TEMPLATE } from "../lib/agentos/templates/compound-engineer";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

const TEMPS: string[] = [];

function tempDbPath(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `agentic-os-stage4-${name}-`));
  TEMPS.push(dir);
  return join(dir, "agentos.sqlite");
}

/**
 * Migration 1's schema, copied verbatim from `lib/agentos/db.ts`'s own `MIGRATIONS[0].sql` — that
 * array is not exported (each `verify-stage*.mts` owns its own fixture family;
 * `verify-stage3b.mts`'s own convention, restated in its header comment), so AC-0a builds its own
 * "pre-Stage-4" database by running this text directly, rather than importing anything from
 * `db.ts` that already assumes migration 2 has landed.
 */
const MIGRATION_1_SQL = `
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
`;

console.log("\nStage 4 acceptance — schema, the seeded template, and this suite (T1)\n");

function runChecks() {
  // ── AC-0a · the migration is additive and idempotent ──────────────────────────────────────
  {
    const dbPath = tempDbPath("ac0a");
    const raw = new DatabaseSync(dbPath);
    raw.exec("PRAGMA foreign_keys = ON");
    raw.exec(MIGRATION_1_SQL);
    raw.exec("PRAGMA user_version = 1");

    const projectId = randomUUID();
    const agentId = randomUUID();
    const taskId = randomUUID();
    const nowISO = new Date().toISOString();

    raw
      .prepare(
        `INSERT INTO Project (id, slug, primaryRepoPath, yamlPath, defaultAgentId, maxConcurrentSessions, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(projectId, "ac0a-project", "/tmp/ac0a-fixture-does-not-need-to-exist", "/tmp/ac0a-fixture-does-not-need-to-exist/agentos.yml", null, 1, nowISO);

    raw
      .prepare(
        `INSERT INTO Agent (id, projectId, name, monogram, model, rolePrompt, allowedToolsJson, disallowedToolsJson, canCommit, maxTurns, maxBudgetUsd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(agentId, projectId, "Fixer", "FX", "claude-opus-5", "Fixes things.", "[]", "[]", 0, null, null);

    raw
      .prepare(
        `INSERT INTO Task (id, projectId, name, description, status, blockedReason, approvalGate, assigneeAgentId, scheduleKind, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(taskId, projectId, "Pre-Stage-4 task", "Exists before migration 2 ever runs.", "todo", null, 1, agentId, "manual", nowISO);

    const before = raw.prepare("SELECT * FROM Task WHERE id = ?").get(taskId) as Record<string, unknown>;
    raw.close();

    // First migrate: a fresh handle at the same path. `openDb` applies every migration above
    // `user_version` — here, only migration 2.
    const db = openDb(dbPath);
    const versionAfterFirst = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    const after = getTask(db, taskId) as unknown as Record<string, unknown> | null;
    db.close();

    // Second migrate: another fresh handle, same path. Must not error, must not move user_version.
    let secondError: string | null = null;
    let versionAfterSecond: number | null = null;
    try {
      const db2 = openDb(dbPath);
      versionAfterSecond = (db2.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      db2.close();
    } catch (err) {
      secondError = err instanceof Error ? err.message : String(err);
    }

    // `before` is a raw sqlite row (approvalGate is 0/1); `after` came through `getTask`'s own
    // hydration (approvalGate is a JS boolean). Byte-identical means "every pre-existing value is
    // the same fact", not "every value has the same JS type" — `db.ts`'s own boolean conversion is
    // exactly what AC-4 in `verify-stage3b.mts` already treats as a non-difference.
    const normalize = (row: Record<string, unknown>) => ({ ...row, approvalGate: row.approvalGate ? 1 : 0 });
    const beforeN = normalize(before);
    const afterN = after ? normalize(after) : null;
    const beforeKeys = Object.keys(before);
    const changed = afterN ? beforeKeys.filter((k) => afterN[k] !== beforeN[k]) : beforeKeys;

    if (!after) {
      fail("AC-0a", "the Task row is unreadable after migration 2 ran");
    } else if (changed.length > 0) {
      fail(
        "AC-0a",
        `pre-existing Task columns changed across migration: ${changed.map((k) => `${k}: ${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}`).join("; ")}`,
      );
    } else if (after.chainId !== null || after.chainOrd !== null) {
      fail("AC-0a", `new columns are not NULL — chainId=${JSON.stringify(after.chainId)}, chainOrd=${JSON.stringify(after.chainOrd)}`);
    } else if (versionAfterFirst !== 2) {
      fail("AC-0a", `user_version did not land on 2 after the first migrate, got ${versionAfterFirst}`);
    } else if (secondError) {
      fail("AC-0a", `migrating a second time threw instead of no-op'ing: ${secondError}`);
    } else if (versionAfterSecond !== 2) {
      fail("AC-0a", `user_version moved on a second migrate — expected 2, got ${versionAfterSecond}`);
    } else {
      pass(
        "AC-0a",
        `migration 2 is additive (every pre-existing Task column unchanged, chainId/chainOrd NULL) and idempotent (user_version 1→2 then stays 2, no error on replay)`,
      );
    }
  }

  // ── AC-0b · the seeded template matches AgentOS-spec §10 ─────────────────────────────────
  {
    const steps = COMPOUND_ENGINEER_TEMPLATE.steps;
    const ords = steps.map((s) => s.ord);
    const noGap = ords.length === 9 && ords.every((o, i) => o === i + 1);
    const gateOrds = steps.filter((s) => s.approvalGate).map((s) => s.ord);
    const gatesCorrect = gateOrds.length === 2 && gateOrds[0] === 1 && gateOrds[1] === 9;
    const step9 = steps.find((s) => s.ord === 9);
    const step9Human = step9?.assigneeAgentName === "human";
    const emptyNames = steps.filter((s) => s.ord !== 9 && s.name.trim().length === 0).map((s) => s.ord);

    if (steps.length !== 9) {
      fail("AC-0b", `expected 9 steps, got ${steps.length}`);
    } else if (!noGap) {
      fail("AC-0b", `ord is not 1..9 with no gap: ${JSON.stringify(ords)}`);
    } else if (!gatesCorrect) {
      fail("AC-0b", `approvalGate is not true on exactly steps 1 and 9: got ord(s) ${JSON.stringify(gateOrds)}`);
    } else if (!step9Human) {
      fail("AC-0b", `step 9's assigneeAgentName is not the literal 'human': got ${JSON.stringify(step9?.assigneeAgentName)}`);
    } else if (emptyNames.length > 0) {
      fail("AC-0b", `step name(s) empty at ord ${JSON.stringify(emptyNames)}`);
    } else {
      pass(
        "AC-0b",
        `9 steps, ord 1-9 with no gap, approvalGate true only at steps 1 and 9, step 9 assignee is the literal 'human', every other step named`,
      );
    }
  }

  // ── AC-0c · seeding is idempotent ─────────────────────────────────────────────────────────
  // [G] guard: `lib/agentos/templates/seed.ts`'s existence check is what stops a second
  // initialize click from writing a second TaskTemplate row. Proven by deliberately deleting it,
  // observing this check go red, then reverting — see the T1 report for the failure message.
  {
    const dbPath = tempDbPath("ac0c");
    const db = openDb(dbPath);
    const project = createProject(db, {
      slug: "ac0c-project",
      primaryRepoPath: "/tmp/ac0c-fixture-does-not-need-to-exist",
      yamlPath: "/tmp/ac0c-fixture-does-not-need-to-exist/agentos.yml",
      maxConcurrentSessions: 1,
    });

    seedBuiltInTemplates(db, project.id);
    seedBuiltInTemplates(db, project.id);

    const rows = listTemplatesByProject(db, project.id).filter((t) => t.slug === COMPOUND_ENGINEER_TEMPLATE.slug);
    db.close();

    if (rows.length !== 1) {
      fail("AC-0c", `seeding the same project twice produced ${rows.length} TaskTemplate row(s) for '${COMPOUND_ENGINEER_TEMPLATE.slug}', expected exactly 1`);
    } else {
      pass("AC-0c", `seeding the same project twice left exactly 1 TaskTemplate row for '${COMPOUND_ENGINEER_TEMPLATE.slug}'`);
    }
  }
}

try {
  runChecks();
} catch (err) {
  fail("suite", `a check threw instead of reporting — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  for (const t of TEMPS) rmSync(t, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll Stage 4 T1 acceptance criteria pass.\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
