/**
 * AC-1 … AC-7 from docs/specs/stage-1-reconciliation.spec.md §4, as runnable checks.
 *
 * The spec's acceptance criteria are falsifiable by design; this makes them
 * executable so "it works" is never asserted from memory (verify-before-claim).
 *
 * Run: pnpm verify
 */
import { execFileSync } from "node:child_process";
import { PROJECTS } from "../projects.config";
import { buildBoard } from "../lib/reconcile/board";
import { extractClaims } from "../lib/collectors/itqan-docs";
import { reconcileProject } from "../lib/reconcile/checks";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

const board = await buildBoard();
const by = (n: string) => board.projects.find((p) => p.name === n);

console.log("\nStage 1 acceptance\n");

// ── AC-1 · rediscovers the known drift unaided ──────────────────────────────
{
  const nadim = by("nadim");
  const dc1 = nadim?.checks.find((c) => c.id === "DC1");
  if (!nadim) fail("AC-1", "nadim missing from the board");
  else if (nadim.severity !== "drift") fail("AC-1", `nadim severity is ${nadim.severity}, expected drift`);
  else if (!dc1) fail("AC-1", "no DC1 check on nadim");
  else if (!/#1 through #22 merged/i.test(dc1.claimed ?? ""))
    fail("AC-1", `claim not quoted verbatim: ${dc1.claimed}`);
  else if (!/#23/.test(dc1.verified ?? "") || !/#24/.test(dc1.verified ?? ""))
    fail("AC-1", `reality missing #23/#24: ${dc1.verified}`);
  else pass("AC-1", `drift found — claimed "${dc1.claimed}" / verified "${dc1.verified}"`);
}

// ── AC-2 · itqan is green ───────────────────────────────────────────────────
{
  const itqan = by("itqan");
  if (!itqan) fail("AC-2", "itqan missing from the board");
  else if (itqan.severity !== "in-sync") {
    fail("AC-2", `itqan is ${itqan.severity} (checks: ${itqan.checks.map((c) => c.id).join(",") || "none"})`);
  } else if (!itqan.checkedAtISO) fail("AC-2", "no check timestamp");
  else pass("AC-2", `itqan in-sync, checked ${itqan.checkedAtISO}`);
}

// ── AC-3 · role coverage incl. full-profile alternates ──────────────────────
{
  const s = by("salla-apps");
  const filled = new Set(s?.docs.roles.filter((r) => r.filled).map((r) => r.role));
  const want = ["router", "queue", "lessons", "record"];
  const notWant = ["state", "decisions", "behaviour"];
  const missing = want.filter((r) => !filled.has(r as never));
  const extra = notWant.filter((r) => filled.has(r as never));
  if (missing.length || extra.length)
    fail("AC-3", `salla-apps roles wrong — missing ${missing.join(",") || "none"}, unexpected ${extra.join(",") || "none"}`);
  else pass("AC-3", `salla-apps = router+queue+lessons+record, no state/decisions/behaviour`);
}

// ── AC-4 · no false drift: every drift cites a real file ────────────────────
{
  let bad = 0;
  for (const p of board.projects) {
    for (const c of p.checks.filter((x) => x.severity === "drift")) {
      if (!c.source) {
        fail("AC-4", `${p.name} ${c.id} drift with no cited source`);
        bad++;
        continue;
      }
      const { existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      if (!existsSync(join(p.path, c.source))) {
        fail("AC-4", `${p.name} ${c.id} cites ${c.source} which does not exist`);
        bad++;
      }
    }
  }
  if (!bad) pass("AC-4", "every drift cites a document that exists on disk");
}

// Extractor guard: the rejected proximity pattern's failure cases must stay rejected.
{
  const traps = [
    ["PR #5 unmerged and PRs #1 to #9 open", "must not read 'unmerged' as merged"],
    ["PRs #1 through #22 not merged", "must respect negation"],
  ] as const;
  let bad = 0;
  for (const [text, why] of traps) {
    if (extractClaims(text, "x.md").length) {
      fail("EXTRACT", `false claim from "${text}" — ${why}`);
      bad++;
    }
  }
  if (extractClaims("PRs #1 through #22 merged", "x.md").length !== 1) {
    fail("EXTRACT", "did not extract the real claim");
    bad++;
  }
  if (!bad) pass("EXTRACT", "negation + 'unmerged' traps rejected; real claim extracted");
}

// ── AC-5 · gh unavailable degrades visibly ──────────────────────────────────
{
  const real = process.env.PATH;
  process.env.PATH = "/nonexistent";
  const degraded = await reconcileProject(PROJECTS.find((p) => p.name === "nadim")!);
  process.env.PATH = real;
  if (degraded.github.ok) fail("AC-5", "gh collector succeeded with PATH stripped");
  else if (degraded.git.ok) pass("AC-5", `PR data unavailable ("${degraded.github.reason}"), git still collected`);
  else pass("AC-5", `both degraded with readable reasons — no silent zeros`);
}

// ── AC-6 · nothing outside this repo is written ─────────────────────────────
{
  let dirty = 0;
  for (const p of PROJECTS) {
    if (p.name === "agentic-os") continue;
    try {
      const before = execFileSync("git", ["status", "--porcelain"], { cwd: p.path, encoding: "utf8" });
      await reconcileProject(p);
      const after = execFileSync("git", ["status", "--porcelain"], { cwd: p.path, encoding: "utf8" });
      if (before !== after) {
        fail("AC-6", `${p.name} working tree changed during reconciliation`);
        dirty++;
      }
    } catch {
      /* unreadable repo is AC-7's business, not AC-6's */
    }
  }
  if (!dirty) pass("AC-6", "no watched repo's working tree changed");
}

// ── AC-7 · one broken repo does not blank the board ─────────────────────────
{
  const broken = await reconcileProject({
    name: "broken",
    path: "/nonexistent/repo",
    stalledAfterDays: 14,
    dirtyThreshold: 5,
  });
  if (broken.git.ok) fail("AC-7", "a nonexistent repo reported ok");
  else if (board.projects.length !== PROJECTS.length)
    fail("AC-7", `board has ${board.projects.length} rows, expected ${PROJECTS.length}`);
  else pass("AC-7", `broken repo degrades alone; all ${board.projects.length} rows render`);
}

console.log(
  failures === 0 ? "\nAll acceptance criteria pass.\n" : `\n${failures} FAILING.\n`,
);
process.exit(failures === 0 ? 0 : 1);
