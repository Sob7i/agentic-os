/**
 * Next.js's server-startup hook — the call site `lib/agentos/sweep.ts` names as missing (T5's own
 * doc comment: "Not wired to an actual server-boot hook in this ticket... left for whichever
 * ticket wires the app's own startup"). T7 is that ticket (brief §3).
 *
 * §7.7: "a `running` row whose process is dead is a lie." Without this, restarting `pnpm dev`
 * leaves every `running`/`waiting-inbox` session claiming to be live forever, with no process
 * behind it — this product's own subject matter, occurring inside it. `PROCESS_BOOT_ID` comes from
 * `dispatch.ts` (not minted again here) so the sweep's idea of "the current process" and every
 * session `dispatch()` stamps going forward can never disagree.
 *
 * Node-only: `node:sqlite` (`lib/agentos/db.ts`) has no edge-runtime equivalent, and `dispatch.ts`
 * transitively reaches `node:child_process` (`lib/collectors/exec.ts`, for `git rev-parse`). Next
 * also compiles this file for an edge-runtime target even though the app declares no edge routes;
 * `next.config.mjs` externalizes `node:child_process` for exactly that target — see its own comment
 * for what breaks without it (found by actually running `pnpm dev` against a seeded fixture, not
 * assumed). The `NEXT_RUNTIME` guard below is the belt to that config's suspenders: correct on its
 * own merits even though, on this Next version, it alone was not sufficient in dev mode.
 */
export const runtime = "nodejs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getDb } = await import("./lib/agentos/db");
  const { runBootSweep } = await import("./lib/agentos/sweep");
  const { PROCESS_BOOT_ID } = await import("./lib/agentos/dispatch");

  const db = getDb();
  const result = await runBootSweep(db, PROCESS_BOOT_ID);
  if (result.swept.length > 0) {
    console.log(
      `[agentos] boot sweep: interrupted ${result.swept.length} session(s) left 'running' by a previous process`,
    );
  }
}
