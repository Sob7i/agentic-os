/**
 * AC-2, AC-9, AC-8a (worktree lifecycle, T2), AC-4, AC-5, AC-5b (the two MCP servers and the
 * gate, T4), and AC-14…AC-19 (`dispatch()` and the boot sweep, T5) from
 * docs/specs/stage-3-execution-mvp.spec.md §4, as runnable checks.
 *
 * T6 still adds AC-1, AC-3, AC-6…AC-8, AC-10…AC-13 to this file.
 *
 * AC-2/AC-9/AC-8a run against a fixture repo generated in a temp directory — never a watched
 * project. Stage 2's suite established the pattern and the reason: a test proving we can write
 * to a real repo by writing to it has destroyed what it verified. AC-2 and AC-8 exist precisely
 * to prove worktree behaviour against the real git binary (spec §9) — there is no fake for git.
 *
 * AC-4/AC-5 run against an in-memory SQLite fixture (lib/agentos/db.ts's own migrations) and call
 * the MCP tool handler and the canUseTool callback **directly** — per spec §3.3 (closed
 * 2026-08-18): "the fake does not simulate SDK tool dispatch, and does not need to... a test that
 * could only reach the handler via a permitted SDK dispatch could never demonstrate [the handler
 * refuses regardless of what let the call through]." No model, no subprocess, no MCP wire format.
 *
 * AC-14…AC-19 call the real `dispatch()` end to end, against fixture repos in a temp dir and an
 * in-memory SQLite db, with a `FakeRunner` standing in for the Agent SDK (§9's Runner seam) —
 * never a watched project, per the standing constraint in `docs/specs/stage-3-tickets.md`.
 * AC-17's drift fixture is the one place this file reaches into `lib/reconcile/` (via `boardOnce`,
 * never `buildBoard`, so `verify:stage3a`'s AC-3 stays green) — see `withOnlyProject` below for
 * how it does that without ever reconciling a real watched repo.
 *
 * Run: pnpm verify:stage3
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createWorktree, removeWorktree, withWorktree } from "../lib/agentos/worktree";
import {
  createAgent,
  createProject,
  createSession,
  createTask,
  createToolCall,
  getSession,
  getTask,
  listTaskEvents,
  listToolCallsBySession,
  openDb,
  parseJsonColumn,
  updateSession,
  writeTaskTransition,
} from "../lib/agentos/db";
import { createApprovalGate } from "../lib/agentos/mcp/gate";
import { createTaskUpdateStatusTool } from "../lib/agentos/mcp/agentos-server";
import {
  AGENTOS_SERVER,
  INBOX_ASK,
  INBOX_SERVER,
  TASK_APPEND_ACTIVITY,
  TASK_READ,
  TASK_UPDATE_STATUS,
  qualify,
} from "../lib/agentos/mcp/names";
import { dispatch, type DispatchDeps, type Precondition } from "../lib/agentos/dispatch";
import { runBootSweep } from "../lib/agentos/sweep";
import { FakeRunner } from "../lib/agentos/runner/fake";
import type { DriftAtSpawn } from "../lib/agentos/types";
import type { ProjectConfig } from "../projects.config";
import { createRequire } from "node:module";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

const TEMPS: string[] = [];

// ── Fixture ─────────────────────────────────────────────────────────────────

function makeFixtureRepo(): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-stage3-fixture-"));
  TEMPS.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });

  writeFileSync(join(dir, "README.md"), "# Stage 3 fixture\n");
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
  return { dir };
}

/** Absolute paths of every registered worktree, main checkout included. */
function worktreePaths(repoDir: string): string[] {
  const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoDir,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

const status = (dir: string) =>
  execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });

console.log("\nStage 3 acceptance — worktree lifecycle, fixture repos only\n");

// ── AC-2 · the worktree is real and ephemeral ───────────────────────────────
{
  const { dir } = makeFixtureRepo();

  const wt1 = await createWorktree(dir, "main", "stage3-session-1");
  const duringList = worktreePaths(dir);

  if (!existsSync(wt1.path)) {
    fail("AC-2", `worktree path does not exist on disk: ${wt1.path}`);
  } else if (!duringList.includes(wt1.path)) {
    fail("AC-2", `git worktree list does not show ${wt1.path}: ${JSON.stringify(duringList)}`);
  } else {
    await removeWorktree(wt1);
    const afterList = worktreePaths(dir);
    if (existsSync(wt1.path)) {
      fail("AC-2", `worktree directory survived removal: ${wt1.path}`);
    } else if (afterList.includes(wt1.path)) {
      fail("AC-2", `git worktree list still shows a removed worktree: ${wt1.path}`);
    } else {
      const wt2 = await createWorktree(dir, "main", "stage3-session-2");
      const wt2Status = status(wt2.path);
      if (wt2.path === wt1.path) {
        fail("AC-2", `second run reused the first run's path: ${wt2.path}`);
      } else if (wt2Status !== "") {
        fail("AC-2", `second run's worktree is not clean: ${JSON.stringify(wt2Status)}`);
      } else {
        pass(
          "AC-2",
          `worktree appeared during the run and vanished after; second run got a different, clean path (${wt1.path} → ${wt2.path})`,
        );
      }
      await removeWorktree(wt2);
    }
  }
}

