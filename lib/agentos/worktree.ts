/**
 * The ephemeral git worktree lifecycle — spec §3.2.
 *
 *   git -C <repo> worktree add --detach <tmp>/agentos/<sessionId> <baseRef>
 *     → query({ options: { cwd: <tmp>/agentos/<sessionId>, … } })      (the caller's fn)
 *     → read commit shas:  git -C <worktree> log <baseRef>..HEAD --format=%H
 *     → git -C <repo> worktree remove --force <tmp>/agentos/<sessionId>
 *
 * Three properties this buys, and one it does not (§3.2):
 *   - A clean tree every time — `worktree add` from a ref cannot inherit a previous run's dirt.
 *   - The owner's checkout is untouched — the agent never sees the working copy the owner edits.
 *   - Commits are real and local — they land in the repo's object store on a detached HEAD;
 *     nothing is pushed, nothing moves a branch.
 *   - It is NOT a security boundary (§5.6). A local process can read outside its cwd. Do not
 *     imply otherwise in any caller — `docs/FEATURES.md` must say so under *Known gaps*.
 *
 * `--force` on removal is deliberate: a failed run leaves a dirty worktree, and refusing to clean
 * up after exactly the runs most likely to need it is the wrong default (AC-9).
 */
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { run } from "../collectors/exec";

/**
 * `os.tmpdir()` on macOS returns `/var/…`, a symlink to `/private/var/…`. `git worktree add`
 * records the resolved path, so a path built from the unresolved one would never match what
 * `git worktree list` reports back — resolve once, up front, so our own bookkeeping and git's
 * agree.
 */
function agentosRoot(): string {
  return join(realpathSync(tmpdir()), "agentos");
}

export interface Worktree {
  /** Absolute path to the worktree's working directory. Use as the session's `cwd`. */
  readonly path: string;
  /** The repo this worktree was created from — `worktree remove` runs here, not in `path`. */
  readonly repoPath: string;
  /** The **resolved sha** the worktree was branched from — never a symbolic ref (see `createWorktree`). */
  readonly baseRef: string;
}

/**
 * Create a detached worktree for one session, at `<tmpdir>/agentos/<sessionId>`. A distinct
 * `sessionId` is what guarantees a second run gets a different path (AC-2) — this function does
 * not generate one itself, since the session id is the caller's identity to assign.
 *
 * Fails loudly: a missing repo or an unresolvable `baseRef` must not hand back a path that isn't
 * really a worktree.
 */
export async function createWorktree(
  repoPath: string,
  baseRef: string,
  sessionId: string,
): Promise<Worktree> {
  const path = join(agentosRoot(), sessionId);
  mkdirSync(dirname(path), { recursive: true });

  /**
   * Resolve the ref to a concrete sha before creating anything.
   *
   * Storing the caller's ref verbatim is the obvious thing and it is wrong for any
   * symbolic ref: with `baseRef = "HEAD"`, `git log HEAD..HEAD` inside the worktree
   * compares the worktree's *current* HEAD against itself and reports nothing — so a
   * session that committed would silently record no commits. A branch name has the
   * same flaw the moment the branch moves. Spec §7.3's fifth precondition already
   * requires `git rev-parse <baseRef>` to succeed; this pins the answer.
   */
  const resolved = await run("git", ["rev-parse", baseRef], repoPath);
  if (resolved === null) {
    throw new Error(`baseRef does not resolve: repo=${repoPath} baseRef=${baseRef}`);
  }
  const baseSha = resolved.trim();

  const out = await run("git", ["worktree", "add", "--detach", path, baseSha], repoPath);
  if (out === null) {
    throw new Error(
      `git worktree add failed: repo=${repoPath} baseRef=${baseRef} (${baseSha}) path=${path}`,
    );
  }
  return { path, repoPath, baseRef: baseSha };
}

/**
 * Commit shas made inside the worktree, oldest first. Must be called BEFORE `removeWorktree` —
 * after removal there is nothing left to read (§3.2's trap). A run that committed nothing
 * resolves to an empty array, not an error.
 */
export async function readWorktreeCommits(wt: Worktree): Promise<string[]> {
  const out = await run("git", ["log", `${wt.baseRef}..HEAD`, "--format=%H"], wt.path);
  if (!out) return [];
  return out.split("\n").filter(Boolean).reverse();
}

/**
 * Tear down a worktree. Idempotent — a worktree already gone from disk is treated as already
 * torn down rather than an error, since teardown must be safe to call from a failure path that
 * doesn't know how far setup got.
 */
export async function removeWorktree(wt: Worktree): Promise<void> {
  if (!existsSync(wt.path)) return;
  const out = await run("git", ["worktree", "remove", "--force", wt.path], wt.repoPath);
  if (out === null) {
    throw new Error(`git worktree remove failed: repo=${wt.repoPath} path=${wt.path}`);
  }
}

/**
 * Run `fn` inside a fresh worktree and guarantee teardown — including when `fn` throws (AC-9).
 *
 * **Commits are captured on the failure path too**, and that is not symmetry for its own sake.
 * `worktree remove --force` leaves any commits the run made unreferenced on a detached HEAD:
 * recoverable only as `git branch <name> <sha>` (§3.2), and eventually reclaimed by gc. So the
 * sha *is* the work. A session that committed and then crashed is exactly the case where someone
 * will want it back, and reading commits only on the success path would discard the record of
 * real work at the precise moment it becomes hard to find.
 *
 * `onCommits` fires before teardown on both paths — that ordering is the whole contract, since
 * after removal there is nothing left to read.
 */
export async function withWorktree<T>(
  repoPath: string,
  baseRef: string,
  sessionId: string,
  fn: (worktreePath: string) => Promise<T>,
  onCommits?: (shas: string[]) => void | Promise<void>,
): Promise<{ result: T; commitShas: string[] }> {
  const wt = await createWorktree(repoPath, baseRef, sessionId);

  // Best-effort on the failure path: a run that already threw must not be masked
  // by a second error raised while trying to record what it left behind.
  const capture = async (rethrowOnFailure: boolean): Promise<string[]> => {
    try {
      const shas = await readWorktreeCommits(wt);
      await onCommits?.(shas);
      return shas;
    } catch (err) {
      if (rethrowOnFailure) throw err;
      return [];
    }
  };

  try {
    const result = await fn(wt.path);
    return { result, commitShas: await capture(true) };
  } catch (err) {
    await capture(false);
    throw err;
  } finally {
    await removeWorktree(wt);
  }
}
