/**
 * Push and PR — spec §3.8, D41. The one function on this stage's authorized side of the machine
 * boundary: everything else this stage builds (the branch, the base, prepare, verify, the
 * preamble) runs entirely on disk. This is the gesture that leaves it.
 *
 * `pushAndOpenPr` is deliberately one call doing the whole thing D41 describes as "one click, not
 * three": `git push -u origin <branch>`, then `gh pr create` with a generated title and T3's
 * `composePrBody` as the body, then both facts (`pushedAtISO`, `prUrl`) stored on the `Session`
 * row. Ticket: docs/specs/stage-4b-tickets.md T4.
 *
 * **Two seams, both real** (spec §7): the git remote is a genuine `git init --bare` repo in a
 * temp dir (real `git push` semantics — ref creation, rejection, the lot), and `gh` is an
 * injected `(argv, cwd) => stdout` function so the argv it is called with is itself assertable —
 * "how AC-11's 'never merges' becomes checkable behaviour and not only a source grep" (D41). No
 * test here or in `scripts/verify-stage4b.mts` calls the real `gh`.
 */
import type { DatabaseSync } from "node:sqlite";
import { getProject, getSession, getTask, listCommitShas, parseJsonColumn, updateSession } from "./db";
import type { DriftAtSpawn } from "./types";
import { composePrBody } from "./delivery-render";
import { run } from "../collectors/exec";
import { runCommand } from "./command";

// ---------------------------------------------------------------------------
// The `gh` seam
// ---------------------------------------------------------------------------

/**
 * Argv in, stdout out. `argv` never includes the leading `"gh"` — the invoker IS the gh CLI, the
 * same shape `lib/collectors/exec.ts`'s `run(cmd, args, cwd)` takes for git elsewhere in this
 * codebase. Rejects (never resolves with an error shape) on a non-zero exit, a timeout, or a
 * spawn failure — `pushAndOpenPr` distinguishes "the branch is pushed but the PR call failed" from
 * every earlier refusal by catching exactly this rejection (finding 4, tickets file T4).
 */
export type GhInvoker = (argv: string[], cwd: string) => Promise<string>;

/**
 * The real `gh` CLI, via `command.ts`'s `runCommand` — **never** `lib/collectors/exec.ts`'s
 * `run()`, which discards the exit code this function needs to tell a failed `gh pr create` from
 * one that printed nothing. `gh` is invoked in exactly one other file in this codebase
 * (`lib/collectors/github.ts`, the portfolio layer's own read-only PR listing,
 * docs/specs/stage-4b-tickets.md inherited fact 9) — this is new code in the execution layer, on
 * the permitted side of D19's layer boundary, and does not touch that file.
 */
async function defaultGhInvoker(argv: string[], cwd: string): Promise<string> {
  const result = await runCommand(["gh", ...argv], cwd);
  if (result.exitCode !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new Error(
      `gh ${argv.join(" ")} ${result.timedOut ? "timed out" : `exited ${result.exitCode ?? "null"}`}` +
        (detail ? `: ${detail}` : ""),
    );
  }
  return result.stdout;
}

/** `gh pr create`'s own stdout is the PR URL, sometimes with a trailing newline and, on some
 *  versions, a blank line or two around it — never more than one non-empty line in the
 *  non-interactive case this function always drives (every flag supplied, §3.8). Take the last
 *  non-empty line rather than assume there is exactly one, so an incidental blank line before or
 *  after it cannot turn into an empty `prUrl`. */
function lastNonEmptyLine(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : "";
}

// ---------------------------------------------------------------------------
// pushAndOpenPr — §3.8
// ---------------------------------------------------------------------------

/**
 * Every refusal §3.8 and the tickets file name, plus the two shapes a failure mid-gesture can
 * take once the preconditions have all passed. Named, never thrown — the same posture
 * `dispatch()`'s `DispatchResult` takes for its own preconditions, for the identical reason: a
 * refusal here is an expected outcome a human reads, not a caller bug.
 */
