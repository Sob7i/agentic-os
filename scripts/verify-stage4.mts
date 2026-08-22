/**
 * AC-0a, AC-0b, AC-0c from docs/specs/stage-4-tickets.md T1 — schema, the seeded template, and this
 * suite itself. Numbered outside the spec's AC-1…AC-11 range so a later reader can see at a glance
 * that these are ticket-level structural checks, not spec-numbered behaviour (T1 closes no spec AC
 * — every one of AC-1…AC-11 needs `lib/agentos/chain.ts`, which T2 creates).
 *
 * AC-1, AC-2, AC-3, AC-11 (T2, "instantiate, all-or-nothing") append below AC-0c, plus AC-1b — a
 * ticket-instructed addition, not spec-numbered, in the same "b" spirit as `verify-stage3b.mts`'s
 * own AC-8b/AC-6b: `docs/specs/stage-4-tickets.md`'s inherited fact 4 states that this project's
 * real `Agent` rows name neither of the seeded template's six agents, so instantiating it here
 * today refuses at §3.3 rule 2 — and the ticket brief is explicit that a fixture must prove that
 * refusal rather than seed around it ("do not relax that rule to make a test pass"). Every T2
 * fixture below seeds all six named agents (`spec`, `plan`, `review-coordinator`,
 * `implementation-plan-executioner`, `senior-dev`, `librarian`) except AC-1b's, which omits one on
 * purpose.
 *
 * Fixture-based; the model is never called. Style, PASS/FAIL format and exit-code behaviour match
 * `scripts/verify-stage3b.mts`. A fresh temp dir per check, one unconditional cleanup sweep at the
 * true end — never `data/agentos.sqlite`.
 *
 * Run: pnpm verify:stage4
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  openDb,
  createProject,
  createAgent,
  createChain,
  createSession,
  createTask,
  createTemplate,
  getAgent,
  getChain,
  getSession,
  getTask,
  getTemplateBySlug,
  listSessionsByTask,
  listTasksByChain,
  listTasksByProject,
  listTemplateSteps,
  listTemplatesByProject,
  parseJsonColumn,
  setProjectDefaultAgent,
  writeTaskTransition,
} from "../lib/agentos/db";
import type { SessionRow } from "../lib/agentos/types";
import { seedBuiltInTemplates } from "../lib/agentos/templates/seed";
import { COMPOUND_ENGINEER_TEMPLATE } from "../lib/agentos/templates/compound-engineer";
import { instantiateTemplate, advanceChainAfterDone } from "../lib/agentos/chain";
import { dispatch } from "../lib/agentos/dispatch";
import { FakeRunner } from "../lib/agentos/runner/fake";
import { createTaskUpdateStatusTool } from "../lib/agentos/mcp/agentos-server";
import { moveTaskForSlug, approveDoneForSlug } from "../app/p/[slug]/[tab]/actions";

/**
 * `PROJECTS` is reached through `createRequire`, never a top-level import — the same two-registry
 * problem `verify-stage3b.mts` and `verify-stage3c.mts` already document: this file is native ESM,
 * but `projects.config.ts` loads through tsx's CommonJS path everywhere else, including the chain
 * `resolveNav` reads inside `moveTaskForSlug`/`approveDoneForSlug`. A top-level import would splice
 * a second, independent array nothing else ever sees.
 */
const projectsConfigRequire = createRequire(import.meta.url);
interface ProjectConfigLike { name: string; path: string; stalledAfterDays: number; dirtyThreshold: number }
function getProjects(): ProjectConfigLike[] {
  return (projectsConfigRequire("../projects.config") as { PROJECTS: ProjectConfigLike[] }).PROJECTS;
}

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

/** The six non-human names the seeded template's steps name (AgentOS-spec §10, inherited fact 4). */
const TEMPLATE_AGENT_NAMES = [
  "spec",
  "plan",
  "review-coordinator",
  "implementation-plan-executioner",
  "senior-dev",
  "librarian",
] as const;

/** Every `{{var}}` the seeded template's steps reference (spec §3.3's rule 1). */
const FULL_VARS: Record<string, string> = {
  branchName: "feat/widget",
  featureTitle: "Widget support",
  featureSpec: "Add widget support end to end.",
};

/**
 * A fixture project for T2's checks: a real directory on disk with an `agentos.yml` (§3.3 rule 3),
 * every one of the seeded template's six named agents (unless excluded via `missingAgentName`), and
 * the built-in template seeded into it. `dir` is a real path — `existsSync` on `primaryRepoPath`
 * has to find something, and `instantiateTemplate` refuses otherwise.
 *
 * Two options T3 adds, both opt-in so T2's own checks above are untouched:
 * - `setDefaultAgent` — AC-7's fixture requirement: `Project.defaultAgentId` must be a **real**
 *   agent, because the bug under test is a human-only step silently executed by the project's
 *   default rather than refused. Left unset (null) is what every T2 check already relies on.
 * - `registerInBoard` — splices `{ name: slug, path: dir, ... }` into the real `PROJECTS` array
 *   (`projects.config.ts`) the same way `verify-stage3c.mts`'s own `seedProject` does, so
 *   `resolveNav` — and therefore `moveTaskForSlug`/`approveDoneForSlug` — can resolve this fixture
 *   by slug. Only the two checks that call into `app/p/[slug]/[tab]/actions.ts` need this; every
 *   other check talks to `chain.ts`/`dispatch.ts` directly and never touches the board.
 */
