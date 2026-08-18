/**
 * AC-2, AC-9, AC-8a (worktree lifecycle, T2) and AC-4, AC-5 (the two MCP servers and the gate, T4)
 * from docs/specs/stage-3-execution-mvp.spec.md §4, as runnable checks.
 *
 * Later tickets (T5, T6) add AC-1, AC-3, AC-6…AC-8, AC-10…AC-19 to this file as they land.
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
 * Run: pnpm verify:stage3
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorktree, removeWorktree, withWorktree } from "../lib/agentos/worktree";
import {
  createAgent,
  createProject,
  createSession,
  createTask,
  getSession,
  getTask,
  listTaskEvents,
  openDb,
  writeTaskTransition,
} from "../lib/agentos/db";
import { createApprovalGate } from "../lib/agentos/mcp/gate";
import { createTaskUpdateStatusTool } from "../lib/agentos/mcp/agentos-server";
import { AGENTOS_SERVER, TASK_UPDATE_STATUS, qualify } from "../lib/agentos/mcp/names";

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
    description: "exercises task.update_status",
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

// ── AC-4 · a scripted task.update_status("review") moves the card and records the actor ────
{
  const { db, task, session } = makeDbFixture(false);
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
    pass("AC-4", `task.update_status("review") moved the card and recorded session ${session.id.slice(0, 8)} as actor`);
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

console.log(
  failures === 0
    ? "\nAll Stage 3 acceptance criteria pass (AC-2, AC-9, AC-8a, AC-4, AC-5).\n"
    : `\n${failures} FAILING.\n`,
);
process.exit(failures === 0 ? 0 : 1);
