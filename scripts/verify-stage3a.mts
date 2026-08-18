/**
 * Stage 3a acceptance — the app shell.
 *
 * Most of this suite proves a *negative*: the Board still works. That is the
 * correct shape for a slice whose main risk is breaking a shipped surface.
 *
 * The shell's logic lives in `lib/shell/model.ts` as pure functions precisely so
 * this file can assert it without rendering a route. A suite that could only
 * check "the page did not throw" would be theatre.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BoardReport, ProjectReport, Severity } from "../lib/types.ts";
import {
  driftBandFor,
  hasExecutionLayer,
  projectNav,
  ribbonModel,
} from "../lib/shell/model.ts";

let failures = 0;
const pass = (id: string, detail: string) => console.log(`  PASS  ${id} — ${detail}`);
const fail = (id: string, detail: string) => {
  console.log(`  FAIL  ${id} — ${detail}`);
  failures++;
};
const check = (id: string, ok: boolean, detail: string) => (ok ? pass(id, detail) : fail(id, detail));

// ── fixtures ────────────────────────────────────────────────────────────────
const proj = (name: string, severity: Severity, path: string, checks: ProjectReport["checks"] = []): ProjectReport => ({
  name,
  path,
  severity,
  git: { ok: true, branch: "main", dirtyCount: 0, lastCommitISO: new Date().toISOString() } as ProjectReport["git"],
  github: { ok: true, open: [] } as ProjectReport["github"],
  docs: { roles: [] } as ProjectReport["docs"],
  checks,
  checkedAtISO: "2026-08-18T11:07:04.000Z",
});

const driftCheck = {
  id: "DC1",
  severity: "drift" as const,
  headline: 'docs/HANDOFF.md claims "PRs #1 through #22 merged"; #23 is merged.',
  claimed: "PRs #1 through #22 merged",
  verified: "#23 is merged (1 past the claim); unclaimed open: #24",
  source: "docs/HANDOFF.md",
  confidence: 0.95,
  claimHash: "abc123",
} as ProjectReport["checks"][number];

const tmp = mkdtempSync(join(tmpdir(), "agentos-3a-"));
const plainPath = join(tmp, "plain");
const optedPath = join(tmp, "opted");
mkdirSync(plainPath, { recursive: true });
mkdirSync(optedPath, { recursive: true });
writeFileSync(join(optedPath, "agentos.yml"), "project: opted\n");

const board: BoardReport = {
  checkedAtISO: "2026-08-18T11:07:04.000Z",
  degraded: false,
  projects: [
    proj("nadim", "drift", plainPath, [driftCheck]),
    proj("itqan", "attention", plainPath),
    proj("opted-in", "in-sync", optedPath),
  ],
};

console.log("\nStage 3a acceptance — the app shell\n");

// ── AC-1: the refactor changed nothing ──────────────────────────────────────
// The existing suites are used as a fixture, not extended. Their value is that
// they were written before this refactor and know nothing about it.
{
  const s1 = spawnSync("pnpm", ["verify:stage1"], { encoding: "utf8" });
  const s2 = spawnSync("pnpm", ["verify:stage2"], { encoding: "utf8" });
  const out1 = s1.stdout ?? "";
  const out2 = s2.stdout ?? "";
  const passes1 = (out1.match(/^\s+PASS/gm) ?? []).length;
  const fails1 = (out1.match(/^\s+FAIL/gm) ?? []).length;
  const passes2 = (out2.match(/^\s+PASS/gm) ?? []).length;
  const fails2 = (out2.match(/^\s+FAIL/gm) ?? []).length;

  // Stage 1: 7 passing + AC-2 failing for the logged reason (docs/BACKLOG.md).
  // Stage 2: 11 passing, 0 failing. Both are the pre-slice result.
  check(
    "AC-1",
    passes1 === 7 && fails1 === 1 && /AC-2/.test(out1) && passes2 === 11 && fails2 === 0,
    `existing suites unchanged — stage1 ${passes1}P/${fails1}F (AC-2 known), stage2 ${passes2}P/${fails2}F`,
  );
}

// ── AC-3: one collector run per request ─────────────────────────────────────
// Asserted structurally, not behaviourally, and the first attempt is why: a
// test that called React's `cache()` three times in a plain Node script saw
// three executions and "failed" while the app was correct — `cache` dedupes
// within a React render pass, which a script does not have. Asserting the
// import graph instead is the same move AC-14 makes in Stage 3: a check that
// fails while the invariant holds is the kind people learn to delete.
{
  // Walk the filesystem, not the git index. `git ls-files` lists only *tracked*
  // files, so a newly written module that imported buildBoard directly would pass
  // this check until someone committed it — a structural guard you can bypass by
  // not having committed yet is not a guard.
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });
  const files = ["app", "components", "lib"].flatMap(walk);

  const strays: string[] = [];
  const multi: string[] = [];
  for (const f of files) {
    if (f === "lib/reconcile/cached.ts" || f === "lib/reconcile/board.ts") continue;
    const src = readFileSync(f, "utf8");
    // Match both `@/lib/reconcile/board` and a relative `./board` from inside
    // lib/reconcile/ — the original pattern required the directory name in the
    // specifier, so a sibling importing "./board" bypassed the whole check.
    const inReconcile = f.startsWith("lib/reconcile/");
    const importsBoard =
      /from ["'][^"']*reconcile\/board["']/.test(src) ||
      (inReconcile && /from ["']\.\/board["']/.test(src));
    if (importsBoard) strays.push(f);
    const calls = (src.match(/\bboardOnce\(/g) ?? []).length;
    if (calls > 1) multi.push(`${f} (${calls}×)`);
  }
  check(
    "AC-3",
    strays.length === 0 && multi.length === 0,
    strays.length || multi.length
      ? `direct buildBoard imports: [${strays}]; multiple boardOnce calls: [${multi}]`
      : `every surface reads through boardOnce, at most once per module (${files.length} files scanned)`,
  );
}

// ── AC-4: a failed collector produces no confident ribbon ───────────────────
{
  const degraded = ribbonModel({ ...board, degraded: true });
  const healthy = ribbonModel(board);
  check(
    "AC-4",
    degraded.ok === false && /not shown|not checked/.test((degraded as { reason: string }).reason) && healthy.ok === true,
    degraded.ok === false
      ? `degraded run renders no severities — "${(degraded as { reason: string }).reason.slice(0, 48)}…"`
      : "degraded run still produced glyphs",
  );
}

// ── AC-5: the band is conditional, the ribbon is not ────────────────────────
{
  const banded = driftBandFor(board, "nadim");
  const unbanded = driftBandFor(board, "itqan");
  const model = ribbonModel(board);
  const itqanStillOnRibbon =
    model.ok && model.projects.find((p) => p.slug === "itqan")?.severity === "attention";
  const nadimClaimVerbatim = banded?.claimed === driftCheck.claimed;
  check(
    "AC-5",
    banded !== null && unbanded === null && itqanStillOnRibbon === true && nadimClaimVerbatim,
    "band present for nadim (claim verbatim), absent for itqan — whose severity is still on the ribbon",
  );
}

// ── AC-6: a watched-only project is complete, and has no execution tabs ─────
{
  const watched = projectNav(board, "itqan");
  const opted = projectNav(board, "opted-in");
  check(
    "AC-6",
    watched?.tabs.length === 0 &&
      watched?.executionLayer === false &&
      opted?.tabs.length === 5 &&
      opted?.executionLayer === true &&
      hasExecutionLayer(optedPath) &&
      !hasExecutionLayer(plainPath),
    `no agentos.yml → 0 tabs; agentos.yml present → ${opted?.tabs.length} tabs (opt-in read from disk, D18)`,
  );
}

// ── AC-8: an unknown slug is refused, not rendered as an empty shell ────────
{
  const missing = projectNav(board, "does-not-exist");
  check("AC-8", missing === null, "unknown slug resolves to null — the route calls notFound()");
}

// ── AC-2 / AC-7 / AC-9: composition-level, asserted at their seams ──────────
{
  const model = ribbonModel(board);
  check(
    "AC-2",
    model.ok && model.projects.length === board.projects.length && Boolean(model.checkedAtISO),
    model.ok ? `ribbon carries all ${model.projects.length} projects + shared freshness` : "ribbon degraded",
  );
  // D23: glyph and name only. A count or sentence here could contradict the Board.
  const lean = model.ok && model.projects.every((p) => Object.keys(p).sort().join() === "name,severity,slug");
  check("AC-2b", lean, "ribbon model carries no counts, sentences or deltas (D23)");
}

rmSync(tmp, { recursive: true, force: true });

console.log(
  failures === 0
    ? "\nAll Stage 3a acceptance criteria pass.\n"
    : `\n${failures} FAILING.\n`,
);
console.log(
  "AC-7 (⌘1 from any route) and AC-9 (/overview is honest) are single-component\n" +
  "surfaces verified by loading them; AC-10 is a measurement — see docs/FEATURES.md.\n",
);
process.exit(failures === 0 ? 0 : 1);
