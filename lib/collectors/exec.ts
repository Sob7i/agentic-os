import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Run a command in a repo and return stdout, or null on any failure.
 *
 * Deliberately returns null rather than throwing: a failing command is expected
 * (no remote, gh unauthenticated, repo missing) and must degrade one check, never
 * blank the board (spec AC-5, AC-7).
 */
export async function run(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 15_000,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      // Never inherit a pager or colour codes — we parse this.
      env: { ...process.env, GIT_PAGER: "cat", PAGER: "cat", NO_COLOR: "1" },
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/** Days between an ISO timestamp and now, rounded down. */
export function ageInDays(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Compact human age: "3h", "12d", "5w". Used for dense roster cells. */
export function humanAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 21) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}
