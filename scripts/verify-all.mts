/**
 * Run every acceptance suite and report once.
 *
 * Replaces a `package.json` shell one-liner for two reasons. It was POSIX-only, so
 * `pnpm verify` would have died under `cmd.exe` while every suite it calls is
 * cross-platform. And the *reasoning* belongs somewhere a comment can live:
 *
 *   - **Every suite runs.** Chaining with `&&` meant Stage 1's one known failure hid
 *     Stage 2's eleven checks for three days, and nobody noticed until a third suite
 *     was added and also never ran (`docs/LEARNINGS.md`). A red test that suppresses
 *     other tests converts one known failure into unknown coverage.
 *   - **The exit code is a flag, not a sum.** Exit status is mod 256, so summing the
 *     suites' codes can land on 0 and report a false green — the one thing a
 *     verification harness may never do.
 */
import { spawnSync } from "node:child_process";

const SUITES = ["verify:stage1", "verify:stage2", "verify:stage3a"];

let anyFailed = false;
const results: { suite: string; code: number }[] = [];

for (const suite of SUITES) {
  const r = spawnSync("pnpm", [suite], { stdio: "inherit" });
  const code = r.status ?? 1;
  results.push({ suite, code });
  if (code !== 0) anyFailed = true;
}

console.log("\n── verify summary ──");
for (const { suite, code } of results) {
  console.log(`  ${code === 0 ? "ok  " : "FAIL"}  ${suite}`);
}
console.log(
  anyFailed
    ? "\nAt least one suite failed. Stage 1's AC-2 is a known, logged failure — see docs/BACKLOG.md\nbefore treating it as a regression.\n"
    : "\nAll suites green.\n",
);

process.exit(anyFailed ? 1 : 0);