// ── AC-9 · failure still cleans up ──────────────────────────────────────────
{
  const { dir } = makeFixtureRepo();
  const sessionId = "stage3-session-fail";
  const expectedPath = join(realpathSync(tmpdir()), "agentos", sessionId);

  let threw = false;
  try {
    await withWorktree(dir, "main", sessionId, async () => {
      throw new Error("boom — simulated mid-run failure");
    });
  } catch (err) {
    threw = err instanceof Error && err.message.includes("boom");
  }

  const listAfter = worktreePaths(dir);
  if (!threw) {
    fail("AC-9", "withWorktree swallowed the thrown error instead of propagating it");
  } else if (existsSync(expectedPath)) {
    fail("AC-9", `worktree directory survived a throw: ${expectedPath}`);
  } else if (listAfter.includes(expectedPath)) {
    fail("AC-9", `git worktree list still shows the failed run's worktree: ${expectedPath}`);
  } else {
    pass("AC-9", "a runner that throws mid-run still leaves no worktree behind, on disk or in git worktree list");
  }
}


// ── AC-8a · a failed run's commits are still recorded ───────────────────────
// Added during review of T2. `worktree remove --force` leaves any commits the run
// made unreferenced on a detached HEAD — recoverable only as `git branch <name> <sha>`
// (§3.2), and eventually gc'd. So the sha *is* the work, and a session that committed
// and then crashed is exactly when someone wants it back. Reading commits only on the
// success path discards that record at the moment it becomes hard to find.
{
  const { dir: repo } = makeFixtureRepo();
  const seen: string[][] = [];
  let threw = false;
  try {
    await withWorktree(repo, "HEAD", "stage3-session-fail", async (wtPath) => {
      writeFileSync(join(wtPath, "work.md"), "# work done before the crash\n");
      // Per-invocation identity: `-c` flags do not persist, and a machine (or CI box)
      // with no global user.name would otherwise fail here for reasons unrelated to the check.
      const id = ["-c", "user.email=t@t", "-c", "user.name=t"];
      execFileSync("git", [...id, "add", "-A"], { cwd: wtPath });
      execFileSync("git", [...id, "commit", "-m", "work committed before the failure"], { cwd: wtPath });
      throw new Error("boom — crashed after committing");
    }, (shas) => { seen.push(shas); });
  } catch {
    threw = true;
  }
  const captured = seen[0] ?? [];
  if (!threw) fail("AC-8a", "the throw did not propagate");
  else if (captured.length !== 1) fail("AC-8a", `expected 1 commit captured on the failure path, got ${captured.length}`);
  else if (!/^[0-9a-f]{40}$/.test(captured[0])) fail("AC-8a", `not a sha: ${captured[0]}`);
  else pass("AC-8a", `a run that committed and then threw still reported its sha (${captured[0].slice(0, 8)}) before teardown`);
}

// Cleanup last, after every check has created its fixtures. It used to run before AC-8a,
// which meant AC-8a's repo was left in the OS temp dir on every single run.
for (const t of TEMPS) rmSync(t, { recursive: true, force: true });

// ── AC-4/AC-5 fixture: an in-memory DB with a project, agent, task and session ──────────────
// node:sqlite's DatabaseSync accepts ":memory:" directly — no temp file, nothing to clean up.
function makeDbFixture(approvalGate: boolean) {
  const db = openDb(":memory:");
  const project = createProject(db, {
    slug: "stage3-mcp-fixture",
    primaryRepoPath: "/nonexistent/repo",
    yamlPath: "/nonexistent/repo/agentos.yml",
  });
  const agent = createAgent(db, {
    projectId: project.id,
    name: "Fixture Agent",
    monogram: "FA",
    model: "claude-opus-5",
    rolePrompt: "test fixture agent",
    allowedTools: [],
    disallowedTools: [],
    canCommit: false,
  });
  const task = createTask(db, {
    projectId: project.id,
    name: "fixture task",
    description: "exercises task_update_status",
    approvalGate,
    assigneeAgentId: agent.id,
  });
  const session = createSession(db, {
    taskId: task.id,
    agentId: agent.id,
    triggerKind: "manual",
    worktreePath: "/nonexistent/worktree",
    baseRef: "main",
    pid: process.pid,
    bootId: "stage3-mcp-boot",
    driftAtSpawn: {
      severity: "in-sync",
      claim: "fixture",
      verified: "fixture",
      source: "fixture",
      check: "fixture",
      checkedAtISO: new Date().toISOString(),
    },
  });
  return { db, project, agent, task, session };
}

// ── AC-4 · a scripted task_update_status("review") moves the card and records the actor ────
{
  const { db, task, session } = makeDbFixture(false);
  // T5 adds data-layer state-machine enforcement (db.ts's assertLegalTransition, spec §7.6,
  // AC-19): a session may move 'doing' -> 'review', never 'todo' -> 'review' directly — in real
  // usage dispatch() always writes todo -> doing (actorType 'session') before a session's run
  // even starts, so this fixture's task would never actually be sitting in 'todo' by the time an
  // agent calls task_update_status. Mirror that here via a human-actorType setup transition
  // (always legal, and excluded from AC-4's own assertions below, which only read the LAST
  // event) rather than leaving the fixture at its old, now-unrealistic starting state.
  writeTaskTransition(db, { taskId: task.id, toStatus: "doing", actorType: "human", actorId: "owner", reason: "setup — mirrors dispatch's own todo->doing" });
  const ctx = { db, sessionId: session.id, taskId: task.id };
  const result = await createTaskUpdateStatusTool(ctx).handler(
    { status: "review", reason: "ready for review" },
    {} as never,
  );
  const after = getTask(db, task.id)!;
  const events = listTaskEvents(db, task.id);
  const lastEvent = events[events.length - 1];

  if ((result as { isError?: boolean }).isError) {
    fail("AC-4", `handler reported an error on an ungated transition: ${JSON.stringify(result)}`);
  } else if (after.status !== "review") {
    fail("AC-4", `task did not move to 'review': still '${after.status}'`);
  } else if (!lastEvent || lastEvent.toStatus !== "review") {
    fail("AC-4", `no TaskEvent recorded for the move to 'review'`);
  } else if (lastEvent.actorType !== "session" || lastEvent.actorId !== session.id) {
    fail(
      "AC-4",
      `TaskEvent did not record the session as actor: actorType=${lastEvent.actorType} actorId=${lastEvent.actorId}`,
    );
  } else {
    pass("AC-4", `task_update_status("review") moved the card and recorded session ${session.id.slice(0, 8)} as actor`);
  }
  db.close();
}

