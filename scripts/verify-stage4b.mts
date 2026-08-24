/**
 * AC-0a, AC-1, AC-2, AC-3, AC-4, AC-13, AC-14, AC-15 from docs/specs/stage-4b-tickets.md T1 — the
 * branch, the declared base ref, and migration 4 — as runnable checks. T2/T3/T4's checks (AC-5…
 * AC-12, AC-16) are NOT here yet; they append to this same file, the same way `verify-stage4.mts`
 * grew across its own four tickets (its own header comment: "T1 + T2 + T3 + T4").
 *
 * Fixture-based; the model is never called. A real bare-metal git repo in a temp dir for every
 * worktree/branch check (there is no fake for git — Stage 3 §9's own argument), and an in-memory
 * or fresh-temp-file SQLite db per check. Never `data/agentos.sqlite`, never a watched project.
 * Style, PASS/FAIL format and exit-code behaviour match `scripts/verify-stage4.mts`.
 *
 * AC-13's migration-additivity fixture copies migrations 1, 2 and 3's SQL verbatim from
 * `lib/agentos/db.ts`'s own (unexported) `MIGRATIONS` array — `verify-stage4.mts`'s own
 * `MIGRATION_1_SQL` convention, restated here for the migration this ticket adds (4, not 3 —
 * `docs/specs/stage-4b-tickets.md`'s inherited fact 1; migration 3 already exists, Stage 4's
 * `TaskTemplate` de-dup index).
 *
 * Run: pnpm verify:stage4b
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BetaMessage, BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { createAgent, createProject, createTask, getSession, openDb } from "../lib/agentos/db";
import { dispatch, resolveBaseRef, resumeSession } from "../lib/agentos/dispatch";
import { slugify, sessionBranchName } from "../lib/agentos/slug";
import { createInboxAskTool } from "../lib/agentos/mcp/inbox-server";
import { INBOX_ASK, INBOX_SERVER, qualify } from "../lib/agentos/mcp/names";
import { FakeRunner } from "../lib/agentos/runner/fake";
import type { RunOutcome, RunParams, Runner } from "../lib/agentos/runner/runner";
import type { SessionRow } from "../lib/agentos/types";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

console.log("\nStage 4b acceptance — the branch, the declared base ref, and migration 4 (T1)\n");

// ---------------------------------------------------------------------------
// Fixtures — a real git repo in a temp dir per check, a fresh db per check, one cleanup sweep
// ---------------------------------------------------------------------------

const TEMPS: string[] = [];

function tempDbPath(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `agentic-os-stage4b-${name}-`));
  TEMPS.push(dir);
  return join(dir, "agentos.sqlite");
}

function makeFixtureRepo(): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-stage4b-fixture-"));
  TEMPS.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  writeFileSync(join(dir, "agentos.yml"), "project: fixture\n");
  writeFileSync(join(dir, "README.md"), "# stage 4b fixture\n");
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
  return { dir };
}

/** Creates `branchName` with one extra commit beyond the repo's current tip, then returns to
 *  whatever branch was checked out before — so the repo's OWN checkout never moves, only the
 *  named branch diverges from it. Returns the new branch's sha. */
function addDivergentBranch(dir: string, branchName: string, fileName: string): string {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  const startingBranch = git("branch", "--show-current").trim();
  git("checkout", "-q", "-b", branchName);
  writeFileSync(join(dir, fileName), `# ${branchName}\n`);
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", `${branchName} commit`);
  const sha = git("rev-parse", "HEAD").trim();
  git("checkout", "-q", startingBranch);
  return sha;
}

/** Absolute paths of every registered worktree, main checkout included — `verify-stage3.mts`'s
 *  own helper of the same shape, copied rather than imported (each `verify-stage*.mts` owns its
 *  own fixture family). */
function worktreePaths(repoDir: string): string[] {
  const out = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: repoDir, encoding: "utf8" });
  return out
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

function branchLines(repoDir: string): string[] {
  return execFileSync("git", ["branch", "--list", "agentos/*"], { cwd: repoDir, encoding: "utf8" })
    .split("\n")
    .map((l) => l.replace(/^\*?\s+/, "").trim())
    .filter(Boolean);
}

function makeProject(db: ReturnType<typeof openDb>, repoDir: string) {
  return createProject(db, {
    slug: `fixture-${randomUUID()}`,
    primaryRepoPath: repoDir,
    yamlPath: join(repoDir, "agentos.yml"),
    maxConcurrentSessions: 4,
  });
}

function makeAgent(db: ReturnType<typeof openDb>, project: ReturnType<typeof createProject>) {
  return createAgent(db, {
    projectId: project.id,
    name: "Fixture Agent",
    monogram: "FA",
    model: "claude-opus-5",
    rolePrompt: "fixture agent for Stage 4b's dispatch acceptance checks",
    allowedTools: [],
    disallowedTools: [],
    canCommit: false,
  });
}

function makeTask(
  db: ReturnType<typeof openDb>,
  project: ReturnType<typeof createProject>,
  agent: ReturnType<typeof createAgent>,
  opts: { name?: string; baseRef?: string | null } = {},
) {
  return createTask(db, {
    projectId: project.id,
    name: opts.name ?? `fixture task ${randomUUID().slice(0, 8)}`,
    description: "exercises dispatch()'s Stage 4b branch/base-ref behaviour",
    approvalGate: false,
    assigneeAgentId: agent.id,
    baseRef: opts.baseRef ?? null,
  });
}

