/**
 * The one new command runner Stage 4b needs — spec §1 item 7, §3.5, §3.6.
 *
 * `lib/collectors/exec.ts`'s `run()` stays exactly as it is and is not reused here: it returns
 * `string | null`, discards the exit code and stderr entirely, and defaults to a 15-second
 * timeout tuned for `git rev-parse`. That shape can record neither *"prepare exited 3"* nor a
 * verify tail, and it would abort a cold `pnpm install` partway. `run()` remains the project's one
 * git runner, for every git call, including this stage's own (`worktree.ts`, `dispatch.ts`).
 *
 * `runCommand` is the seam `prepare:`/`verify:` (D39, D40) are built on: an exit code, the
 * process's own stdout and stderr, whether it was killed for exceeding its timeout, and how long
 * it ran. Nothing here decides what a non-zero exit means — that is `dispatch.ts`'s job, twice,
 * for two different reasons (§3.5 refuses; §3.6 only records).
 */
import { execFile } from "node:child_process";

export interface CommandResult {
  /**
   * `null` only when the process never produced an exit code at all — killed by a signal (most
   * commonly this module's own timeout) or the executable could not be spawned (e.g. not found).
   * Never `0` unless the process actually ran to completion and exited cleanly; a caller that
   * needs to distinguish "timed out" from "spawn failed" reads `timedOut` alongside this.
   */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** True only when this call's own timeout fired and killed the process. */
  timedOut: boolean;
  durationMs: number;
}

/** §3.5: "the default timeout is five minutes, not fifteen seconds" — `run()`'s 15s default is
 *  right for `git rev-parse`; a cold `pnpm install` in a fresh worktree needs much longer. */
export const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;

/**
 * Run `argv` as a child process in `cwd` and resolve with its result — never rejects; a spawn
 * failure or a timeout is reported through the same `CommandResult` shape a non-zero exit is,
 * because every caller of this function (`dispatch.ts`) treats "did not run cleanly" as one
 * decision regardless of which of those three shapes produced it.
 *
 * **`argv` is argv, never a shell string** (§3.5). `execFile` does not tokenize or invoke a shell
 * — the first element is looked up as the executable, the rest are passed through unquoted and
 * unexpanded. A caller that wants a shell writes `["sh", "-c", "…"]` explicitly; this function
 * does not infer that for anyone. A non-array, empty, or non-string-element `argv` is a thrown
 * `TypeError` — a parse-time bug in the caller, not a runtime outcome to report through
 * `CommandResult`, so `config.ts`'s own parser is what turns a malformed `agentos.yml` into a
 * refusal before this function is ever reached.
 */
export function runCommand(argv: string[], cwd: string, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS): Promise<CommandResult> {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== "string" || a.length === 0)) {
    throw new TypeError(`runCommand: argv must be a non-empty array of non-empty strings, got ${JSON.stringify(argv)}`);
  }
  const [cmd, ...args] = argv;
  const start = Date.now();

  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        // Same posture as exec.ts's run(): never inherit a pager or colour codes we might parse.
        env: { ...process.env, GIT_PAGER: "cat", PAGER: "cat", NO_COLOR: "1" },
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - start;
        if (!error) {
          resolve({ exitCode: 0, stdout, stderr, timedOut: false, durationMs });
          return;
        }
        // Node sets `.killed = true` on the error when IT sent the kill signal — which, at this
        // call site, only ever happens because `timeout` elapsed. `.code` is the numeric exit
        // status when the process ran and exited non-zero; for a spawn failure (e.g. ENOENT) or a
        // signal kill, `.code` is either a string errno or absent, and the caller reads `null`.
        const err = error as NodeJS.ErrnoException & { killed?: boolean };
        const timedOut = err.killed === true;
        const exitCode = typeof err.code === "number" ? err.code : null;
        resolve({
          exitCode,
          stdout: stdout ?? "",
          // A spawn failure never reaches the child process, so stderr is empty; surface Node's
          // own error message there instead of silently reporting "no output at all."
          stderr: stderr && stderr.length > 0 ? stderr : exitCode === null ? err.message : stderr ?? "",
          timedOut,
          durationMs,
        });
      },
    );
  });
}

/** The last `n` lines of `text`, trailing empty lines stripped first so a command's final newline
 *  doesn't count as a blank line. Exported so `dispatch.ts` and the suite compute the same tail. */
export function lastLines(text: string, n: number): string {
  const trimmed = text.replace(/\n+$/, "");
  if (trimmed === "") return "";
  const lines = trimmed.split("\n");
  return lines.slice(-n).join("\n");
}

/**
 * How a command failed, in words a human can act on — one function, every caller.
 *
 * `runCommand` reports three distinct failures and only one carries an exit code: a non-zero exit,
 * a timeout, and a spawn failure (most often the executable is simply not there). Interpolating
 * `exitCode` unconditionally renders the latter two as the literal **"exited null"** — the least
 * actionable sentence available, for the likeliest misconfiguration there is.
 *
 * This lived as a private helper in `dispatch.ts` until review of #43 found `push.ts`'s `gh`
 * invoker had grown its own copy of the same bug — a `gh` that cannot spawn reported
 * `exited null` too. Two renderings of one fact that must agree are a second source of truth
 * wearing a justification (D36), so the fix is this function, here, next to the type it explains.
 */
export function describeCommandFailure(argv: string[], result: CommandResult, timeoutMs?: number): string {
  const cmd = argv.join(" ");
  if (result.timedOut) {
    return `command '${cmd}' timed out${timeoutMs === undefined ? "" : ` after ${timeoutMs}ms`}`;
  }
  if (result.exitCode === null) {
    // stderr carries Node's own spawn error — `runCommand` puts it there precisely because a
    // process that never started produced no output of its own.
    const detail = result.stderr.trim().split("\n")[0] || "no error output";
    return `command '${cmd}' could not be run: ${detail}`;
  }
  return `command '${cmd}' exited ${result.exitCode}`;
}