export type PushRefusalReason =
  | "not-settled"
  | "no-branch"
  | "no-commits"
  | "already-open"
  | "verify-failed"
  | "no-integration-branch"
  | "push-command-failed"
  | "pr-command-failed";

export type PushAndOpenPrResult =
  | { ok: true; pushedAtISO: string; prUrl: string }
  | { ok: false; refusedBy: PushRefusalReason; reason: string };

export interface PushAndOpenPrInput {
  db: DatabaseSync;
  sessionId: string;
  /** The human's explicit opt-in, carried in the same gesture as the click (D41 part 2: "one
   *  click does the whole gesture," never a second confirmation round-trip) — set only when the
   *  session's own `verifyExitCode` is non-zero and the human chose to push anyway. */
  confirmDespiteVerifyFailure: boolean;
  /** Test seam. Defaults to the real `gh` CLI. */
  gh?: GhInvoker;
}

function refuse(refusedBy: PushRefusalReason, reason: string): PushAndOpenPrResult {
  return { ok: false, refusedBy, reason };
}

/**
 * One gesture: push, open a PR, record both facts. Refuses, naming its reason, without touching
 * the remote at all, for every precondition below — **AC-9 asserts the remote is untouched on
 * every refusal path** (`git ls-remote` shows no such ref, `pushedAtISO` and `prUrl` stay null),
 * which is only true because every check below runs before the first `git push`.
 *
 * A missing `Session`, `Task` or `Project` row is a caller bug (the control only ever renders on
 * a session id it already loaded), not a §3.8 refusal — thrown, the same posture `dispatch()`
 * takes for its own equivalent cases.
 */