/** Copied from `verify-stage3.mts`'s own helper of the same shape and reason: `dispatch`'s
 *  unawaited continuation (§7.4) means a session's terminal fields land some time after
 *  `dispatch` (or `resumeSession`) has already returned. */
async function waitForSession(
  db: ReturnType<typeof openDb>,
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

// ---------------------------------------------------------------------------
// Scripted SDK messages — copied from `verify-stage3.mts`'s own builders, checked against the
// installed SDK's real types there once (`external-API-fields-are-guilty-until-verified`), not
// re-guessed here.
// ---------------------------------------------------------------------------

function initMessage(sessionId: string): SDKMessage {
  return {
    type: "system",
    subtype: "init",
    apiKeySource: "user",
    claude_code_version: "0.0.0-fake",
    cwd: "/tmp/agentos-fake-worktree",
    tools: ["Read", "Edit", "Bash"],
    mcp_servers: [],
    model: "claude-opus-5",
    permissionMode: "default",
    slash_commands: [],
    output_style: "default",
    skills: [],
    plugins: [],
    uuid: randomUUID(),
    session_id: sessionId,
  };
}

function usage(inputTokens: number, outputTokens: number): BetaUsage {
  return {
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    fallback_credit: null,
    inference_geo: null,
    input_tokens: inputTokens,
    iterations: null,
    output_tokens: outputTokens,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
    speed: null,
  };
}

function assistantToolUseMessage(sessionId: string, toolName: string, input: unknown): SDKMessage {
  const message: BetaMessage = {
    id: randomUUID(),
    container: null,
    content: [{ type: "tool_use", id: randomUUID(), name: toolName, input }],
    context_management: null,
    diagnostics: null,
    model: "claude-opus-5",
    role: "assistant",
    stop_details: null,
    stop_reason: "tool_use",
    stop_sequence: null,
    type: "message",
    usage: usage(120, 40),
  };
  return { type: "assistant", message, parent_tool_use_id: null, uuid: randomUUID(), session_id: sessionId };
}

function resultMessage(sessionId: string, costUsd: number): SDKMessage {
  return {
    type: "result",
    subtype: "success",
    duration_ms: 1000,
    duration_api_ms: 800,
    is_error: false,
    num_turns: 1,
    stop_reason: null,
    total_cost_usd: costUsd,
    usage: usage(500, 220),
    modelUsage: {},
    permission_denials: [],
    uuid: randomUUID(),
    session_id: sessionId,
    structured_output: undefined,
    result: "done",
  };
}

// ---------------------------------------------------------------------------
// Purpose-built runners — real commits inside the worktree the SDK never actually calls
// ---------------------------------------------------------------------------

/** Makes one real commit per message in `commitMessages`, then reports success. No pause. */
class CommittingRunner implements Runner {
  readonly calls: RunParams[] = [];
  constructor(private readonly commitMessages: string[]) {}

  async run(params: RunParams): Promise<RunOutcome> {
    this.calls.push(params);
    const sdkSessionId = randomUUID();
    await params.onMessage(initMessage(sdkSessionId));

    const id = ["-c", "user.email=t@t", "-c", "user.name=t"];
    for (const msg of this.commitMessages) {
      writeFileSync(join(params.cwd, `${msg.replace(/[^a-z0-9]+/gi, "-")}.md`), `# ${msg}\n`);
      execFileSync("git", [...id, "add", "-A"], { cwd: params.cwd });
      execFileSync("git", [...id, "commit", "-q", "-m", msg], { cwd: params.cwd });
    }

    await params.onMessage(resultMessage(sdkSessionId, 0.02));
    return { sdkSessionId, costUsd: 0.02, resultSubtype: "success" };
  }
}

/**
 * First call: commits once, then simulates the agent calling `inbox_ask` — through the REAL
 * handler (`mcp/inbox-server.ts`), the same "call the handler directly" seam Stage 3's own
 * `PausingRunner` established, since no fake in this suite simulates the SDK's own tool dispatch.
 * Second call (the resume): an ordinary clean completion.
 */
class PausingCommittingRunner implements Runner {
  readonly calls: RunParams[] = [];
  constructor(
    private readonly db: ReturnType<typeof openDb>,
    private readonly taskId: string,
    private readonly question: string,
  ) {}

  async run(params: RunParams): Promise<RunOutcome> {
    this.calls.push(params);
    // worktree.ts's own documented invariant: "<tmp>/agentos/<sessionId>" — the directory name
    // and the Session row's primary key are the same value.
    const sessionId = basename(params.cwd);
    const sdkSessionId = randomUUID();
    await params.onMessage(initMessage(sdkSessionId));

    if (this.calls.length === 1) {
      const id = ["-c", "user.email=t@t", "-c", "user.name=t"];
      writeFileSync(join(params.cwd, "before-pause.md"), "# committed before pausing\n");
      execFileSync("git", [...id, "add", "-A"], { cwd: params.cwd });
      execFileSync("git", [...id, "commit", "-q", "-m", "committed before pausing"], { cwd: params.cwd });

      await params.onMessage(
        assistantToolUseMessage(sdkSessionId, qualify(INBOX_SERVER, INBOX_ASK), { question: this.question }),
      );
      await createInboxAskTool({ db: this.db, sessionId, taskId: this.taskId }).handler(
        { question: this.question },
        {} as never,
      );
      return { sdkSessionId, costUsd: 0.01, resultSubtype: "success" };
    }

    await params.onMessage(resultMessage(sdkSessionId, 0.02));
    return { sdkSessionId, costUsd: 0.02, resultSubtype: "success" };
  }
}

// ---------------------------------------------------------------------------
// Migrations 1–3's SQL, copied verbatim from `lib/agentos/db.ts`'s own (unexported) `MIGRATIONS`
// array — `verify-stage4.mts`'s own `MIGRATION_1_SQL` convention. AC-13 needs a database that
// already holds Stage 3 AND Stage 4 rows before migration 4 ever runs, and `db.ts`'s own array
// cannot be asked to stop at version 3 — it always migrates a fresh handle all the way to 4.
// ---------------------------------------------------------------------------

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

const MIGRATION_2_SQL = `
  CREATE TABLE IF NOT EXISTS TaskTemplate (
    id            TEXT PRIMARY KEY,
    projectId     TEXT NOT NULL REFERENCES Project(id),
    slug          TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL,
    variablesJson TEXT NOT NULL,
    seeded        INTEGER NOT NULL DEFAULT 0,
    createdAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS TemplateStep (
    id                TEXT PRIMARY KEY,
    templateId        TEXT NOT NULL REFERENCES TaskTemplate(id),
    ord               INTEGER NOT NULL,
    name              TEXT NOT NULL,
    promptTemplate    TEXT NOT NULL,
    assigneeAgentName TEXT NOT NULL,
    approvalGate      INTEGER NOT NULL DEFAULT 0,
    notes             TEXT
  );

  CREATE TABLE IF NOT EXISTS Chain (
    id                  TEXT PRIMARY KEY,
    projectId           TEXT NOT NULL REFERENCES Project(id),
    templateId          TEXT NOT NULL REFERENCES TaskTemplate(id),
    templateVersionJson TEXT NOT NULL,
    variablesJson       TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('running', 'halted', 'completed')),
    haltedAtTaskId      TEXT REFERENCES Task(id),
    haltReason          TEXT,
    lastDispatchedOrd   INTEGER NOT NULL DEFAULT 0,
    createdAt           TEXT NOT NULL
  );

  ALTER TABLE Task ADD COLUMN chainId TEXT REFERENCES Chain(id);
  ALTER TABLE Task ADD COLUMN chainOrd INTEGER;

  CREATE INDEX IF NOT EXISTS idx_templatestep_template ON TemplateStep(templateId);
  CREATE INDEX IF NOT EXISTS idx_tasktemplate_project  ON TaskTemplate(projectId);
  CREATE INDEX IF NOT EXISTS idx_chain_project         ON Chain(projectId);
  CREATE INDEX IF NOT EXISTS idx_task_chain            ON Task(chainId);
`;

const MIGRATION_3_SQL = `
  UPDATE Chain SET templateId = (
    SELECT keep.id FROM TaskTemplate keep
    WHERE keep.projectId = (SELECT d.projectId FROM TaskTemplate d WHERE d.id = Chain.templateId)
      AND keep.slug      = (SELECT d.slug      FROM TaskTemplate d WHERE d.id = Chain.templateId)
    ORDER BY keep.rowid LIMIT 1
  )
  WHERE templateId IN (
    SELECT t.id FROM TaskTemplate t
    WHERE t.rowid > (
      SELECT MIN(k.rowid) FROM TaskTemplate k WHERE k.projectId = t.projectId AND k.slug = t.slug
    )
  );

  DELETE FROM TemplateStep WHERE templateId IN (
    SELECT t.id FROM TaskTemplate t
    WHERE t.rowid > (
      SELECT MIN(k.rowid) FROM TaskTemplate k WHERE k.projectId = t.projectId AND k.slug = t.slug
    )
  );

  DELETE FROM TaskTemplate WHERE rowid > (
    SELECT MIN(k.rowid) FROM TaskTemplate k
    WHERE k.projectId = TaskTemplate.projectId AND k.slug = TaskTemplate.slug
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_tasktemplate_project_slug
    ON TaskTemplate(projectId, slug);
`;

async function runChecks() {
  // ── AC-0a · the suite runs and the seams are wired ─────────────────────────────────────────
  // Structural: a fixture repo, a fixture db migrated to version 4, and a FakeRunner-shaped
  // (CommittingRunner) scripted to commit; one end-to-end dispatch settles. A broken harness
  // fails HERE, not inside AC-1.
  {
    const { dir } = makeFixtureRepo();
    const dbPath = tempDbPath("ac0a");
    const db = openDb(dbPath);
    const versionAfterOpen = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const task = makeTask(db, project, agent);
    const runner = new CommittingRunner(["ac0a change"]);
    const result = await dispatch(task.id, "manual", { db, runner });

    if (versionAfterOpen !== 4) {
      fail("AC-0a", `fixture db did not migrate to user_version 4 — got ${versionAfterOpen}`);
    } else if (!result.started) {
      fail("AC-0a", `dispatch refused: ${JSON.stringify(result)}`);
    } else {
      const session = await waitForSession(db, result.sessionId, (s) => s.endedAtISO !== null);
      if (session.status !== "completed") {
        fail("AC-0a", `session did not settle 'completed': status='${session.status}' reason=${session.failureReason ?? "none"}`);
      } else {
        pass(
          "AC-0a",
          `fixture db migrates to user_version 4; one end-to-end dispatch against a fixture repo, with a Runner that makes a real commit, settles 'completed'`,
        );
      }
    }
    db.close();
  }

  // ── AC-1 · the work is on a ref, asserted AFTER removeWorktree ─────────────────────────────
  {
    const { dir } = makeFixtureRepo();
    const baseRefSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
    const db = openDb(tempDbPath("ac1"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const task = makeTask(db, project, agent);
    const runner = new CommittingRunner(["ac1 change"]);

    const result = await dispatch(task.id, "manual", { db, runner });
    if (!result.started) {
      fail("AC-1", `dispatch refused: ${JSON.stringify(result)}`);
    } else {
      // Settling implies teardown already ran (best-effort or not) — this is the "after
      // removeWorktree" moment the spec calls out, since before it a detached HEAD would pass too.
      const session = await waitForSession(db, result.sessionId, (s) => s.endedAtISO !== null);
      if (!session.branchName) {
        fail("AC-1", "session recorded no branchName");
      } else {
        const names = branchLines(dir);
        const rangeLog = execFileSync("git", ["log", `${baseRefSha}..${session.branchName}`, "--format=%H"], {
          cwd: dir,
          encoding: "utf8",
        })
          .trim()
          .split("\n")
          .filter(Boolean);
        if (!names.includes(session.branchName)) {
          fail("AC-1", `'git branch --list agentos/*' does not name ${session.branchName}: ${JSON.stringify(names)}`);
        } else if (rangeLog.length !== 1) {
          fail("AC-1", `expected exactly 1 commit on ${session.branchName} beyond the base — 'git log ${baseRefSha.slice(0, 8)}..${session.branchName}' gave ${JSON.stringify(rangeLog)}`);
        } else {
          pass(
            "AC-1",
            `session ${result.sessionId.slice(0, 8)}'s work landed on '${session.branchName}', which survives teardown and contains the commit (asserted after removeWorktree, via an independent 'git log')`,
          );
        }
      }
    }
    db.close();
  }

  // ── AC-2 · an empty run leaves no ref, and no stale 'git worktree list' entry ──────────────
  {
    const { dir } = makeFixtureRepo();
    const db = openDb(tempDbPath("ac2"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const task = makeTask(db, project, agent);
    const runner = new FakeRunner({ messages: [] });

    const result = await dispatch(task.id, "manual", { db, runner });
    if (!result.started) {
      fail("AC-2", `dispatch refused: ${JSON.stringify(result)}`);
    } else {
      const session = await waitForSession(db, result.sessionId, (s) => s.endedAtISO !== null);
      const names = branchLines(dir);
      const expectedWtPath = join(realpathSync(tmpdir()), "agentos", result.sessionId);
      const wtList = worktreePaths(dir);
      const branchGone = !session.branchName || !names.includes(session.branchName);
      const noStaleEntry = !wtList.includes(expectedWtPath);

      if (!branchGone) {
        fail("AC-2", `a run that committed nothing left a branch behind: '${session.branchName}' — 'git branch --list agentos/*' shows ${JSON.stringify(names)}`);
      } else if (!noStaleEntry) {
        fail("AC-2", `'git worktree list' still shows the empty run's worktree: ${expectedWtPath}`);
      } else {
        pass("AC-2", "a run that committed nothing left no 'agentos/*' branch and no stale 'git worktree list' entry");
      }
    }
    db.close();
  }

  // ── AC-3 [G] · the base is declared, never the owner's checkout ───────────────────────────
  // Guard proven by hand during development: reverting dispatch.ts's precondition 5 to the old
  // `const BASE_REF = "HEAD"` makes this assert the CHECKED-OUT branch's sha instead of Y's,
  // which fails the equality below — see the T1 report for the exact red output observed.
  {
    const { dir } = makeFixtureRepo(); // checked out on 'main' == X
    const ySha = addDivergentBranch(dir, "release", "release-only.md"); // Y = 'release', diverged
    const xSha = execFileSync("git", ["rev-parse", "main"], { cwd: dir, encoding: "utf8" }).trim();
    const db = openDb(tempDbPath("ac3"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const task = makeTask(db, project, agent, { baseRef: "release" });
    const runner = new FakeRunner({ messages: [] });

    // The pure half: resolveBaseRef itself, no git involved.
    const pureResolved = resolveBaseRef({ baseRef: "release" }, { defaultBaseRef: null, integrationBranch: null });

    const result = await dispatch(task.id, "manual", { db, runner });
    if (pureResolved !== "release") {
      fail("AC-3", `resolveBaseRef({baseRef:'release'}, ...) returned '${pureResolved}', expected 'release'`);
    } else if (!result.started) {
      fail("AC-3", `dispatch refused: ${JSON.stringify(result)}`);
    } else {
      const session = await waitForSession(db, result.sessionId, (s) => s.endedAtISO !== null);
      if (session.baseRef !== ySha) {
        fail(
          "AC-3",
          `expected the worktree's base sha to be 'release's own (${ySha.slice(0, 8)}) — got ${session.baseRef.slice(0, 8)}, ` +
            `which is ${session.baseRef === xSha ? "'main' (the checked-out branch) — the exact regression this guard exists for" : "neither"}`,
        );
      } else {
        pass(
          "AC-3",
          `task.baseRef='release' resolved to release's own sha ${ySha.slice(0, 8)}, not the checked-out branch main's ${xSha.slice(0, 8)}`,
        );
      }
    }
    db.close();
  }

  // ── AC-4 · stacking — task B names task A's branch as baseRef ─────────────────────────────
  {
    const { dir } = makeFixtureRepo();
    const db = openDb(tempDbPath("ac4"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);

    const taskA = makeTask(db, project, agent, { name: "step A" });
    const runnerA = new CommittingRunner(["A's change"]);
    const resultA = await dispatch(taskA.id, "manual", { db, runner: runnerA });

    if (!resultA.started) {
      fail("AC-4", `setup: dispatching task A refused: ${JSON.stringify(resultA)}`);
    } else {
      const sessionA = await waitForSession(db, resultA.sessionId, (s) => s.endedAtISO !== null);
      if (!sessionA.branchName) {
        fail("AC-4", "setup: task A's session recorded no branchName");
      } else {
        const aTipSha = execFileSync("git", ["rev-parse", sessionA.branchName], { cwd: dir, encoding: "utf8" }).trim();
        const taskB = makeTask(db, project, agent, { name: "step B", baseRef: sessionA.branchName });
        const runnerB = new CommittingRunner(["B's change"]);
        const resultB = await dispatch(taskB.id, "manual", { db, runner: runnerB });

        if (!resultB.started) {
          fail("AC-4", `dispatching task B (baseRef = task A's branch) refused: ${JSON.stringify(resultB)}`);
        } else {
          const sessionB = await waitForSession(db, resultB.sessionId, (s) => s.endedAtISO !== null);
          const branchB = sessionB.branchName;
          if (!branchB) {
            fail("AC-4", "task B's session recorded no branchName");
          } else {
            // Ground truth, independent of anything the code under test recorded.
            const ancestorCheck = spawnSync("git", ["merge-base", "--is-ancestor", aTipSha, branchB], {
              cwd: dir,
              stdio: "ignore",
            });
            const bContainsA = ancestorCheck.status === 0;
            const rangeLog = execFileSync("git", ["log", `${aTipSha}..${branchB}`, "--format=%H"], {
              cwd: dir,
              encoding: "utf8",
            })
              .trim()
              .split("\n")
              .filter(Boolean);
            const rangeExcludesA = !rangeLog.includes(aTipSha);
            const rangeIsExactlyOne = rangeLog.length === 1;
            const baseRefResolvedToATip = sessionB.baseRef === aTipSha;

            if (!bContainsA || !rangeExcludesA || !rangeIsExactlyOne || !baseRefResolvedToATip) {
              fail(
                "AC-4",
                `stacking failed — bContainsA=${bContainsA} rangeLog(A..B)=${JSON.stringify(rangeLog)} ` +
                  `(want exactly B's own commit, excluding A's ${aTipSha.slice(0, 8)}) sessionB.baseRef=${sessionB.baseRef?.slice(0, 8)} (want ${aTipSha.slice(0, 8)})`,
              );
            } else {
              pass(
                "AC-4",
                `task B's baseRef named task A's branch '${sessionA.branchName}'; B's worktree is based on A's tip ${aTipSha.slice(0, 8)}, ` +
                  `B's own <base>..HEAD range contains exactly B's commit and excludes A's`,
              );
            }
          }
        }
      }
    }
    db.close();
  }

  // ── AC-2b · a branch is never deleted on a FAILED commit read ──────────────────────────────
  // Ticket-level, added in review of #40. AC-2 proves the branch goes when a run genuinely
  // committed nothing. This proves the opposite case is distinguished: `readWorktreeCommits`
  // throws only when `git log` itself failed, and `worktree.ts` separates that from an empty
  // result precisely because collapsing them discards commit evidence "in the one situation where
  // it is hardest to notice." A transient git failure must not be read as "wrote nothing" and take
  // the branch — and the real commits on it — with it.
  //
  // The failure is produced for real rather than stubbed: the runner commits (so the branch has
  // genuine work on it, in the repo's object store and on the ref) and then destroys its own
  // worktree directory, which is exactly what makes the subsequent `git log` in that cwd fail.
  // ESM exports are read-only, so a monkey-patch is not available here anyway — and this is the
  // more honest simulation.
  {
    const { dir } = makeFixtureRepo();
    const db = openDb(tempDbPath("ac2b"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const task = makeTask(db, project, agent, { name: "unreadable commits" });

    class CommitThenDestroyWorktreeRunner implements Runner {
      async run(params: RunParams): Promise<RunOutcome> {
        const sdkSessionId = randomUUID();
        await params.onMessage(initMessage(sdkSessionId));
        const id = ["-c", "user.email=t@t", "-c", "user.name=t"];
        writeFileSync(join(params.cwd, "work-that-must-survive.md"), "# real work\n");
        execFileSync("git", [...id, "add", "-A"], { cwd: params.cwd });
        execFileSync("git", [...id, "commit", "-q", "-m", "work that must survive"], { cwd: params.cwd });
        // The directory goes; the commit and the branch do not — they live in the main repo.
        rmSync(params.cwd, { recursive: true, force: true });
        await params.onMessage(resultMessage(sdkSessionId, 0.01));
        return { sdkSessionId, costUsd: 0.01, resultSubtype: "success" };
      }
    }

    const result = await dispatch(task.id, "manual", { db, runner: new CommitThenDestroyWorktreeRunner() });
    if (!result.started) {
      fail("AC-2b", `setup: dispatch refused: ${JSON.stringify(result)}`);
    } else {
      const session = await waitForSession(db, result.sessionId, (s) => s.endedAtISO !== null);
      const branch = session.branchName ?? "";
      const branches = branchLines(dir);
      if (!branch) {
        fail("AC-2b", "setup: the session recorded no branchName");
      } else if (!branches.includes(branch)) {
        fail(
          "AC-2b",
          `branch '${branch}' was deleted after a FAILED commit read — a git failure was mistaken for "wrote nothing", destroying the run's own evidence`,
        );
      } else {
        const logged = execFileSync("git", ["log", branch, "--format=%s"], { cwd: dir, encoding: "utf8" });
        logged.includes("work that must survive")
          ? pass(
              "AC-2b",
              `a failed commit read kept branch '${branch}', and the commit it carries is still reachable — "the read failed" and "nothing was committed" stay distinct facts`,
            )
          : fail("AC-2b", `branch '${branch}' survived but its commit did not: ${JSON.stringify(logged)}`);
      }
    }
    db.close();
  }

  // ── AC-3b · an option-like baseRef refuses instead of resolving to something else ───────────
  // Ticket-level, added in review of #40. `baseRef` comes from a task field or `agentos.yml`, and
  // a bare `git rev-parse <ref>` reads a leading '-' as an OPTION: `git rev-parse --git-dir`
  // prints `.git` and exits 0, which passes a null check and hands `worktree add` a path where a
  // sha belongs. Demonstrated by hand before the fix; asserted here so it stays fixed.
  {
    const { dir } = makeFixtureRepo();
    const db = openDb(tempDbPath("ac3b"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const bad: string[] = ["--git-dir", "--all"];
    const failures: string[] = [];

    for (const ref of bad) {
      const task = makeTask(db, project, agent, { name: `option ref ${ref}`, baseRef: ref });
      const result = await dispatch(task.id, "manual", { db, runner: new CommittingRunner(["x"]) });
      if (result.started) {
        failures.push(`'${ref}' STARTED a session instead of refusing`);
      } else if (result.refusedBy !== "baseRef") {
        failures.push(`'${ref}' refused by '${result.refusedBy}', expected 'baseRef'`);
      }
    }

    failures.length === 0
      ? pass("AC-3b", `option-like baseRefs (${bad.join(", ")}) refuse at precondition 5 rather than resolving to a non-sha`)
      : fail("AC-3b", failures.join("; "));
    db.close();
  }

  // ── AC-13 · migration 4 is additive over a db holding Stage 3 AND Stage 4 rows ─────────────
  {
    const dbPath = tempDbPath("ac13");
    const raw = new DatabaseSync(dbPath);
    raw.exec("PRAGMA foreign_keys = ON");
    raw.exec(MIGRATION_1_SQL);
    raw.exec(MIGRATION_2_SQL);
    raw.exec(MIGRATION_3_SQL);
    raw.exec("PRAGMA user_version = 3");

    const projectId = randomUUID();
    const agentId = randomUUID();
    const taskId = randomUUID();
    const sessionId = randomUUID();
    const templateId = randomUUID();
    const nowISO = new Date().toISOString();

    raw
      .prepare(
        `INSERT INTO Project (id, slug, primaryRepoPath, yamlPath, defaultAgentId, maxConcurrentSessions, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(projectId, "ac13-project", "/tmp/ac13-fixture-does-not-need-to-exist", "/tmp/ac13-fixture-does-not-need-to-exist/agentos.yml", null, 1, nowISO);
    raw
      .prepare(
        `INSERT INTO Agent (id, projectId, name, monogram, model, rolePrompt, allowedToolsJson, disallowedToolsJson, canCommit, maxTurns, maxBudgetUsd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(agentId, projectId, "Fixer", "FX", "claude-opus-5", "Fixes things.", "[]", "[]", 0, null, null);
    raw
      .prepare(
        `INSERT INTO Task (id, projectId, name, description, status, blockedReason, approvalGate, assigneeAgentId, scheduleKind, chainId, chainOrd, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(taskId, projectId, "Pre-Stage-4b task", "Exists before migration 4 ever runs.", "todo", null, 1, agentId, "manual", null, null, nowISO);
    raw
      .prepare(
        `INSERT INTO Session (id, taskId, agentId, sdkSessionId, status, triggerKind, worktreePath, baseRef, costUsd, pid, bootId, driftAtSpawnJson, startedAtISO, endedAtISO, failureReason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(sessionId, taskId, agentId, null, "completed", "manual", null, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", 0.01, 1234, "boot-1", "{}", nowISO, nowISO, null);
    raw
      .prepare(
        `INSERT INTO TaskTemplate (id, projectId, slug, name, description, variablesJson, seeded, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(templateId, projectId, "pre-existing-template", "Pre-existing Template", "exists before migration 4", "[]", 1, nowISO);

    const beforeProject = raw.prepare("SELECT * FROM Project WHERE id = ?").get(projectId) as Record<string, unknown>;
    const beforeTask = raw.prepare("SELECT * FROM Task WHERE id = ?").get(taskId) as Record<string, unknown>;
    const beforeSession = raw.prepare("SELECT * FROM Session WHERE id = ?").get(sessionId) as Record<string, unknown>;
    const beforeTemplate = raw.prepare("SELECT * FROM TaskTemplate WHERE id = ?").get(templateId) as Record<string, unknown>;
    raw.close();

    // First migrate: a fresh handle at the same path. `openDb` applies every migration above
    // `user_version` — here, only migration 4.
    const db = openDb(dbPath);
    const versionAfterFirst = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    const afterProject = db.prepare("SELECT * FROM Project WHERE id = ?").get(projectId) as Record<string, unknown>;
    const afterTask = db.prepare("SELECT * FROM Task WHERE id = ?").get(taskId) as Record<string, unknown>;
    const afterSession = db.prepare("SELECT * FROM Session WHERE id = ?").get(sessionId) as Record<string, unknown>;
    const afterTemplate = db.prepare("SELECT * FROM TaskTemplate WHERE id = ?").get(templateId) as Record<string, unknown>;
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

    const changedKeys = (before: Record<string, unknown>, after: Record<string, unknown>) =>
      Object.keys(before).filter((k) => before[k] !== after[k]);

    const projectChanged = changedKeys(beforeProject, afterProject);
    const taskChanged = changedKeys(beforeTask, afterTask);
    const sessionChanged = changedKeys(beforeSession, afterSession);
    const templateChanged = changedKeys(beforeTemplate, afterTemplate);

    // The one exception: Project.integrationBranch is backfilled to 'develop', not left NULL —
    // D38's fallback chain ends there, so a NULL terminus would refuse every existing row's
    // dispatch the moment this migration lands (docs/specs/stage-4b-tickets.md's own note on T1).
    const newProjectColsOk = afterProject.defaultBaseRef === null && afterProject.integrationBranch === "develop";
    const newTaskColsOk = afterTask.baseRef === null;
    const newSessionColsOk =
      afterSession.branchName === null &&
      afterSession.prepareExitCode === null &&
      afterSession.prepareMs === null &&
      afterSession.verifyExitCode === null &&
      afterSession.verifyTail === null &&
      afterSession.pushedAtISO === null &&
      afterSession.prUrl === null;

    if (projectChanged.length || taskChanged.length || sessionChanged.length || templateChanged.length) {
      fail(
        "AC-13",
        `pre-existing columns changed across migration 4 — Project:${JSON.stringify(projectChanged)} Task:${JSON.stringify(taskChanged)} Session:${JSON.stringify(sessionChanged)} TaskTemplate:${JSON.stringify(templateChanged)}`,
      );
    } else if (!newProjectColsOk) {
      fail(
        "AC-13",
        `Project's new columns wrong — integrationBranch=${JSON.stringify(afterProject.integrationBranch)} (want 'develop'), defaultBaseRef=${JSON.stringify(afterProject.defaultBaseRef)} (want null)`,
      );
    } else if (!newTaskColsOk) {
      fail("AC-13", `Task.baseRef is not NULL: ${JSON.stringify(afterTask.baseRef)}`);
    } else if (!newSessionColsOk) {
      fail(
        "AC-13",
        `Session's new columns are not all NULL: ${JSON.stringify({
          branchName: afterSession.branchName,
          prepareExitCode: afterSession.prepareExitCode,
          prepareMs: afterSession.prepareMs,
          verifyExitCode: afterSession.verifyExitCode,
          verifyTail: afterSession.verifyTail,
          pushedAtISO: afterSession.pushedAtISO,
          prUrl: afterSession.prUrl,
        })}`,
      );
    } else if (versionAfterFirst !== 4) {
      fail("AC-13", `user_version did not reach 4 after the first migrate, got ${versionAfterFirst}`);
    } else if (secondError) {
      fail("AC-13", `migrating a second time threw instead of no-op'ing: ${secondError}`);
    } else if (versionAfterSecond !== versionAfterFirst) {
      fail("AC-13", `user_version moved on a second migrate — expected to stay at ${versionAfterFirst}, got ${versionAfterSecond}`);
    } else {
      pass(
        "AC-13",
        `migration 4 is additive over a db holding Stage 3 + Stage 4 rows (Project/Task/Session/TaskTemplate all byte-identical on pre-existing columns), ` +
          `every new column NULL except Project.integrationBranch backfilled to 'develop', and idempotent (user_version 3→4, unchanged on replay)`,
      );
    }
  }

  // ── AC-14 [G] · a resume attaches, and keeps the paused turn's commit ──────────────────────
  // Guard proven by hand during development: making resumeSession pass `mode: 'create'` instead
  // of `mode: 'attach'` makes `git worktree add` fail outright (the branch already exists) — see
  // the T1 report for the exact red output observed.
  {
    const { dir } = makeFixtureRepo();
    const baseRefSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
    const db = openDb(tempDbPath("ac14"));
    const project = makeProject(db, dir);
    const agent = makeAgent(db, project);
    const task = makeTask(db, project, agent);
    const runner = new PausingCommittingRunner(db, task.id, "which cloud provider?");

    const result = await dispatch(task.id, "manual", { db, runner });
    if (!result.started) {
      fail("AC-14", `setup: dispatch refused: ${JSON.stringify(result)}`);
    } else {
      const paused = await waitForSession(
        db,
        result.sessionId,
        (s) => s.status === "waiting-inbox" && s.worktreePath === null,
      );
      const branchName = paused.branchName;
      if (!branchName) {
        fail("AC-14", "setup: paused session recorded no branchName");
      } else {
        // `<base>..<branch>`, never a bare `git log <branch>` — the latter includes the base
        // commit itself (everything reachable from the branch), which would always show "2"
        // here regardless of whether the resume behaved correctly.
        const preResumeLog = execFileSync("git", ["log", `${baseRefSha}..${branchName}`, "--format=%H"], {
          cwd: dir,
          encoding: "utf8",
        })
          .trim()
          .split("\n")
          .filter(Boolean);
        const branchSurvivedPause = branchLines(dir).includes(branchName);

        if (!branchSurvivedPause || preResumeLog.length !== 1) {
          fail(
            "AC-14",
            `expected the branch to survive the pause with exactly the paused turn's own commit — branch present=${branchSurvivedPause}, log=${JSON.stringify(preResumeLog)}`,
          );
        } else {
          const firstCommitSha = preResumeLog[0];
          const firstSdkSessionId = paused.sdkSessionId;

          let resumeThrew: string | null = null;
          try {
            await resumeSession(result.sessionId, "use AWS", { db, runner });
          } catch (err) {
            resumeThrew = err instanceof Error ? err.message : String(err);
          }

          if (resumeThrew !== null) {
            fail("AC-14", `resumeSession threw instead of attaching to the existing branch: ${resumeThrew}`);
          } else {
            const settled = await waitForSession(db, result.sessionId, (s) => s.endedAtISO !== null);
            const postResumeLog = execFileSync("git", ["log", `${baseRefSha}..${branchName}`, "--format=%H"], {
              cwd: dir,
              encoding: "utf8",
            })
              .trim()
              .split("\n")
              .filter(Boolean);
            const secondCall = runner.calls[1];

            const ok =
              settled.branchName === branchName &&
              postResumeLog.includes(firstCommitSha) &&
              runner.calls.length === 2 &&
              !!secondCall &&
              secondCall.resume === firstSdkSessionId;

            if (!ok) {
              fail(
                "AC-14",
                `resume did not land on the same branch with the paused commit intact — settled.branchName=${settled.branchName} ` +
                  `(expected ${branchName}), postResumeLog=${JSON.stringify(postResumeLog)} (expected to include ${firstCommitSha}), ` +
                  `calls=${runner.calls.length}, secondCall.resume=${JSON.stringify(secondCall?.resume)} (expected ${firstSdkSessionId})`,
              );
            } else {
              pass(
                "AC-14",
                `resume attached to the same branch '${branchName}' ('git worktree add' did not fail) and the paused turn's commit ${firstCommitSha.slice(0, 8)} is still reachable from it after settling`,
              );
            }
          }
        }
      }
    }
    db.close();
  }

  // ── AC-15 · a hostile task name still produces a legal ref ────────────────────────────────
  {
    const hostileName = "  ~~Fix: the *thing* (again)!!  ";
    const punctuationOnlyName = "~~~###???";
    const hostileSlug = slugify(hostileName);
    const emptySlug = slugify(punctuationOnlyName);
    const pureOk =
      hostileSlug === "fix-the-thing-again" &&
      emptySlug === "task" &&
      sessionBranchName(hostileName, "abcdef1234567890").startsWith(`agentos/${hostileSlug}-abcdef12`);

    if (!pureOk) {
      fail(
        "AC-15",
        `pure slugify/sessionBranchName mismatch — slugify(hostile)='${hostileSlug}' (want 'fix-the-thing-again'), slugify(punctuation-only)='${emptySlug}' (want 'task')`,
      );
    } else {
      const { dir } = makeFixtureRepo();
      const db = openDb(tempDbPath("ac15"));
      const project = makeProject(db, dir);
      const agent = makeAgent(db, project);
      const hostileTask = makeTask(db, project, agent, { name: hostileName });
      const emptyTask = makeTask(db, project, agent, { name: punctuationOnlyName });

      const hostileResult = await dispatch(hostileTask.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
      const emptyResult = await dispatch(emptyTask.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });

      if (!hostileResult.started || !emptyResult.started) {
        fail("AC-15", `setup: dispatch refused — hostile=${JSON.stringify(hostileResult)} punctuation-only=${JSON.stringify(emptyResult)}`);
      } else {
        const hostileSession = getSession(db, hostileResult.sessionId)!;
        const emptySession = getSession(db, emptyResult.sessionId)!;
        const hostileBranch = hostileSession.branchName!;
        const emptyBranch = emptySession.branchName!;

        const refFormatOk = spawnSync("git", ["check-ref-format", "--branch", hostileBranch], { stdio: "ignore" }).status === 0;
        const emptyShapeOk = /^agentos\/task-[0-9a-f]{8}$/.test(emptyBranch);

        if (!refFormatOk) {
          fail("AC-15", `'${hostileBranch}' is not accepted by 'git check-ref-format --branch'`);
        } else if (!emptyShapeOk) {
          fail("AC-15", `an all-punctuation task name produced '${emptyBranch}', expected 'agentos/task-<8 hex chars>'`);
        } else {
          pass(
            "AC-15",
            `a hostile task name produced the legal ref '${hostileBranch}' ('git check-ref-format --branch' accepts it); an all-punctuation name produced '${emptyBranch}'`,
          );
        }
      }
      db.close();
    }
  }
}

try {
  await runChecks();
} catch (err) {
  fail("suite", `a check threw instead of reporting — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  for (const t of TEMPS) rmSync(t, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll Stage 4b acceptance criteria (T1) pass.\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