// ── AC-5 · the gate holds, and the test asserts which layer refused ─────────────────────────
{
  const { db, task, session } = makeDbFixture(true); // approvalGate: true
  const ctx = { db, sessionId: session.id, taskId: task.id };

  // Put the task in 'review' first, exactly as it would be before a session tries to close it —
  // via writeTaskTransition directly (a human/system move, not through the gated tool), so this
  // setup step does not itself exercise (or pollute the count of) the thing under test.
  writeTaskTransition(db, { taskId: task.id, toStatus: "review", actorType: "human", actorId: "owner", reason: "setup" });
  const eventsBeforeAttempt = listTaskEvents(db, task.id).length;

  // Layer 1 — canUseTool. Cheap, first, and must be handed the FULLY-QUALIFIED wire name
  // (names.ts's qualify()) — not the bare tool name, which is exactly the trap that would leave
  // this layer dead behind a green AC-5 (T4 brief §2b). Asserted independently of layer 2 below.
  const gate = createApprovalGate(ctx);
  const qualifiedName = qualify(AGENTOS_SERVER, TASK_UPDATE_STATUS);
  const layer1 = await gate(qualifiedName, { status: "done" }, {
    signal: new AbortController().signal,
    toolUseID: "fixture-tool-use-id",
    requestId: "fixture-request-id",
  } as never);
  const taskAfterLayer1 = getTask(db, task.id)!;
  const sessionAfterLayer1 = getSession(db, session.id)!;

  const layer1Denied =
    !!layer1 && layer1.behavior === "deny" && typeof (layer1 as { message?: unknown }).message === "string" &&
    (layer1 as { message: string }).message.length > 0;
  const layer1Clean =
    taskAfterLayer1.status === "review" && sessionAfterLayer1.failureReason === null &&
    listTaskEvents(db, task.id).length === eventsBeforeAttempt;

  if (!layer1Denied) {
    fail("AC-5", `layer 1 (canUseTool) did not deny with a message: ${JSON.stringify(layer1)}`);
  } else if (!layer1Clean) {
    fail("AC-5", "layer 1 (canUseTool) is supposed to be a pure decision, but it wrote to the DB");
  } else {
    // Layer 2 — the tool handler itself. Refuses regardless of what let the call through; this is
    // the layer AC-5 actually asserts against (§3.4), because it is the one that still holds if
    // layer 1 above were ever misconfigured or bypassed.
    const layer2 = await createTaskUpdateStatusTool(ctx).handler({ status: "done" }, {} as never);
    const taskAfterLayer2 = getTask(db, task.id)!;
    const sessionAfterLayer2 = getSession(db, session.id)!;
    const eventsAfterLayer2 = listTaskEvents(db, task.id).length;

    const layer2Refused = (layer2 as { isError?: boolean }).isError === true;
    const cardUnmoved = taskAfterLayer2.status === "review";
    const refusalRecorded =
      typeof sessionAfterLayer2.failureReason === "string" && sessionAfterLayer2.failureReason.length > 0;
    const noNewEvent = eventsAfterLayer2 === eventsBeforeAttempt;

    if (!layer2Refused) {
      fail("AC-5", `layer 2 (the handler) did not refuse: ${JSON.stringify(layer2)}`);
    } else if (!cardUnmoved) {
      fail("AC-5", `card moved despite the gate: status is now '${taskAfterLayer2.status}'`);
    } else if (!refusalRecorded) {
      fail("AC-5", "layer 2 refused but recorded nothing on Session.failureReason");
    } else if (!noNewEvent) {
      fail("AC-5", "layer 2 refused but still wrote a TaskEvent");
    } else {
      // The same transition from the human succeeds and is attributed to the human, not a session.
      writeTaskTransition(db, { taskId: task.id, toStatus: "done", actorType: "human", actorId: "owner", reason: "approved by owner" });
      const taskAfterHuman = getTask(db, task.id)!;
      const eventsAfterHuman = listTaskEvents(db, task.id);
      const lastEvent = eventsAfterHuman[eventsAfterHuman.length - 1];

      if (taskAfterHuman.status !== "done") {
        fail("AC-5", `the human's transition to 'done' did not stick: status is '${taskAfterHuman.status}'`);
      } else if (!lastEvent || lastEvent.actorType !== "human" || lastEvent.toStatus !== "done") {
        fail("AC-5", `human transition did not write a TaskEvent with actorType 'human': ${JSON.stringify(lastEvent)}`);
      } else {
        pass(
          "AC-5",
          `gate holds — layer 1 (canUseTool) denied "${(layer1 as { message: string }).message.slice(0, 40)}…", ` +
            `layer 2 (handler) independently refused and recorded a Session.failureReason, card stayed in 'review'; ` +
            `the human's 'done' then succeeded and was attributed to actorType 'human'`,
        );
      }
    }
  }
  db.close();
}

