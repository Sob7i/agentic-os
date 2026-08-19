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

  // Do not CREATE the store just by booting. `getDb()` opens `data/agentos.sqlite` and runs the
  // migration, which materializes a 110KB execution-layer database — on an install where no
  // project has opted into an execution layer at all, and where the portfolio is the only thing
  // running. That is not invariant 5 (nothing is *stored*: the file has no rows), but D19 asks for
  // the layer boundary to be real in code, and the portfolio booting should not conjure the
  // execution layer's store as a side effect. If the file does not exist there are no sessions, so
  // the sweep is a guaranteed no-op and skipping it costs nothing.
  const { existsSync } = await import("node:fs");
  const { DEFAULT_DB_PATH } = await import("./lib/agentos/db");
  if (!existsSync(DEFAULT_DB_PATH)) return;

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