function makeChainFixture(
  name: string,
  opts: { missingAgentName?: string; setDefaultAgent?: boolean; registerInBoard?: boolean } = {},
): { db: DatabaseSync; dir: string; projectId: string; slug: string } {
  const dir = mkdtempSync(join(tmpdir(), `agentic-os-stage4-chain-${name}-`));
  TEMPS.push(dir);
  writeFileSync(join(dir, "agentos.yml"), "");
  // T3: a real dispatch() (via advanceChainAfterDone) needs `git rev-parse HEAD` to resolve
  // (Stage 3 §7.3 precondition 5) — T1/T2 never called dispatch, so this fixture was never a real
  // repo before. Mirrors verify-stage3.mts's own makeDispatchFixtureRepo exactly.
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "fixture");

  const slug = `t2-${name}`;
  const db = openDb(tempDbPath(`chain-${name}`));
  const project = createProject(db, {
    slug,
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    // Well above the 9-step chain's own ceiling. T3's multi-step checks (AC-7, AC-8) approve
    // several steps in quick succession without waiting for each dispatched session's background
    // completion to settle first (§7.4 — that continuation is unawaited by design, and settling
    // is irrelevant to what those checks assert); a cap of 1 would make dispatch refuse on
    // "concurrency" instead of the thing under test. Concurrency-cap correctness itself is Stage
    // 3's own AC-7, unaffected by this fixture's value.
    maxConcurrentSessions: 20,
  });

  let firstAgentId: string | null = null;
  for (const agentName of TEMPLATE_AGENT_NAMES) {
    if (agentName === opts.missingAgentName) continue;
    const agent = createAgent(db, {
      projectId: project.id,
      name: agentName,
      monogram: agentName.slice(0, 2).toUpperCase(),
      model: "claude-opus-5",
      rolePrompt: `You are ${agentName}.`,
      allowedTools: [],
      disallowedTools: [],
      canCommit: false,
    });
    firstAgentId ??= agent.id;
  }

  if (opts.setDefaultAgent && firstAgentId) {
    setProjectDefaultAgent(db, project.id, firstAgentId);
  }

  if (opts.registerInBoard) {
    getProjects().push({ name: slug, path: dir, stalledAfterDays: 365, dirtyThreshold: 50 });
  }

  seedBuiltInTemplates(db, project.id);
  return { db, dir, projectId: project.id, slug };
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

console.log("\nStage 4 acceptance — schema and seed (T1), instantiate all-or-nothing (T2), advance/refuse/halt (T3)\n");

/**
 * Polls `getSession` against a deadline rather than sleeping a fixed amount — `dispatch`'s
 * unawaited continuation (§7.4) means a session's terminal fields land some time after `dispatch`
 * (or `advanceChainAfterDone`, which calls it) has already returned. Copied from
 * `verify-stage3.mts`'s own helper of the same name and shape rather than imported — each
 * `verify-stage*.mts` owns its own fixture family (this file's own header comment; T1's own
 * convention for `MIGRATION_1_SQL`).
 */
