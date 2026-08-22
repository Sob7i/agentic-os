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
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  openDb,
  createProject,
  createAgent,
  getAgent,
  getChain,
  getTask,
  getTemplateBySlug,
  listTasksByChain,
  listTasksByProject,
  listTemplateSteps,
  listTemplatesByProject,
  parseJsonColumn,
} from "../lib/agentos/db";
import { seedBuiltInTemplates } from "../lib/agentos/templates/seed";
import { COMPOUND_ENGINEER_TEMPLATE } from "../lib/agentos/templates/compound-engineer";
import { instantiateTemplate } from "../lib/agentos/chain";

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
 */
function makeChainFixture(
  name: string,
  opts: { missingAgentName?: string } = {},
): { db: DatabaseSync; dir: string; projectId: string } {
  const dir = mkdtempSync(join(tmpdir(), `agentic-os-stage4-chain-${name}-`));
  TEMPS.push(dir);
  writeFileSync(join(dir, "agentos.yml"), "");

  const db = openDb(tempDbPath(`chain-${name}`));
  const project = createProject(db, {
    slug: `t2-${name}`,
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });

  for (const agentName of TEMPLATE_AGENT_NAMES) {
    if (agentName === opts.missingAgentName) continue;
    createAgent(db, {
      projectId: project.id,
      name: agentName,
      monogram: agentName.slice(0, 2).toUpperCase(),
      model: "claude-opus-5",
      rolePrompt: `You are ${agentName}.`,
      allowedTools: [],
      disallowedTools: [],
      canCommit: false,
    });
  }

  seedBuiltInTemplates(db, project.id);
  return { db, dir, projectId: project.id };
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

console.log("\nStage 4 acceptance — schema and seed (T1), instantiate all-or-nothing (T2)\n");

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
}

try {
  runChecks();
} catch (err) {
  fail("suite", `a check threw instead of reporting — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  for (const t of TEMPS) rmSync(t, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll Stage 4 acceptance criteria pass (T1 + T2).\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
