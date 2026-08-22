/**
 * The boot sweep — spec §7.7: "a `running` row whose process is dead is a lie."
 *
 * `pnpm dev` restarting mid-run leaves a `Session` row saying `running` forever, with no process
 * behind it — a stored claim contradicted by reality, this product's entire subject matter,
 * occurring inside it. Every session stores `pid` and `bootId` (a uuid minted once per server
 * process, `dispatch.ts`'s `PROCESS_BOOT_ID`); on boot, any session `running` or `waiting-inbox`
 * whose `bootId` is not the current one is dead and gets swept.
 *
 * **Not wired to an actual server-boot hook in this ticket.** T5's brief scopes this file to the
 * sweep function itself, tested directly by the acceptance suite; calling it from a Next.js
 * instrumentation hook (or wherever the app decides "boot" happens) is outside `lib/agentos/` and
 * outside this ticket's file list — left for whichever ticket wires the app's own startup.
 */
import type { DatabaseSync } from "node:sqlite";
import {
  getProject,
  getSession,
  getTask,
  haltChain,
  listSessionsByStatus,
  updateSession,
  writeTaskTransition,
} from "./db";
import type { SessionRow } from "./types";
import { removeWorktree } from "./worktree";

export interface SweepResult {
  /** Every session this pass moved to `interrupted`, in the order they were found. */
  swept: SessionRow[];
}

/**
 * Sweeps every session that claims to be live but belongs to a process that is gone.
 *
 * **Keys on "no live owner," not on `status === 'running'`** (§7.7's explicit trap): a
 * `waiting-inbox` session has already torn down its own worktree by design (§3.5) and holds no
 * process either, but its `bootId` is just as stale after a restart, and it still needs its task
 * moved back — nothing else will ever resume it once the row that named its `sdkSessionId` is
 * orphaned from a process that no longer exists.
 */
export async function runBootSweep(db: DatabaseSync, currentBootId: string): Promise<SweepResult> {
  const claimedLive = listSessionsByStatus(db, ["running", "waiting-inbox"]);
  const dead = claimedLive.filter((s) => s.bootId !== currentBootId);

  const swept: SessionRow[] = [];
  for (const session of dead) {
    const failureReason =
      `interrupted: server restarted mid-session (bootId '${session.bootId}' is not the current ` +
      `process's '${currentBootId}')`;

    // A 'running' session has a real worktree to remove; a 'waiting-inbox' one's is already gone
    // by design (§3.5) — `worktreePath` is null in that case and there is nothing to tear down.
    // `removeWorktree` is idempotent (worktree.ts) so a partially-torn-down 'running' session from
    // a crash mid-teardown is still handled correctly here, not just the clean case.
    if (session.worktreePath) {
      const task = getTask(db, session.taskId);
      const project = task ? getProject(db, task.projectId) : null;
      if (project) {
        try {
          await removeWorktree({ path: session.worktreePath, repoPath: project.primaryRepoPath, baseRef: session.baseRef });
        } catch (err) {
          // Best-effort: the session row must still be marked interrupted even if teardown
          // itself fails (a missing repo, a permissions error) — a lying 'running' row is the
          // worse failure of the two, and this is not the last chance to clean up a stray
          // worktree directory.
          console.error(`runBootSweep: failed to remove worktree for session ${session.id}`, err);
        }
      }
    }

    // ToolCall rows and costUsd-so-far are left exactly as they are (§7.7) — only status,
    // worktreePath and failureReason change here.
    updateSession(db, session.id, {
      status: "interrupted",
      worktreePath: null,
      failureReason,
      endedAtISO: new Date().toISOString(),
    });

    // §7.6: "doing -> todo, system, the session failed or was interrupted; reason recorded."
    // Defensive on current task status — a human or a completed agent may have already moved
    // the card past 'doing' before this sweep ran, and that move must not be reverted.
    const task = getTask(db, session.taskId);
    if (task && task.status === "doing") {
      writeTaskTransition(db, {
        taskId: session.taskId,
        toStatus: "todo",
        actorType: "system",
        actorId: null,
        reason: failureReason,
      });
    }

    /**
     * **An interrupted chain step halts its chain, exactly like a failed one.** Raised in review of
     * #38, and it is the same defect as the one #33's review found in AC-8 — a halt path with no
     * production caller — reached by the other route. T3 hooked `runSessionToCompletion`'s failure
     * branch, but a session killed by a restart never reaches that function at all: this sweep is
     * what settles it. Without this, a `pnpm dev` restart mid-chain left the chain `running` with
     * its step back in `todo`, so later steps stayed indefinitely eligible while nothing was
     * driving them — a stall that reports itself as healthy, which §7.7 exists to prevent.
     *
     * Read `task` rather than re-fetching: `chainId` does not change across a transition.
     */
    if (task?.chainId) {
      haltChain(db, task.chainId, task.id, failureReason);
    }

    // Re-read rather than pushing the pre-sweep row: `listSessionsByStatus` handed us a snapshot
    // taken *before* any of the writes above, so pushing it would return rows still saying
    // `status: 'running'` from a function whose whole job is that they no longer do. A caller
    // (T7's UI) would render the lie this sweep exists to remove.
    swept.push(getSession(db, session.id) ?? session);
  }

  return { swept };
}