async function waitForSession(
  db: DatabaseSync,
  sessionId: string,
  settled: (s: SessionRow) => boolean,
  timeoutMs = 5000,
): Promise<SessionRow> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const session = getSession(db, sessionId);
    if (!session) throw new Error(`waitForSession: no Session ${sessionId}`);
    if (settled(session)) return session;
    if (Date.now() >= deadline) {
      throw new Error(
        `waitForSession: session ${sessionId} did not settle within ${timeoutMs}ms ` +
          `(status='${session.status}', endedAtISO=${session.endedAtISO ?? "null"})`,
      );
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * The minimal scripted message AC-8's failing runner needs to actually throw: `FakeRunner` only
 * fires `throwAfterIndex` from inside its message-delivery loop (docs on `RunnerScript` in
 * `lib/agentos/runner/fake.ts` — "out of range, including `messages.length`, never fires"), so a
 * throw with zero messages delivered is not obtainable by construction. One `system`/`init`
 * message is enough to give the loop one iteration to throw after. Shape copied from
 * `verify-stage3.mts`'s own `initMessage` builder, which checked it against the installed SDK's
 * real types once (`external-API-fields-are-guilty-until-verified`) — not re-guessed here.
 */
function initMessage(sessionId: string) {
  return {
    type: "system" as const,
    subtype: "init" as const,
    apiKeySource: "user" as const,
    claude_code_version: "0.0.0-fake",
    cwd: "/tmp/agentos-fake-worktree",
    tools: ["Read", "Edit", "Bash"],
    mcp_servers: [],
    model: "claude-opus-5",
    permissionMode: "default" as const,
    slash_commands: [],
    output_style: "default",
    skills: [],
    plugins: [],
    uuid: randomUUID(),
    session_id: sessionId,
  };
}

/**
 * What a human clicking "Approve" does to a task, at the `writeTaskTransition` + advance level —
 * the same two calls `approveDoneForSlug` makes (`app/p/[slug]/[tab]/actions.ts`), used directly
 * here so T3's AC-4/7/8/10 can drive a chain through several steps without paying `resolveOwnedTask`
 * -> `boardOnce`'s real-project-scan cost on every single step. `moveTaskForSlug`/
 * `approveDoneForSlug`'s own wiring — that they call this same hook in production — is what AC-4b
 * below checks, once, the more expensive way.
 */
async function humanApprove(db: DatabaseSync, taskId: string, runner: FakeRunner): Promise<void> {
  writeTaskTransition(db, {
    taskId,
    toStatus: "done",
    actorType: "human",
    actorId: "owner",
    reason: "approved by owner (test)",
  });
  await advanceChainAfterDone(taskId, { db, runner });
}

async function runChecks() {
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

  // ── AC-1 · nine cards, in order ────────────────────────────────────────────────────────────
  {
    const { db, projectId } = makeChainFixture("ac1");
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });

    if (!result.ok) {
      fail("AC-1", `instantiate refused against a fixture with all six agents seeded: ${result.reason}`);
    } else {
      const tasks = listTasksByChain(db, result.chainId);
      const ords = tasks.map((t) => t.chainOrd);
      const expectedOrds = COMPOUND_ENGINEER_TEMPLATE.steps.map((s) => s.ord);
      const allTodo = tasks.every((t) => t.status === "todo");
      const gatesMatch = tasks.every(
        (t, i) => t.approvalGate === COMPOUND_ENGINEER_TEMPLATE.steps[i].approvalGate,
      );
      const agentsMatch = tasks.every((t, i) => {
        const step = COMPOUND_ENGINEER_TEMPLATE.steps[i];
        if (step.assigneeAgentName === "human") return t.assigneeAgentId === null;
        const agent = t.assigneeAgentId ? getAgent(db, t.assigneeAgentId) : null;
        return agent?.name === step.assigneeAgentName;
      });

      if (result.taskIds.length !== 9) {
        fail("AC-1", `expected 9 taskIds back, got ${result.taskIds.length}`);
      } else if (tasks.length !== 9) {
        fail("AC-1", `expected 9 Task rows linked to the chain, got ${tasks.length}`);
      } else if (JSON.stringify(ords) !== JSON.stringify(expectedOrds)) {
        fail("AC-1", `chainOrd sequence is ${JSON.stringify(ords)}, expected ${JSON.stringify(expectedOrds)}`);
      } else if (!allTodo) {
        fail("AC-1", `not every task is 'todo': ${tasks.map((t) => t.status).join(", ")}`);
      } else if (!gatesMatch) {
        fail("AC-1", "at least one task's approvalGate does not match its step's");
      } else if (!agentsMatch) {
        fail("AC-1", "at least one task's resolved agent does not match its step's assigneeAgentName");
      } else {
        pass(
          "AC-1",
          "9 tasks created in order (chainOrd 1..9), all 'todo', each naming the right agent (null for the human step) and gate flag",
        );
      }
    }
  }

  // ── AC-2 · binding is total or nothing ─────────────────────────────────────────────────────
  {
    // Part 1 — every variable supplied: no "{{" survives in any stored prompt.
    const fixtureA = makeChainFixture("ac2a");
    const bound = instantiateTemplate({
      db: fixtureA.db,
      projectId: fixtureA.projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });
    const survivedBraces = bound.ok
      ? listTasksByChain(fixtureA.db, bound.chainId).filter((t) => t.description.includes("{{"))
      : [];

    // Part 2 — `branchName` omitted: refuses naming the variable and the step; a fresh project
    // that had zero Task rows before the attempt still has zero after it.
    const fixtureB = makeChainFixture("ac2b");
    const { branchName: _omitted, ...withoutBranchName } = FULL_VARS;
    const beforeCount = listTasksByProject(fixtureB.db, fixtureB.projectId).length;
    const refusal = instantiateTemplate({
      db: fixtureB.db,
      projectId: fixtureB.projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: withoutBranchName,
    });
    const afterCount = listTasksByProject(fixtureB.db, fixtureB.projectId).length;

    if (!bound.ok) {
      fail("AC-2", `setup: instantiate with every variable supplied was refused: ${bound.reason}`);
    } else if (survivedBraces.length > 0) {
      fail("AC-2", `unbound "{{" survived in ${survivedBraces.length} stored prompt(s) despite every variable being supplied`);
    } else if (refusal.ok) {
      fail("AC-2", "instantiate succeeded with 'branchName' omitted");
    } else if (!refusal.reason.includes("branchName")) {
      fail("AC-2", `refusal did not name the missing variable: ${JSON.stringify(refusal.reason)}`);
    } else if (!refusal.reason.includes("step 1")) {
      fail("AC-2", `refusal did not name the step: ${JSON.stringify(refusal.reason)}`);
    } else if (beforeCount !== 0 || afterCount !== beforeCount) {
      fail("AC-2", `Task count is not unchanged: ${beforeCount} before, ${afterCount} after the refused attempt`);
    } else {
      pass(
        "AC-2",
        `bound total (no "{{" survives) when every variable is supplied; refused omitting 'branchName': "${refusal.reason}" — Task count unchanged (${beforeCount})`,
      );
    }
  }

  // ── AC-1b · a missing agent refuses, naming the step ───────────────────────────────────────
  // Not spec-numbered — a ticket-instructed addition (docs/specs/stage-4-tickets.md T2, inherited
  // fact 4): this project's real agents name neither `ux-ui-designer` nor `frontend developer` as
  // any of the six the seeded template needs, so instantiate refusing here is the spec working,
  // not a defect, and this check proves the refusal rather than seeding around the rule that
  // produces it. `senior-dev` (step 7) is left out of the fixture on purpose.
  {
    const { db, projectId } = makeChainFixture("ac1b", { missingAgentName: "senior-dev" });
    const beforeCount = listTasksByProject(db, projectId).length;
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });
    const afterCount = listTasksByProject(db, projectId).length;

    if (result.ok) {
      fail("AC-1b", "instantiate succeeded with 'senior-dev' missing from the project's agents");
    } else if (!result.reason.includes("senior-dev")) {
      fail("AC-1b", `refusal did not name the missing agent: ${JSON.stringify(result.reason)}`);
    } else if (!result.reason.includes("step 7")) {
      fail("AC-1b", `refusal did not name the step: ${JSON.stringify(result.reason)}`);
    } else if (afterCount !== beforeCount) {
      fail("AC-1b", `Task count changed on a refused instantiate: ${beforeCount} -> ${afterCount}`);
    } else {
      pass(
        "AC-1b",
        `refused: "${result.reason}" — Task count unchanged (${beforeCount}). Rule 2 held rather than being relaxed to pass.`,
      );
    }
  }

  // ── AC-3 · steps 2–9 are blocked, and say by what ──────────────────────────────────────────
  {
    const { db, projectId } = makeChainFixture("ac3");
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });

    if (!result.ok) {
      fail("AC-3", `setup: instantiate was refused: ${result.reason}`);
    } else {
      const tasks = listTasksByChain(db, result.chainId); // ordered by chainOrd
      const step1 = tasks.find((t) => t.chainOrd === 1);
      const laterSteps = tasks.filter((t) => (t.chainOrd ?? 0) >= 2);
      const allNamePredecessor = laterSteps.every(
        (t) =>
          typeof t.blockedReason === "string" &&
          t.blockedReason.includes(`step ${(t.chainOrd ?? 0) - 1}`),
      );

      if (step1 && step1.blockedReason !== null) {
        fail("AC-3", `step 1 carries a blockedReason: ${JSON.stringify(step1.blockedReason)}`);
      } else if (laterSteps.length !== 8) {
        fail("AC-3", `expected 8 steps at chainOrd >= 2, got ${laterSteps.length}`);
      } else if (!allNamePredecessor) {
        fail(
          "AC-3",
          `at least one step's blockedReason does not name its predecessor: ${laterSteps.map((t) => `ord ${t.chainOrd}: ${JSON.stringify(t.blockedReason)}`).join("; ")}`,
        );
      } else {
        pass(
          "AC-3",
          `step 1 carries no blockedReason; steps 2..9 each name their predecessor (e.g. ord 2: "${laterSteps[0].blockedReason}")`,
        );
      }
    }
  }

  // ── AC-11 · a running chain ignores template edits ─────────────────────────────────────────
  {
    const { db, projectId } = makeChainFixture("ac11");
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });

    if (!result.ok) {
      fail("AC-11", `setup: instantiate was refused: ${result.reason}`);
    } else {
      type StoredVersion = { steps: { ord: number; promptTemplate: string }[] };

      const chainBefore = getChain(db, result.chainId);
      const versionBefore = chainBefore ? parseJsonColumn<StoredVersion>(chainBefore.templateVersionJson) : null;
      const step3Original = versionBefore?.steps.find((s) => s.ord === 3)?.promptTemplate;

      // Edit the seeded TemplateStep row directly — the same class of raw-SQL fixture
      // manipulation AC-0a already uses. There is no production write accessor for editing a
      // TemplateStep (T2 is restricted to read accessors in db.ts, and one should not be added
      // only to serve this test).
      const template = getTemplateBySlug(db, projectId, COMPOUND_ENGINEER_TEMPLATE.slug);
      db.prepare("UPDATE TemplateStep SET promptTemplate = ?, name = ? WHERE templateId = ? AND ord = 3").run(
        "EDITED AFTER INSTANTIATE — must never reach a running chain",
        "Edited step name",
        template?.id ?? "",
      );
      const step3Edited = template
        ? listTemplateSteps(db, template.id).find((s) => s.ord === 3)?.promptTemplate
        : undefined;

      const chainAfter = getChain(db, result.chainId);
      const versionAfter = chainAfter ? parseJsonColumn<StoredVersion>(chainAfter.templateVersionJson) : null;
      const step3AfterEdit = versionAfter?.steps.find((s) => s.ord === 3)?.promptTemplate;

      if (!versionBefore) {
        fail("AC-11", "setup: could not read the chain's templateVersionJson after instantiate");
      } else if (step3Edited === step3Original) {
        fail("AC-11", "setup: the direct SQL edit did not change the TemplateStep row — this check would prove nothing");
      } else if (versionAfter?.steps.length !== 9) {
        fail("AC-11", `chain's stored step count changed after editing the template: expected 9, got ${versionAfter?.steps.length}`);
      } else if (step3AfterEdit !== step3Original) {
        fail("AC-11", `the chain's stored step 3 prompt changed after the template was edited: ${JSON.stringify(step3AfterEdit)}`);
      } else {
        pass(
          "AC-11",
          "editing the seeded template's step 3 after instantiate left the chain's stored prompts and step count unchanged",
        );
      }
    }
  }

  // ── AC-4 · advance goes through the funnel ────────────────────────────────────────────────
  await (async () => {
    const { db, projectId } = makeChainFixture("ac4");
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });
    if (!result.ok) {
      fail("AC-4", `setup: instantiate was refused: ${result.reason}`);
      return;
    }
    const tasks = listTasksByChain(db, result.chainId);
    const step1 = tasks.find((t) => t.chainOrd === 1)!;
    const step2 = tasks.find((t) => t.chainOrd === 2)!;
    const runner = new FakeRunner({ messages: [] });

    // Step 1 is gated (§3.1's seeded template) — a human closes it directly, mirroring
    // `approveDoneForSlug`'s own body (`writeTaskTransition` to 'done', then the advance hook).
    await humanApprove(db, step1.id, runner);

    const sessions = listSessionsByTask(db, step2.id);
    if (sessions.length !== 1) {
      fail("AC-4", `expected exactly 1 session dispatched for step 2, got ${sessions.length}`);
    } else if (sessions[0].triggerKind !== "chain") {
      // Asserting the trigger kind, not merely that a session appeared (docs/specs/stage-4-
      // tickets.md T3) — a second, unrelated dispatch path could pass the weaker check.
      fail("AC-4", `session's triggerKind is '${sessions[0].triggerKind}', expected 'chain'`);
    } else {
      pass(
        "AC-4",
        `marking step 1 done dispatched step 2 with trigger 'chain' (session ${sessions[0].id.slice(0, 8)})`,
      );
    }
  })();

  // ── AC-4b (not spec-numbered) · the two actions.ts call sites actually wire the hook ───────
  // A minimal, hand-built 2-step chain — not the seeded template, because this check is about
  // wiring at the `moveTaskForSlug`/`approveDoneForSlug` call sites (AC-1 already covers the
  // template's own shape). This is the one place in this file that pays `resolveOwnedTask` ->
  // `boardOnce`'s real-project-scan cost, on purpose, exactly twice — everything else drives
  // `advanceChainAfterDone` directly, per docs/specs/stage-4-tickets.md's "no new test seam."
  await (async () => {
    const { db, projectId, slug } = makeChainFixture("ac4b", { registerInBoard: true });
    const agentRow = createAgent(db, {
      projectId,
      name: "wiring-agent",
      monogram: "WA",
      model: "claude-opus-5",
      rolePrompt: "r",
      allowedTools: [],
      disallowedTools: [],
      canCommit: false,
    });
    // `Chain.templateId` is a real foreign key (`REFERENCES TaskTemplate(id)`) — `makeChainFixture`
    // already seeded the built-in template, so reuse its id rather than inventing one.
    const seededTemplateId = getTemplateBySlug(db, projectId, COMPOUND_ENGINEER_TEMPLATE.slug)!.id;

    const chain = createChain(db, {
      projectId,
      templateId: seededTemplateId,
      templateVersion: { template: { id: seededTemplateId }, steps: [] },
      variables: {},
    });
    const dragStep1 = createTask(db, {
      projectId,
      name: "drag-step-1",
      description: "d",
      approvalGate: false,
      assigneeAgentId: agentRow.id,
      chainId: chain.id,
      chainOrd: 1,
    });
    const dragStep2 = createTask(db, {
      projectId,
      name: "drag-step-2",
      description: "d",
      approvalGate: false,
      assigneeAgentId: agentRow.id,
      chainId: chain.id,
      chainOrd: 2,
    });

    const runner = new FakeRunner({ messages: [] });

    // moveTaskForSlug — a hand-dragged card, ungated, straight to 'done'.
    const moveResult = await moveTaskForSlug(slug, dragStep1.id, "done", { db, runner });
    const sessionsAfterMove = listSessionsByTask(db, dragStep2.id);

    // approveDoneForSlug — a second, independent chain in the same project, closed via the
    // approve button instead of a drag.
    const chain2 = createChain(db, {
      projectId,
      templateId: seededTemplateId,
      templateVersion: { template: { id: seededTemplateId }, steps: [] },
      variables: {},
    });
    const approveStep1 = createTask(db, {
      projectId,
      name: "approve-step-1",
      description: "d",
      approvalGate: true,
      assigneeAgentId: agentRow.id,
      chainId: chain2.id,
      chainOrd: 1,
    });
    const approveStep2 = createTask(db, {
      projectId,
      name: "approve-step-2",
      description: "d",
      approvalGate: false,
      assigneeAgentId: agentRow.id,
      chainId: chain2.id,
      chainOrd: 2,
    });
    const approveResult = await approveDoneForSlug(slug, approveStep1.id, { db, runner });
    const sessionsAfterApprove = listSessionsByTask(db, approveStep2.id);

    if (!moveResult.ok) {
      fail("AC-4b", `setup: moveTaskForSlug refused the drag to 'done': ${moveResult.reason}`);
    } else if (sessionsAfterMove.length !== 1 || sessionsAfterMove[0].triggerKind !== "chain") {
      fail(
        "AC-4b",
        `moveTaskForSlug did not advance the chain: ${sessionsAfterMove.length} session(s) for the next step`,
      );
    } else if (!approveResult.ok) {
      fail("AC-4b", `setup: approveDoneForSlug refused: ${approveResult.reason}`);
    } else if (sessionsAfterApprove.length !== 1 || sessionsAfterApprove[0].triggerKind !== "chain") {
      fail(
        "AC-4b",
        `approveDoneForSlug did not advance the chain: ${sessionsAfterApprove.length} session(s) for the next step`,
      );
    } else {
      pass(
        "AC-4b",
        "both moveTaskForSlug (a drag to 'done') and approveDoneForSlug (the approve button) advanced their chain with trigger 'chain'",
      );
    }
  })();

  // ── AC-5 · the gate stops the chain, not just the card ────────────────────────────────────
  // A minimal fixture (project/agent/chain/two tasks/a live session on step 1), mirroring
  // `verify-stage3.mts`'s own AC-4/AC-5 fixture shape: the fake does not simulate SDK tool
  // dispatch, so calling the handler directly is the only way to assert which layer refused.
  {
    const db = openDb(":memory:");
    const project = createProject(db, {
      slug: "stage4-t3-ac5-fixture",
      primaryRepoPath: "/nonexistent/repo",
      yamlPath: "/nonexistent/repo/agentos.yml",
    });
    const agent = createAgent(db, {
      projectId: project.id,
      name: "AC-5 Fixture Agent",
      monogram: "FA",
      model: "claude-opus-5",
      rolePrompt: "test fixture agent",
      allowedTools: [],
      disallowedTools: [],
      canCommit: false,
    });
    // `Chain.templateId` is a real foreign key (`REFERENCES TaskTemplate(id)`) — a minimal
    // hand-built template row, not the seeded one, since this fixture never calls instantiate.
    const template = createTemplate(db, {
      projectId: project.id,
      slug: "hand-built-ac5",
      name: "hand-built-ac5",
      description: "AC-5 fixture template",
      variables: [],
      seeded: false,
      steps: [],
    });
    const chain = createChain(db, {
      projectId: project.id,
      templateId: template.template.id,
      templateVersion: { template: { id: template.template.id }, steps: [] },
      variables: {},
    });
    const step1 = createTask(db, {
      projectId: project.id,
      name: "gated step",
      description: "exercises the AC-5 gate",
      approvalGate: true,
      assigneeAgentId: agent.id,
      chainId: chain.id,
      chainOrd: 1,
    });
    const step2 = createTask(db, {
      projectId: project.id,
      name: "next step",
      description: "must never see a session",
      approvalGate: false,
      assigneeAgentId: agent.id,
      chainId: chain.id,
      chainOrd: 2,
    });
    const session = createSession(db, {
      taskId: step1.id,
      agentId: agent.id,
      triggerKind: "manual",
      worktreePath: "/nonexistent/worktree",
      baseRef: "main",
      pid: process.pid,
      bootId: "stage4-t3-ac5-boot",
      driftAtSpawn: {
        severity: "in-sync",
        claim: "fixture",
        verified: "fixture",
        source: "fixture",
        check: "fixture",
        checkedAtISO: new Date().toISOString(),
      },
    });
    writeTaskTransition(db, {
      taskId: step1.id,
      toStatus: "doing",
      actorType: "session",
      actorId: session.id,
      reason: "setup — mirrors dispatch's own todo->doing",
    });

    const ctx = { db, sessionId: session.id, taskId: step1.id };
    const result = await createTaskUpdateStatusTool(ctx).handler({ status: "done" }, {} as never);
    const step1After = getTask(db, step1.id)!;
    const sessionsForStep2 = listSessionsByTask(db, step2.id);

    if ((result as { isError?: boolean }).isError !== true) {
      fail("AC-5", `a session's task_update_status('done') on a gated step was not refused: ${JSON.stringify(result)}`);
    } else if (step1After.status !== "doing") {
      fail("AC-5", `step 1 moved despite the gate: status is now '${step1After.status}'`);
    } else if (sessionsForStep2.length !== 0) {
      // The point of AC-5, per docs/specs/stage-4-tickets.md T3: Stage 3 already proved the card
      // does not move; this proves nothing downstream started either.
      fail("AC-5", `the gate stopped the card but not the chain: ${sessionsForStep2.length} session(s) exist for step 2`);
    } else {
      pass(
        "AC-5",
        "a session's task_update_status('done') on a gated step 1 was refused, and step 2 has no session row — the gate stops the chain, not just the card",
      );
    }
  }

  // ── AC-7 · a human step refuses dispatch, and does not fall through to the default agent ──
  await (async () => {
    const { db, projectId } = makeChainFixture("ac7", { setDefaultAgent: true });
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });
    if (!result.ok) {
      fail("AC-7", `setup: instantiate was refused: ${result.reason}`);
      return;
    }
    const tasks = listTasksByChain(db, result.chainId);
    const runner = new FakeRunner({ messages: [] });

    // Steps 1..8 by hand — §7.6 permits a human to move any card any->any; the point under test
    // is step 9, not how the earlier steps individually reach 'done'.
    for (let ord = 1; ord <= 8; ord++) {
      const t = tasks.find((x) => x.chainOrd === ord)!;
      await humanApprove(db, t.id, runner);
    }

    const step9 = tasks.find((x) => x.chainOrd === 9)!;
    const step9After = getTask(db, step9.id)!;
    const chainAfter = getChain(db, result.chainId);
    const sessionsForStep9 = listSessionsByTask(db, step9.id);

    // Also assert dispatch's own refusal directly (the literal wording AC-7 asks for), against
    // the same fixture — step 9 is still 'todo' and has no live session, so this is a legitimate
    // second call, not a re-dispatch of something already running.
    const direct = await dispatch(step9.id, "chain", { db, runner });

    if (step9.assigneeAgentId !== null) {
      fail("AC-7", `setup: step 9's assigneeAgentId should be null (human-only), got ${step9.assigneeAgentId}`);
    } else if (direct.started) {
      fail("AC-7", "dispatch started a session for the human-only step 9 despite Project.defaultAgentId being set");
    } else if (direct.refusedBy !== "agent" || !direct.reason.includes("human-only")) {
      fail("AC-7", `dispatch's refusal did not name the human-only assignee: refusedBy='${direct.refusedBy}', reason=${JSON.stringify(direct.reason)}`);
    } else if (sessionsForStep9.length !== 0) {
      fail("AC-7", `advancing the chain past step 8 wrote a session for the human-only step 9: ${sessionsForStep9.length} session(s)`);
    } else if (step9After.status !== "todo") {
      fail("AC-7", `step 9 is not 'todo': '${step9After.status}'`);
    } else if (chainAfter?.status !== "running") {
      // §3.5: "a human-only step ends the chain's automation, not the chain." A judgment call —
      // see the T3 report — since this AC's own text does not assert Chain.status either way.
      fail("AC-7", `the chain halted on a human-only refusal instead of staying 'running': got '${chainAfter?.status}'`);
    } else {
      pass(
        "AC-7",
        `Project.defaultAgentId set to a real agent; dispatch on step 9 wrote no session (refused: ${JSON.stringify(direct.reason)}), and the chain stayed 'running'`,
      );
    }
  })();

  // ── AC-8 · failure halts and attributes ───────────────────────────────────────────────────
  await (async () => {
    const { db, projectId } = makeChainFixture("ac8");
    const result = instantiateTemplate({
      db,
      projectId,
      templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug,
      variables: FULL_VARS,
    });
    if (!result.ok) {
      fail("AC-8", `setup: instantiate was refused: ${result.reason}`);
      return;
    }
    const tasks = listTasksByChain(db, result.chainId);
    const goodRunner = new FakeRunner({ messages: [] });
    // Throws right after its one scripted message is delivered — the runner step 4's own advance
    // dispatches step 5 with, so step 5's run is the one that fails (spec finding (c), §3.1: the
    // throw happens after a message is yielded, never before any).
    const failingRunner = new FakeRunner({
      messages: [initMessage("ac8-step5-fake-sdk-session") as never],
      throwAfterIndex: 0,
      error: new Error("scripted failure for AC-8"),
    });

    // Steps 1..3 by hand, with the good runner — dispatches (and cleanly completes) steps 2, 3, 4.
    for (let ord = 1; ord <= 3; ord++) {
      const t = tasks.find((x) => x.chainOrd === ord)!;
      await humanApprove(db, t.id, goodRunner);
    }
    // Step 4, with the FAILING runner — its own advance dispatches step 5, and step 5's run throws.
    const step4 = tasks.find((x) => x.chainOrd === 4)!;
    await humanApprove(db, step4.id, failingRunner);

    const step5 = tasks.find((x) => x.chainOrd === 5)!;
    const step6 = tasks.find((x) => x.chainOrd === 6)!;
    const sessionsForStep5 = listSessionsByTask(db, step5.id);
    if (sessionsForStep5.length !== 1) {
      fail("AC-8", `setup: expected exactly 1 session dispatched for step 5, got ${sessionsForStep5.length}`);
      return;
    }
    // dispatch()'s own failure handling (and the T3 hook alongside it) runs in an unawaited
    // continuation (§7.4) — wait for it to settle before reading terminal state.
    const step5Session = await waitForSession(db, sessionsForStep5[0].id, (s) => s.status === "failed");

    const step5After = getTask(db, step5.id)!;
    const step6After = getTask(db, step6.id)!;
    const chainAfter = getChain(db, result.chainId);
    const sessionsForStep6 = listSessionsByTask(db, step6.id);
    // Steps 7-9's own blockedReason (set at instantiate) names their OWN immediate predecessor
    // (6, 7, 8 respectively) — instantiateTemplate's logic is T2's, unchanged by this ticket — so
    // only step 6 (the one immediately downstream of the failure) is checked for naming "step 5"
    // by text; steps 7-9 are checked only for remaining blocked (non-null), which is what "steps
    // 6-9 still blocked" actually requires once the reason chain is read one hop at a time.
    const laterOrds = [7, 8, 9];
    const laterStillBlocked = laterOrds.every((ord) => {
      const t = getTask(db, tasks.find((x) => x.chainOrd === ord)!.id)!;
      return typeof t.blockedReason === "string" && t.blockedReason.length > 0;
    });

    if (step5Session.status !== "failed") {
      fail("AC-8", `step 5's session did not end 'failed': got '${step5Session.status}'`);
    } else if (step5After.status !== "todo") {
      fail("AC-8", `step 5's task is not back in 'todo': got '${step5After.status}' (TaskStatus has no 'failed' — the Session carries that)`);
    } else if (chainAfter?.status !== "halted") {
      fail("AC-8", `Chain.status is not 'halted': got '${chainAfter?.status}'`);
    } else if (chainAfter.haltedAtTaskId !== step5.id) {
      fail("AC-8", `Chain.haltedAtTaskId is not step 5: got '${chainAfter.haltedAtTaskId}'`);
    } else if (typeof step6After.blockedReason !== "string" || !step6After.blockedReason.includes("step 5")) {
      fail("AC-8", `step 6's blockedReason does not name step 5: ${JSON.stringify(step6After.blockedReason)}`);
    } else if (!laterStillBlocked) {
      fail("AC-8", "steps 7-9 do not all still carry a blockedReason");
    } else if (sessionsForStep6.length !== 0) {
      fail("AC-8", `no session should exist for step 6, found ${sessionsForStep6.length}`);
    } else {
      pass(
        "AC-8",
        `step 5's session 'failed', its task is back in 'todo', Chain.status is 'halted' at step 5, steps 6-9 remain blocked (step 6: "${step6After.blockedReason}"), and no session exists for step 6`,
      );
    }
  })();

  // ── AC-10 · a step runs at most once per chain ────────────────────────────────────────────
  // Two SEPARATE chain instances (not two calls against the same one): the race half must
  // contest an ord neither caller has ever claimed before, or the two calls are racing against
  // an already-settled claim and the check would pass even without the atomic guard. Caught in
  // review of this ticket's own draft: an earlier version reused the sequential section's chain
  // for the race section too, which stayed green under a deliberately re-introduced read-then-
  // write sin because `lastDispatchedOrd` was already 2 by the time the "race" ran.
  await (async () => {
    const { db, projectId } = makeChainFixture("ac10");
    const runner = new FakeRunner({ messages: [] });

    function instantiate(): { step1Id: string; step2Id: string } {
      const result = instantiateTemplate({ db, projectId, templateSlug: COMPOUND_ENGINEER_TEMPLATE.slug, variables: FULL_VARS });
      if (!result.ok) throw new Error(`setup: instantiate was refused: ${result.reason}`);
      const tasks = listTasksByChain(db, result.chainId);
      return { step1Id: tasks.find((t) => t.chainOrd === 1)!.id, step2Id: tasks.find((t) => t.chainOrd === 2)!.id };
    }

    // Sequential re-issue: approve step 1 once, then advance again for the same predecessor —
    // §7.6 permits a human to move a card any->any, so 'done'->'done' is not itself refused, and
    // the guard under test is entirely inside `advanceChainAfterDone`'s atomic claim.
    const reissue = instantiate();
    writeTaskTransition(db, { taskId: reissue.step1Id, toStatus: "done", actorType: "human", actorId: "owner", reason: "approved (test)" });
    await advanceChainAfterDone(reissue.step1Id, { db, runner });
    await advanceChainAfterDone(reissue.step1Id, { db, runner });
    const sessionsAfterReissue = listSessionsByTask(db, reissue.step2Id);

    // Racing: a FRESH chain, so ord 2 has never been claimed — two advances fired without
    // awaiting one before the other starts.
    const race = instantiate();
    writeTaskTransition(db, { taskId: race.step1Id, toStatus: "done", actorType: "human", actorId: "owner", reason: "approved (test)" });
    await Promise.all([
      advanceChainAfterDone(race.step1Id, { db, runner }),
      advanceChainAfterDone(race.step1Id, { db, runner }),
    ]);
    const sessionsAfterRace = listSessionsByTask(db, race.step2Id);

    if (sessionsAfterReissue.length !== 1) {
      fail("AC-10", `re-issuing the done transition on step 1 produced ${sessionsAfterReissue.length} session(s) for step 2, expected 1`);
    } else if (sessionsAfterRace.length !== 1) {
      fail("AC-10", `racing two advances against a never-before-claimed step produced ${sessionsAfterRace.length} session(s), expected 1`);
    } else {
      pass(
        "AC-10",
        "advancing from step 1 twice sequentially, then racing two fresh advances against each other, left exactly 1 session for step 2 — the atomic lastDispatchedOrd claim held",
      );
    }
  })();
}

try {
  await runChecks();
} catch (err) {
  fail("suite", `a check threw instead of reporting — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  for (const t of TEMPS) rmSync(t, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll Stage 4 acceptance criteria pass (T1 + T2 + T3).\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