export async function pushAndOpenPr(input: PushAndOpenPrInput): Promise<PushAndOpenPrResult> {
  const { db, sessionId, confirmDespiteVerifyFailure } = input;
  const gh = input.gh ?? defaultGhInvoker;

  const session = getSession(db, sessionId);
  if (!session) throw new Error(`pushAndOpenPr: no Session ${sessionId}`);
  const task = getTask(db, session.taskId);
  if (!task) throw new Error(`pushAndOpenPr: no Task ${session.taskId} (Session ${sessionId})`);
  const project = getProject(db, task.projectId);
  if (!project) throw new Error(`pushAndOpenPr: no Project ${task.projectId} (Task ${task.id})`);

  // §3.8: "the control lives on the session card of a SETTLED session that has a branch and at
  // least one commit." Settled mirrors `sessionViewModel`'s own `live` computation
  // (`lib/tasks/session-model.ts`) — running or waiting-inbox is not settled; every other status
  // is.
  const settled = session.status !== "running" && session.status !== "waiting-inbox";
  if (!settled) {
    return refuse(
      "not-settled",
      `session ${sessionId} is '${session.status}' — push is only offered once a session has settled`,
    );
  }
  if (!session.branchName) {
    return refuse(
      "no-branch",
      `session ${sessionId} has no branchName — it predates Stage 4b and was never dispatched onto a branch`,
    );
  }
  const commitShas = listCommitShas(db, sessionId).map((r) => r.sha);
  if (commitShas.length === 0) {
    return refuse(
      "no-commits",
      `session ${sessionId}'s branch '${session.branchName}' carries no commits — nothing to push`,
    );
  }

  /**
   * Finding 2 (docs/specs/stage-4b-tickets.md T4). `command.ts`'s `runCommand` reports `exitCode:
   * null` for two different reasons a caller must not conflate — the process never produced one
   * (this module's own timeout fired, or the executable could not be spawned) — and
   * `dispatch.ts`'s verify block used to write that `null` straight onto `verifyExitCode`
   * unchanged, which collides with the column's OTHER meaning of `null`: "no `verify:` key at
   * all" (`SessionRow.verifyExitCode`'s own doc comment). A `verify:` that timed out would have
   * sailed through this gate exactly like a project with no `verify:` configured — a delivery
   * path publishing unverified work, silently. Closed at the source: `dispatch.ts` now writes
   * `VERIFY_DID_NOT_COMPLETE` (a sentinel no real exit code can produce — those are always
   * 0–255) instead of `null` whenever a *configured* `verify:` failed to produce a clean exit.
   * This function only has to read the column as documented: `null` means unconfigured, anything
   * else non-zero refuses.
   */
  if (session.verifyExitCode !== null && session.verifyExitCode !== 0 && !confirmDespiteVerifyFailure) {
    return refuse(
      "verify-failed",
      `verify: exited ${session.verifyExitCode} on this session — push anyway only if a human confirms it in the same click`,
    );
  }

  /**
   * Finding 4 (tickets file T4). `pushedAtISO` and `prUrl` are two separate facts, deliberately —
   * a `gh pr create` that fails AFTER a successful push (a crash, a rate limit, a bad token) must
   * not strand the branch behind a refusal that reads "already pushed" forever, with no way back
   * in. **Fully done** (both facts set) refuses outright — there is nothing left to do.
   * **Pushed but PR-less** (only `pushedAtISO` set) is a retry: `git push` is skipped — the branch
   * is already on the remote, and pushing it again would be a no-op at best and a needless network
   * round-trip at worst — and only the `gh pr create` half is attempted.
   */
  const alreadyPushed = session.pushedAtISO !== null;
  const alreadyHasPr = session.prUrl !== null;
  if (alreadyPushed && alreadyHasPr) {
    return refuse(
      "already-open",
      `session ${sessionId} was already pushed and already has an open PR (${session.prUrl})`,
    );
  }

  if (!project.integrationBranch) {
    // Not reachable through `initializeProject` (T2 always writes a real value) or through
    // migration 4's backfill (which sets 'develop' rather than leaving this NULL) — only a
    // `Project` row inserted by a caller that bypassed both. Refused rather than guessed, same
    // reasoning as `dispatch.ts`'s own precondition 5.
    return refuse(
      "no-integration-branch",
      `project '${project.slug}' declares no integrationBranch — there is no PR base to open against`,
    );
  }

  if (!alreadyPushed) {
    const pushed = await run("git", ["push", "-u", "origin", session.branchName], project.primaryRepoPath);
    if (pushed === null) {
      // Nothing recorded, nothing changed: a caller sees the same refusal on the next click and
      // can simply try again — `git push` is safe to retry unconditionally.
      return refuse(
        "push-command-failed",
        `git push -u origin ${session.branchName} failed in ${project.primaryRepoPath}`,
      );
    }
  }

  const pushedAtISO = session.pushedAtISO ?? new Date().toISOString();
  if (!alreadyPushed) {
    updateSession(db, sessionId, { pushedAtISO });
  }

  const driftAtSpawn = parseJsonColumn<DriftAtSpawn>(session.driftAtSpawnJson);
  const title = `${task.name} (${session.branchName})`;
  const body = composePrBody({
    sessionId: session.id,
    costUsd: session.costUsd,
    driftAtSpawn,
    commitShas,
    verifyExitCode: session.verifyExitCode,
  });

  let stdout: string;
  try {
    stdout = await gh(
      [
        "pr",
        "create",
        "--base",
        project.integrationBranch,
        "--head",
        session.branchName,
        "--title",
        title,
        "--body",
        body,
      ],
      project.primaryRepoPath,
    );
  } catch (err) {
    // The branch is pushed (`pushedAtISO` is already stored above) — this is exactly finding 4's
    // retry state: the next click skips the push and attempts only this call again.
    return refuse(
      "pr-command-failed",
      `gh pr create failed: ${err instanceof Error ? err.message : String(err)} — the branch is pushed; ` +
        `pushing again will retry only the PR`,
    );
  }

  const prUrl = lastNonEmptyLine(stdout);
  updateSession(db, sessionId, { prUrl });
  return { ok: true, pushedAtISO, prUrl };
}
