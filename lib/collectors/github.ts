import type { GitHubResult, PullRequest } from "../types";
import { run } from "./exec";

/**
 * PR state via the `gh` CLI.
 *
 * The degraded path is built here, not retrofitted (spec §6 step 2): when `gh` is
 * missing, unauthenticated, or offline, this returns a failure with a readable
 * reason and the Board still renders every git-derived fact. It must never report
 * "0 open" for "could not ask" — that would be the dashboard asserting something
 * it did not check, which is the one thing it exists not to do (AC-5).
 */
export async function collectGitHub(repo: string): Promise<GitHubResult> {
  const openRaw = await run(
    "gh",
    ["pr", "list", "--state", "open", "--limit", "100", "--json", "number,title,updatedAt,reviewDecision,isDraft"],
    repo,
  );

  if (openRaw === null) {
    return {
      ok: false,
      reason: "gh unavailable — no PR data (offline, unauthenticated, or no remote)",
    };
  }

  const mergedRaw = await run(
    "gh",
    ["pr", "list", "--state", "merged", "--limit", "300", "--json", "number"],
    repo,
  );

  let open: PullRequest[] = [];
  let mergedNumbers: number[] = [];

  try {
    open = (JSON.parse(openRaw) as Array<Record<string, unknown>>).map((p) => ({
      number: Number(p.number),
      title: String(p.title ?? ""),
      updatedAtISO: String(p.updatedAt ?? ""),
      // gh returns "" (not null) when no review has happened — normalise it.
      reviewDecision: p.reviewDecision ? String(p.reviewDecision) : null,
      isDraft: Boolean(p.isDraft),
    }));
    if (mergedRaw !== null) {
      mergedNumbers = (JSON.parse(mergedRaw) as Array<{ number: number }>).map((p) => Number(p.number));
    }
  } catch {
    return { ok: false, reason: "gh returned output that could not be parsed as JSON" };
  }

  return {
    ok: true,
    open,
    mergedNumbers,
    maxMerged: mergedNumbers.length ? Math.max(...mergedNumbers) : 0,
  };
}
