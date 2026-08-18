/**
 * AC-2 and AC-9 from docs/specs/stage-3-execution-mvp.spec.md §4, as runnable checks.
 *
 * T2's slice only: the ephemeral git worktree lifecycle in lib/agentos/worktree.ts. Later
 * tickets (T3–T6) add AC-1, AC-3…AC-8, AC-10…AC-19 to this file as they land.
 *
 * Every test runs against a fixture repo generated in a temp directory — never a watched
 * project. Stage 2's suite established the pattern and the reason: a test proving we can write
 * to a real repo by writing to it has destroyed what it verified. AC-2 and AC-8 exist precisely
 * to prove worktree behaviour against the real git binary (spec §9) — there is no fake for git.
 *
 * Run: pnpm verify:stage3
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorktree, removeWorktree, withWorktree } from "../lib/agentos/worktree";

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

console.log(failures === 0 ? "\nAll Stage 3 acceptance criteria pass (AC-2, AC-9, AC-8a).\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