// ── AC-5b · every tool name survives the Messages API's own charset (D29) ──────────────────
// Structural, and deliberately so. §3.3's closed decision has AC-4 and AC-5 call the handler and
// canUseTool DIRECTLY, so no check in this suite ever crosses the model API boundary — which is
// the one place a tool name's character set is enforced (`^[a-zA-Z0-9_-]{1,64}$`, and no dot).
// The spec's original dotted names registered fine at the MCP layer and would have failed at the
// first real dispatch (AC-12), invisibly until then. This asserts the charset here instead.
{
  const API_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
  const tools: Array<[string, string]> = [
    [AGENTOS_SERVER, TASK_READ],
    [AGENTOS_SERVER, TASK_UPDATE_STATUS],
    [AGENTOS_SERVER, TASK_APPEND_ACTIVITY],
    [INBOX_SERVER, INBOX_ASK],
  ];
  const bad = tools.flatMap(([server, toolName]) => {
    const qualified = qualify(server, toolName);
    const offenders: string[] = [];
    if (!API_TOOL_NAME.test(toolName)) offenders.push(toolName);
    if (!API_TOOL_NAME.test(qualified)) offenders.push(qualified);
    return offenders;
  });

  if (bad.length > 0) {
    fail("AC-5b", `tool names the Messages API would reject: ${bad.join(", ")}`);
  } else {
    pass("AC-5b", `all ${tools.length} tool names and their qualified forms match the API charset (longest: ${
      Math.max(...tools.map(([s2, t]) => qualify(s2, t).length))
    } chars)`);
  }
}

console.log("\nStage 3 acceptance — dispatch() and the boot sweep (T5)\n");

// ── Dispatch fixtures — a second temp-dir/in-memory-db family, cleaned up at the very end ───
// (the mid-file `for (const t of TEMPS) rmSync(...)` above already ran for AC-2/AC-9/AC-8a's
// own fixtures; these reuse the same TEMPS array so the bottom-of-file pass below catches them.)

function makeDispatchFixtureRepo(opts: { withAgentosYml?: boolean } = {}): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-stage3-dispatch-"));
  TEMPS.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  if (opts.withAgentosYml !== false) writeFileSync(join(dir, "agentos.yml"), "project: fixture\n");
  writeFileSync(join(dir, "README.md"), "# dispatch fixture\n");
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
  return { dir };
}

/** A project + one agent, ready to dispatch against. `maxConcurrentSessions` defaults to 1. */
function makeDispatchProject(
  db: ReturnType<typeof openDb>,
  repoDir: string,
  opts: { maxConcurrentSessions?: number } = {},
) {
  const project = createProject(db, {
    slug: `fixture-${randomUUID()}`,
    primaryRepoPath: repoDir,
    yamlPath: join(repoDir, "agentos.yml"),
    maxConcurrentSessions: opts.maxConcurrentSessions ?? 1,
  });
  const agent = createAgent(db, {
    projectId: project.id,
    name: "Fixture Agent",
    monogram: "FA",
    model: "claude-opus-5",
    rolePrompt: "fixture agent for T5's dispatch acceptance checks",
    allowedTools: [],
    disallowedTools: [],
    canCommit: false,
  });
  return { project, agent };
}

function makeDispatchTask(
  db: ReturnType<typeof openDb>,
  project: ReturnType<typeof createProject>,
  agent: ReturnType<typeof createAgent>,
  opts: { assigneeAgentId?: string | null } = {},
) {
  return createTask(db, {
    projectId: project.id,
    name: `fixture task ${randomUUID().slice(0, 8)}`,
    description: "exercises dispatch()",
    approvalGate: false,
    assigneeAgentId: opts.assigneeAgentId === undefined ? agent.id : opts.assigneeAgentId,
  });
}

function countRows(db: ReturnType<typeof openDb>, table: "Session" | "TaskEvent"): number {
  return (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;
}

/**
 * Splices `PROJECTS`' *contents* — not the exported binding, which is `const` — to exactly the
 * fixture config for the duration of `fn`, then restores the original list. `dispatch()`'s drift
 * step (§7.5) must call the real `boardOnce()`/`buildBoard()` (never a mock — §9's seam table
 * lists only Runner, the fixture repo, and bootId; a fourth "board fetcher" seam is not on it),
 * but `buildBoard()` unconditionally reconciles *every* entry in `PROJECTS`. Swapping the array's
 * contents rather than appending to them is what keeps this suite from touching nadim, itqan, or
 * any other real watched project while still exercising the real reconciler against a fixture —
 * the "fixture repo" seam §9 names AC-17 as using. `boardOnce`'s cache is React's `cache()`, which
 * (verified empirically: it re-runs `buildBoard` every call outside of a render pass) does not
 * survive across `withOnlyProject` calls to leak a stale board between them.
 *
 * **Reached via `createRequire`, not a top-level `import`.** This file is `.mts` — native ESM —
 * but package.json carries no `"type": "module"`, so every plain `.ts` file (`dispatch.ts`,
 * `board.ts`, `projects.config.ts` itself) loads through tsx's CommonJS-compat path, on Node's
 * *CJS* `require` registry. An `import { PROJECTS } from "../projects.config"` written here
 * would resolve through the *ESM* registry instead — a different cache, keyed by the same file
 * but holding a **second, independent array** (confirmed empirically: splicing that binding never
 * showed up on the array `dispatch.ts`'s own internal `require` chain sees). `createRequire`
 * forces this file onto the same CJS registry `dispatch.ts` is already on, so the array is
 * genuinely shared and the splice is genuinely visible where it needs to be.
 */
const projectsConfigRequire = createRequire(import.meta.url);
function getProjects(): ProjectConfig[] {
  return (projectsConfigRequire("../projects.config") as { PROJECTS: ProjectConfig[] }).PROJECTS;
}

async function withOnlyProject<T>(cfg: ProjectConfig, fn: () => Promise<T>): Promise<T> {
  const PROJECTS = getProjects();
  const saved = PROJECTS.splice(0, PROJECTS.length, cfg);
  try {
    return await fn();
  } finally {
    PROJECTS.splice(0, PROJECTS.length, ...saved);
  }
}

// ── AC-14 · dispatch is the only door — the import graph, not the SQL text ─────────────────
// Walks the FILESYSTEM (not `git ls-files`, which only sees tracked files — trap (i)) under
// lib/ and app/, and matches `import { ... symbol ... } from "..."` regardless of whether the
// specifier is relative (`./db`) or long-form (`agentos/db`) — trap (ii). `createSession` and
// `LocalRunner` are each unique identifiers defined in exactly one file, so any file importing
// either by name is definitionally importing it from there — no specifier-resolution needed.
function walkTsFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
    }
  };
  for (const d of dirs) walk(d);
  return out;
}

