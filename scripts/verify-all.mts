/**
 * Run every acceptance suite and report once.
 *
 * **The suite list is discovered, not written down.** It comes from `package.json`'s own
 * `verify:*` scripts, so adding a stage means adding one script entry and nothing else. That
 * is not tidiness — it is the fix for a merge conflict this file caused:
 *
 *   Stage 3a and Stage 3 were built on branches off the same base, and each had to add its
 *   suite to a *shared, hand-maintained list*. Both edited the same line, so merging them
 *   conflicted on a question containing no real disagreement — both wanted their suite to run.
 *   A list that two branches must both edit is a conflict waiting for a second branch.
 *
 * Two decisions this file exists to hold, which a `package.json` one-liner could not explain:
 *
 *   - **Every suite runs.** Chaining with `&&` meant Stage 1's one known failure hid Stage 2's
 *     eleven checks for three days, and nobody noticed until a third suite was added and also
 *     never ran (`docs/LEARNINGS.md`). A red test that suppresses other tests converts one known
 *     failure into unknown coverage.
 *   - **The exit code is a flag, not a sum.** Exit status is mod 256, so summing the suites'
 *     codes can land on 0 and report a false green — the one thing a verification harness may
 *     never do.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** Natural sort, so `verify:stage10` lands after `verify:stage2` rather than before it. */
const natural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const suites: string[] = Object.keys(pkg.scripts ?? {})
  .filter((k) => k.startsWith("verify:"))
  .sort(natural);

if (suites.length === 0) {
  console.error("No verify:* scripts found in package.json — nothing to run.");
  process.exit(1);
}

const results: { suite: string; code: number }[] = [];
for (const suite of suites) {
  const r = spawnSync("pnpm", [suite], { stdio: "inherit" });
  results.push({ suite, code: r.status ?? 1 });
}

const anyFailed = results.some((r) => r.code !== 0);

console.log(`\n── verify summary — ${results.length} suites ──`);
for (const { suite, code } of results) console.log(`  ${code === 0 ? "ok  " : "FAIL"}  ${suite}`);
console.log(
  anyFailed
    ? "\nAt least one suite failed. Stage 1's AC-2 is a known, logged failure — see docs/BACKLOG.md\nbefore treating it as a regression.\n"
    : "\nAll suites green.\n",
);

process.exit(anyFailed ? 1 : 0);
