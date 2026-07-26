import { existsSync } from "node:fs";
import { join } from "node:path";
import type { GitResult } from "../types";
import { ageInDays, run } from "./exec";

/**
 * Git facts. Confidence 1.0 throughout — these are derived, not claimed, so they
 * cannot be wrong about their own inputs (spec §3.5).
 */
export async function collectGit(repo: string): Promise<GitResult> {
  if (!existsSync(join(repo, ".git"))) {
    return { ok: false, reason: `not a git repository: ${repo}` };
  }

  const [branch, status, lastLog] = await Promise.all([
    run("git", ["branch", "--show-current"], repo),
    run("git", ["status", "--porcelain"], repo),
    run("git", ["log", "-1", "--format=%H%x00%cI"], repo),
  ]);

  if (lastLog === null) {
    return { ok: false, reason: "git log failed — repository may have no commits" };
  }

  const [sha, iso] = lastLog.split("\0");
  if (!sha || !iso) {
    return { ok: false, reason: "could not parse git log output" };
  }

  // Ahead/behind only exists when the branch has an upstream. No upstream is a
  // normal state, not a failure — report 0/0 rather than degrading the row.
  let ahead = 0;
  let behind = 0;
  const counts = await run("git", ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], repo);
  if (counts) {
    const [b, a] = counts.split(/\s+/).map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      ahead = a;
      behind = b;
    }
  }

  return {
    ok: true,
    branch: branch || "(detached)",
    dirtyCount: status ? status.split("\n").filter(Boolean).length : 0,
    ahead,
    behind,
    lastCommitSha: sha.slice(0, 7),
    lastCommitISO: iso,
    lastCommitAgeDays: ageInDays(iso),
  };
}