function importersOf(symbol: string, files: string[], definingFile: string): string[] {
  const re = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from`);
  return files.filter((f) => f !== definingFile && re.test(readFileSync(f, "utf8")));
}

{
  const files = walkTsFiles(["lib", "app"]);
  const DEFINING_DISPATCH = join("lib", "agentos", "dispatch.ts");
  const createSessionImporters = importersOf("createSession", files, join("lib", "agentos", "db.ts"));
  const localRunnerImporters = importersOf("LocalRunner", files, join("lib", "agentos", "runner", "local.ts"));
  const ok =
    createSessionImporters.length === 1 &&
    createSessionImporters[0] === DEFINING_DISPATCH &&
    localRunnerImporters.length === 1 &&
    localRunnerImporters[0] === DEFINING_DISPATCH;
  if (!ok) {
    fail(
      "AC-14",
      `createSession imported by [${createSessionImporters.join(", ")}]; LocalRunner imported by ` +
        `[${localRunnerImporters.join(", ")}] — expected exactly ["${DEFINING_DISPATCH}"] for both`,
    );
  } else {
    pass(
      "AC-14",
      `createSession and LocalRunner are each imported by exactly one module: ${DEFINING_DISPATCH} ` +
        `(${files.length} files under lib/, app/ scanned)`,
    );
  }
}

// ── AC-15 · every refusal is stated and writes nothing — one fixture per precondition ──────
// Each sub-case asserts started===false, the SPECIFIC refusedBy (never just "something
// refused"), a non-empty reason, and zero new Session/TaskEvent rows (counted before/after,
// after any setup step — matching AC-5's own established "eventsBeforeAttempt" pattern so a
// fixture's own setup writes are never mistaken for what's under test).
{
  // 15a — precondition 1: no agentos.yml
  const { dir } = makeDispatchFixtureRepo({ withAgentosYml: false });
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  const before = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const result = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
  const after = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const refusedBy: Precondition | undefined = result.started ? undefined : result.refusedBy;
  const ok =
    result.started === false &&
    refusedBy === "agentos.yml" &&
    !result.started &&
    result.reason.length > 0 &&
    after.s === before.s &&
    after.e === before.e;
  if (!ok) fail("AC-15a", `expected refusedBy 'agentos.yml' with no new rows, got ${JSON.stringify(result)} (Δsession=${after.s - before.s}, Δevent=${after.e - before.e})`);
  else pass("AC-15a", `no agentos.yml → refused by 'agentos.yml': "${(result as { reason: string }).reason.slice(0, 60)}" — 0 new Session/TaskEvent rows`);
  db.close();
}
{
  // 15b — precondition 2: task not 'todo'
  const { dir } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  writeTaskTransition(db, { taskId: task.id, toStatus: "doing", actorType: "human", actorId: "owner", reason: "setup — task no longer todo" });
  const before = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const result = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
  const after = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const ok = !result.started && result.refusedBy === "dispatchable" && result.reason.length > 0 && after.s === before.s && after.e === before.e;
  if (!ok) fail("AC-15b", `expected refusedBy 'dispatchable' with no new rows, got ${JSON.stringify(result)} (Δsession=${after.s - before.s}, Δevent=${after.e - before.e})`);
  else pass("AC-15b", `task already 'doing' → refused by 'dispatchable': "${(result as { reason: string }).reason.slice(0, 60)}" — 0 new Session/TaskEvent rows`);
  db.close();
}
{
  // 15c — precondition 3: concurrency cap (seeded directly, not via a real dispatch — see AC-16's
  // own note on why this avoids a race against a live background run).
  const { dir } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir, { maxConcurrentSessions: 1 });
  const runningTask = makeDispatchTask(db, project, agent);
  createSession(db, {
    taskId: runningTask.id, agentId: agent.id, triggerKind: "manual",
    worktreePath: "/nonexistent/worktree", baseRef: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    pid: process.pid, bootId: "fixture-boot",
    driftAtSpawn: { severity: "in-sync", claim: "x", verified: "x", source: "x", check: "x", checkedAtISO: new Date().toISOString() },
  });
  const task = makeDispatchTask(db, project, agent);
  const before = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const result = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
  const after = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const ok = !result.started && result.refusedBy === "concurrency" && result.reason.length > 0 && after.s === before.s && after.e === before.e;
  if (!ok) fail("AC-15c", `expected refusedBy 'concurrency' with no new rows, got ${JSON.stringify(result)} (Δsession=${after.s - before.s}, Δevent=${after.e - before.e})`);
  else pass("AC-15c", `project at its cap (1/1 running) → refused by 'concurrency': "${(result as { reason: string }).reason.slice(0, 60)}" — 0 new Session/TaskEvent rows`);
  db.close();
}
{
  // 15d — precondition 4: null assignee (human-only, never defaulted at dispatch)
  const { dir } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent, { assigneeAgentId: null });
  const before = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const result = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
  const after = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const ok = !result.started && result.refusedBy === "agent" && result.reason.length > 0 && after.s === before.s && after.e === before.e;
  if (!ok) fail("AC-15d", `expected refusedBy 'agent' with no new rows, got ${JSON.stringify(result)} (Δsession=${after.s - before.s}, Δevent=${after.e - before.e})`);
  else pass("AC-15d", `null assigneeAgentId (human-only) → refused by 'agent': "${(result as { reason: string }).reason.slice(0, 60)}" — 0 new Session/TaskEvent rows`);
  db.close();
}
{
  // 15e — precondition 5: base ref does not resolve (not even a git repo)
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-stage3-dispatch-nogit-"));
  TEMPS.push(dir);
  writeFileSync(join(dir, "agentos.yml"), "project: fixture\n"); // precondition 1 passes; no git init
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  const before = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const result = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
  const after = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const ok = !result.started && result.refusedBy === "baseRef" && result.reason.length > 0 && after.s === before.s && after.e === before.e;
  if (!ok) fail("AC-15e", `expected refusedBy 'baseRef' with no new rows, got ${JSON.stringify(result)} (Δsession=${after.s - before.s}, Δevent=${after.e - before.e})`);
  else pass("AC-15e", `no git repo at all → refused by 'baseRef': "${(result as { reason: string }).reason.slice(0, 60)}" — 0 new Session/TaskEvent rows`);
  db.close();
}

// ── AC-16 · the concurrency cap is per project, not global ─────────────────────────────────
// The "one session running" precondition is seeded directly (createSession), exactly as AC-15c
// does, rather than via a real dispatch() call — a real dispatch's background continuation
// (unawaited, per §7.4) would race this test's own very next dispatch() call with no guaranteed
// ordering between them. Seeding directly keeps the assertion about the CAP, not about timing.
{
  const { dir: dirA } = makeDispatchFixtureRepo();
  const { dir: dirB } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project: projectA, agent: agentA } = makeDispatchProject(db, dirA, { maxConcurrentSessions: 1 });
  const { project: projectB, agent: agentB } = makeDispatchProject(db, dirB, { maxConcurrentSessions: 1 });

  const runningTaskA = makeDispatchTask(db, projectA, agentA);
  createSession(db, {
    taskId: runningTaskA.id, agentId: agentA.id, triggerKind: "manual",
    worktreePath: "/nonexistent/worktree", baseRef: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    pid: process.pid, bootId: "fixture-boot",
    driftAtSpawn: { severity: "in-sync", claim: "x", verified: "x", source: "x", check: "x", checkedAtISO: new Date().toISOString() },
  });

  const secondTaskA = makeDispatchTask(db, projectA, agentA);
  const firstTaskB = makeDispatchTask(db, projectB, agentB);
  const runner = new FakeRunner({ messages: [] });

  const sameProject = await dispatch(secondTaskA.id, "manual", { db, runner });
  const otherProject = await dispatch(firstTaskB.id, "manual", { db, runner });

  const ok =
    sameProject.started === false && sameProject.refusedBy === "concurrency" && otherProject.started === true;
  if (!ok) {
    fail("AC-16", `same-project dispatch: ${JSON.stringify(sameProject)}; other-project dispatch: ${JSON.stringify(otherProject)}`);
  } else {
    pass(
      "AC-16",
      `project A at its cap refuses a second dispatch there (${(sameProject as { refusedBy: string }).refusedBy}), ` +
        `while project B — its own cap, unaffected — accepts one (session ${(otherProject as { sessionId: string }).sessionId.slice(0, 8)})`,
    );
  }
  // Not closed: otherProject's real dispatch kicked off an unawaited background continuation
  // (§7.4) against this in-memory db; closing here could race it into a benign, caught "database
  // is closed" log line (dispatch.ts's own .catch()) — harmless, but avoided rather than invited.
}

// ── AC-17 · the premise is recorded — drift, and in-sync recorded explicitly (not null) ────
// DC3 ("state doc older than the last commit", checks.ts) is the one drift check that needs
// neither a GitHub remote nor stubbed facts — purely git + a docs/HANDOFF.md mtime, which is
// exactly "a fixture whose state doc contradicts its git history." `isFrameworkRepo: true` on
// the fixture's ProjectConfig skips DC8 (role coverage), the one other check this minimal
// fixture would otherwise trip and which is not this test's subject.
function makeDriftFixtureRepo(opts: { backdateDays?: number } = {}): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-stage3-drift-"));
  TEMPS.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs/HANDOFF.md"), "# Fixture handoff\n\nNothing claimed here.\n");
  writeFileSync(join(dir, "agentos.yml"), "project: fixture\n");
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
  if (opts.backdateDays) {
    const past = new Date(Date.now() - opts.backdateDays * 86_400_000);
    utimesSync(join(dir, "docs/HANDOFF.md"), past, past);
  }
  return { dir };
}

{
  // 17a — a fixture whose state doc is 10 days stale relative to the last commit (DC3: gap>=7
  // is 'drift').
  const { dir } = makeDriftFixtureRepo({ backdateDays: 10 });
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  const cfg: ProjectConfig = { name: "t5-ac17-drift", path: dir, stalledAfterDays: 365, dirtyThreshold: 50, isFrameworkRepo: true };
  const runner = new FakeRunner({ messages: [] });

  const result = await withOnlyProject(cfg, () => dispatch(task.id, "manual", { db, runner }));
  if (!result.started) {
    fail("AC-17a", `dispatch refused instead of recording drift: ${JSON.stringify(result)}`);
  } else {
    const session = getSession(db, result.sessionId)!;
    const drift = parseJsonColumn<DriftAtSpawn>(session.driftAtSpawnJson);
    const ok =
      drift.severity === "drift" &&
      drift.check === "DC3" &&
      typeof drift.claim === "string" && drift.claim.length > 0 &&
      typeof drift.verified === "string" && drift.verified.length > 0 &&
      drift.source === "docs/HANDOFF.md" &&
      typeof drift.checkedAtISO === "string" && !Number.isNaN(Date.parse(drift.checkedAtISO));
    if (!ok) fail("AC-17a", `driftAtSpawnJson missing the claim/verified/source/check/timestamp record: ${JSON.stringify(drift)}`);
    else pass("AC-17a", `session recorded drift at spawn — ${drift.check}: claim "${drift.claim.slice(0, 50)}…" vs verified "${drift.verified.slice(0, 50)}…" (source ${drift.source})`);
  }
}
{
  // 17b — a fixture in sync: NOT backdated, so DC3 finds no gap and nothing else fires. Must
  // still carry a record — "an absent record and a clean project must not look alike."
  const { dir } = makeDriftFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  const cfg: ProjectConfig = { name: "t5-ac17-in-sync", path: dir, stalledAfterDays: 365, dirtyThreshold: 50, isFrameworkRepo: true };
  const runner = new FakeRunner({ messages: [] });

  const result = await withOnlyProject(cfg, () => dispatch(task.id, "manual", { db, runner }));
  if (!result.started) {
    fail("AC-17b", `dispatch refused instead of recording the in-sync state: ${JSON.stringify(result)}`);
  } else {
    const session = getSession(db, result.sessionId)!;
    const drift = parseJsonColumn<DriftAtSpawn>(session.driftAtSpawnJson);
    const ok =
      drift.severity === "in-sync" &&
      typeof drift.claim === "string" && drift.claim.length > 0 &&
      typeof drift.verified === "string" && drift.verified.length > 0 &&
      typeof drift.checkedAtISO === "string" && !Number.isNaN(Date.parse(drift.checkedAtISO));
    if (!ok) fail("AC-17b", `in-sync project did not record an explicit in-sync severity: ${JSON.stringify(drift)}`);
    else pass("AC-17b", `session recorded severity '${drift.severity}' (not null) for a clean project — an absent record and a clean project do not look alike`);
  }
}

// ── AC-18 · a dead session cannot claim to be running — 'running', then 'waiting-inbox' ────
{
  // 18a — a 'running' session with a foreign bootId and a REAL worktree on disk.
  const { dir } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  writeTaskTransition(db, { taskId: task.id, toStatus: "doing", actorType: "human", actorId: "owner", reason: "setup — mirrors dispatch's own todo->doing" });

  const wt = await createWorktree(dir, "HEAD", "ac18-running-session");
  const session = createSession(db, {
    taskId: task.id, agentId: agent.id, triggerKind: "manual",
    worktreePath: wt.path, baseRef: wt.baseRef, pid: 999999, bootId: "foreign-boot-id",
    driftAtSpawn: { severity: "in-sync", claim: "x", verified: "x", source: "x", check: "x", checkedAtISO: new Date().toISOString() },
  });
  createToolCall(db, { sessionId: session.id, seq: 0, name: "task_read", input: {} });

  const { swept } = await runBootSweep(db, "current-boot-id");
  const after = getSession(db, session.id)!;
  const events = listTaskEvents(db, task.id);
  const lastEvent = events[events.length - 1];
  const toolCalls = listToolCallsBySession(db, session.id);

  const ok =
    swept.some((s) => s.id === session.id) &&
    after.status === "interrupted" &&
    typeof after.failureReason === "string" && after.failureReason.length > 0 &&
    after.worktreePath === null &&
    !existsSync(wt.path) &&
    !worktreePaths(dir).includes(wt.path) &&
    toolCalls.length === 1 &&
    !!lastEvent && lastEvent.actorType === "system" && lastEvent.toStatus === "todo";

  if (!ok) {
    fail(
      "AC-18a",
      `after=${JSON.stringify(after)} onDisk=${existsSync(wt.path)} inWorktreeList=${worktreePaths(dir).includes(wt.path)} toolCalls=${toolCalls.length} lastEvent=${JSON.stringify(lastEvent)}`,
    );
  } else {
    pass(
      "AC-18a",
      `'running' session with a foreign bootId → 'interrupted' ("${after.failureReason!.slice(0, 50)}…"), worktree gone from disk and 'git worktree list', 1 ToolCall preserved, task moved back to 'todo' by actorType 'system'`,
    );
  }
  db.close();
}
{
  // 18b — repeat for 'waiting-inbox': no worktree to remove (already gone by §3.5's design),
  // but the sweep must still key on "no live owner," not on status === 'running'.
  const { dir } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent);
  writeTaskTransition(db, { taskId: task.id, toStatus: "doing", actorType: "human", actorId: "owner", reason: "setup — mirrors dispatch's own todo->doing" });

  const session = createSession(db, {
    taskId: task.id, agentId: agent.id, triggerKind: "manual",
    worktreePath: "/tmp/agentos/already-removed-by-inbox-ask", baseRef: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    pid: 999999, bootId: "foreign-boot-id-2",
    driftAtSpawn: { severity: "in-sync", claim: "x", verified: "x", source: "x", check: "x", checkedAtISO: new Date().toISOString() },
  });
  // Simulate §3.5: the inbox tool already flipped status and tore down the worktree itself.
  updateSession(db, session.id, { status: "waiting-inbox", worktreePath: null });
  createToolCall(db, { sessionId: session.id, seq: 0, name: "inbox_ask", input: { question: "which env?" } });

  const { swept } = await runBootSweep(db, "current-boot-id");
  const after = getSession(db, session.id)!;
  const events = listTaskEvents(db, task.id);
  const lastEvent = events[events.length - 1];
  const toolCalls = listToolCallsBySession(db, session.id);

  const ok =
    swept.some((s) => s.id === session.id) &&
    after.status === "interrupted" &&
    typeof after.failureReason === "string" && after.failureReason.length > 0 &&
    after.worktreePath === null &&
    toolCalls.length === 1 &&
    !!lastEvent && lastEvent.actorType === "system" && lastEvent.toStatus === "todo";

  if (!ok) {
    fail("AC-18b", `after=${JSON.stringify(after)} toolCalls=${toolCalls.length} lastEvent=${JSON.stringify(lastEvent)}`);
  } else {
    pass(
      "AC-18b",
      `'waiting-inbox' session (already-gone worktree, stale bootId) → swept too: 'interrupted', 1 ToolCall preserved, task moved back to 'todo' — keyed on "no live owner," not on status`,
    );
  }
  db.close();
}

// ── AC-19 · the state machine refuses illegal moves, at the data layer ─────────────────────
// db.ts's assertLegalTransition (wired into writeTaskTransition) is what actually enforces this
// — see that file's docstring for why it lives there and not here. This check drives the one
// arrow AC-19 names explicitly (todo -> done from a session) and proves the rejection happens
// BEFORE any write (zero new Session/TaskEvent rows — reusing AC-15's before/after pattern), then
// proves structurally that nothing else in lib/agentos writes Task.status directly.
{
  const { dir } = makeDispatchFixtureRepo();
  const db = openDb(":memory:");
  const { project, agent } = makeDispatchProject(db, dir);
  const task = makeDispatchTask(db, project, agent); // fresh task: status 'todo'
  const before = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };

  let threw: string | null = null;
  try {
    writeTaskTransition(db, { taskId: task.id, toStatus: "done", actorType: "session", actorId: "some-session-id", reason: "an agent tried to skip straight to done" });
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }

  const after = { s: countRows(db, "Session"), e: countRows(db, "TaskEvent") };
  const taskAfter = getTask(db, task.id)!;
  const rejectedAtDataLayer =
    threw !== null && /todo.*done|illegal transition/i.test(threw) && taskAfter.status === "todo" && after.e === before.e;

  if (!rejectedAtDataLayer) {
    fail("AC-19a", `expected writeTaskTransition to throw and write nothing for todo->done by a session; threw=${threw} taskAfter.status=${taskAfter.status} Δevent=${after.e - before.e}`);
  } else {
    pass("AC-19a", `todo -> done by actorType 'session' rejected at the data layer: "${threw}" — task stayed 'todo', 0 new TaskEvent rows`);
  }
  db.close();
}
{
  // 19b — structural: Task.status is written from exactly one place (db.ts's
  // writeTaskTransition), which is what guarantees "no Task.status without a TaskEvent" — the
  // two writes are in the same transaction there and nowhere else raw-UPDATEs the column.
  const files = walkTsFiles(["lib", "app"]);
  const DEFINING_DB = join("lib", "agentos", "db.ts");
  const rawUpdaters = files.filter((f) => {
    if (f === DEFINING_DB) return false;
    return /UPDATE\s+Task\s+SET\s+status/i.test(readFileSync(f, "utf8"));
  });
  const inDbTs = /UPDATE\s+Task\s+SET\s+status/i.test(readFileSync(DEFINING_DB, "utf8"));
  if (rawUpdaters.length > 0 || !inDbTs) {
    fail("AC-19b", `Task.status written outside writeTaskTransition: [${rawUpdaters.join(", ")}] (present in db.ts: ${inDbTs})`);
  } else {
    pass("AC-19b", `'UPDATE Task SET status' appears only inside ${DEFINING_DB} (writeTaskTransition), paired with the TaskEvent insert in one transaction`);
  }
}

// ── Prove AC-14 fails when it should — run once, by hand, not part of the suite's exit code ──
// (See the T5 report for the exact failure message this produced and the file added/removed to
// trigger it. Left as this comment, not code, so `pnpm verify:stage3` doesn't leave a stray file
// behind on every run.)

for (const t of TEMPS) rmSync(t, { recursive: true, force: true });

console.log(
  failures === 0
    ? "\nAll Stage 3 acceptance criteria pass (AC-2, AC-9, AC-8a, AC-4, AC-5, AC-5b, AC-14, AC-15a…e, AC-16, AC-17a/b, AC-18a/b, AC-19a/b).\n"
    : `\n${failures} FAILING.\n`,
);
process.exit(failures === 0 ? 0 : 1);
