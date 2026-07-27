/**
 * AC-1 … AC-11 from docs/specs/stage-2-fix-proposals.spec.md §4, as runnable checks.
 *
 * Every test runs against a fixture repo generated in a temp directory. Stage 1's
 * AC-6 proved no watched repo is ever written to; this slice introduces writes,
 * so its tests must never point at a real project. A test that mutates nadim to
 * prove it can mutate nadim has destroyed the thing it was verifying (§4).
 *
 * Run: pnpm verify:stage2
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECTS } from "../projects.config";
import { collectDocs } from "../lib/collectors/itqan-docs";
import { dc1Checks, reconcileProject } from "../lib/reconcile/checks";
import { applyFix } from "../lib/fix/apply";
import { proposeFix, type FixProposal } from "../lib/fix/propose";
import { acknowledge, readAcknowledgements } from "../lib/fix/verified";
import type { CheckResult, GitHubFacts } from "../lib/types";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

const TEMPS: string[] = [];

// ── Fixture ─────────────────────────────────────────────────────────────────

const HANDOFF = `# Fixture — Session Handoff

## Where things stand

- **PRs #1 through #22 merged** (verified 2026-07-13 via gh pr list).
- Working tree clean.

## Next up

1. Ship the thing.
`;

const LEARNINGS = `# Fixture — Learnings

## Docs & claims

- (2026-07-01) An older lesson that must survive untouched.

## Workflow

- (2026-07-02) Another lesson.
`;

interface Fixture {
  dir: string;
  headSha: string;
}

function makeFixture(opts: { lessons?: boolean } = {}): Fixture {
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-fixture-"));
  TEMPS.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });

  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "CLAUDE.md"), "# Fixture router\n");
  writeFileSync(join(dir, "docs/HANDOFF.md"), HANDOFF);
  writeFileSync(join(dir, "README.md"), "# Fixture\n");
  if (opts.lessons !== false) writeFileSync(join(dir, "docs/LEARNINGS.md"), LEARNINGS);

  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
  const headSha = git("rev-parse", "HEAD").trim();
  return { dir, headSha };
}

/** Stubbed reality: #23 merged, #24 open (§4 AC-1). A fixture has no remote to ask. */
const GITHUB: GitHubFacts = {
  ok: true,
  open: [
    {
      number: 24,
      title: "Open PR the doc never mentions",
      updatedAtISO: new Date().toISOString(),
      reviewDecision: null,
      isDraft: false,
    },
  ],
  mergedNumbers: [21, 22, 23],
  maxMerged: 23,
};

function driftOn(dir: string): CheckResult | undefined {
  return dc1Checks("fixture", collectDocs(dir), GITHUB)[0];
}

function proposeOn(dir: string): FixProposal | null {
  const check = driftOn(dir);
  if (!check) return null;
  const p = proposeFix("fixture", dir, check, "2026-07-27");
  return p.available ? p : null;
}

const status = (dir: string) =>
  execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });

console.log("\nStage 2 acceptance — fixture repos only\n");

// ── AC-1 · a proposal is produced, #22 → #23 ────────────────────────────────
{
  const { dir } = makeFixture();
  const p = proposeOn(dir);
  if (!p) fail("AC-1", "no proposal produced from a fixture with a stale frontier");
  else if (p.token.before !== "22" || p.token.after !== "23")
    fail("AC-1", `token ${p.token.before} → ${p.token.after}, expected 22 → 23`);
  else if (!p.line.after.includes("#23"))
    fail("AC-1", `corrected line does not carry #23: ${p.line.after}`);
  else pass("AC-1", `proposal changes #${p.token.before} → #${p.token.after} on line ${p.line.number}`);
}

// ── AC-2 · the diff is the whole line, not the token ────────────────────────
{
  const { dir } = makeFixture();
  const p = proposeOn(dir)!;
  const full = "- **PRs #1 through #22 merged** (verified 2026-07-13 via gh pr list).";
  if (p.line.before !== full) fail("AC-2", `before is not the full line: ${JSON.stringify(p.line.before)}`);
  else if (!p.line.after.includes("verified 2026-07-13"))
    fail("AC-2", "after dropped the surrounding prose");
  else if (p.line.before.slice(p.token.start, p.token.end) !== "22")
    fail("AC-2", `token offsets point at ${JSON.stringify(p.line.before.slice(p.token.start, p.token.end))}`);
  else if (!p.contextWarning || p.contextWarning.date !== "2026-07-13")
    fail("AC-2", "the untouched date on the edited line was not surfaced (§3.3)");
  else pass("AC-2", `whole line exposed; untouched "${p.contextWarning.date}" flagged for the reader`);
}

// ── AC-3 · NOTHING is written without approval ──────────────────────────────
// The single most important test in this slice.
{
  const { dir } = makeFixture();
  const before = readFileSync(join(dir, "docs/HANDOFF.md"), "utf8");
  const beforeLessons = readFileSync(join(dir, "docs/LEARNINGS.md"), "utf8");
  const beforeStatus = status(dir);

  const p = proposeOn(dir); // build it, do not apply it
  void p;

  const after = readFileSync(join(dir, "docs/HANDOFF.md"), "utf8");
  const afterLessons = readFileSync(join(dir, "docs/LEARNINGS.md"), "utf8");
  if (before !== after) fail("AC-3", "state doc changed without approval");
  else if (beforeLessons !== afterLessons) fail("AC-3", "lessons changed without approval");
  else if (beforeStatus !== status(dir)) fail("AC-3", `working tree changed: ${status(dir)}`);
  else pass("AC-3", "proposal built, nothing approved, fixture byte-identical");
}

// ── AC-4 · the file on disk equals the preview ──────────────────────────────
{
  const { dir } = makeFixture();
  const p = proposeOn(dir)!;
  const previewed = p.writes.find((w) => w.relPath === "docs/HANDOFF.md")!.nextContent;
  const res = applyFix(p);
  const disk = readFileSync(join(dir, "docs/HANDOFF.md"), "utf8");
  if (!res.ok) fail("AC-4", `apply refused: ${res.reason}`);
  else if (disk !== previewed) fail("AC-4", "disk differs from the previewed content");
  else if (!disk.includes("#1 through #23 merged")) fail("AC-4", "correction not present on disk");
  else if (!disk.includes("verified 2026-07-13")) fail("AC-4", "surrounding prose was altered");
  else pass("AC-4", `disk matches the preview byte for byte (${disk.length} bytes)`);
}

// ── AC-5 · the paired lesson, and the honest skip ───────────────────────────
{
  const { dir } = makeFixture();
  const p = proposeOn(dir)!;
  applyFix(p);
  const lessons = readFileSync(join(dir, "docs/LEARNINGS.md"), "utf8");
  const added = lessons.split("\n").filter((l) => l.includes("Caught by agentic-os"));

  const bare = makeFixture({ lessons: false });
  const p2 = proposeOn(bare.dir)!;
  const bareStatusBefore = status(bare.dir);
  applyFix(p2);

  if (added.length !== 1) fail("AC-5", `${added.length} lessons appended, expected 1`);
  else if (!added[0].startsWith("- (2026-07-27)")) fail("AC-5", `lesson is undated: ${added[0]}`);
  else if (!lessons.includes("An older lesson that must survive untouched"))
    fail("AC-5", "appending clobbered an existing lesson");
  else if (p2.writes.length !== 1 || !p2.lessonsSkippedReason)
    fail("AC-5", "a project with no lessons file did not report the skip");
  else if (status(bare.dir).split("\n").filter(Boolean).length !== bareStatusBefore.split("\n").filter(Boolean).length + 1)
    fail("AC-5", "the lessons-less fixture had more than the state doc written");
  else pass("AC-5", `one dated line appended; no-lessons fixture reports "${p2.lessonsSkippedReason.slice(0, 46)}…"`);
}

// ── AC-6 · a file that changed after the proposal is refused ────────────────
{
  const { dir } = makeFixture();
  const p = proposeOn(dir)!;
  const meddled = HANDOFF.replace("Working tree clean.", "Someone else edited this line.");
  writeFileSync(join(dir, "docs/HANDOFF.md"), meddled);

  const res = applyFix(p);
  const disk = readFileSync(join(dir, "docs/HANDOFF.md"), "utf8");
  const lessons = readFileSync(join(dir, "docs/LEARNINGS.md"), "utf8");
  if (res.ok) fail("AC-6", "stale proposal was applied");
  else if (!/changed after the proposal/.test(res.reason ?? "")) fail("AC-6", `unreadable reason: ${res.reason}`);
  else if (disk !== meddled) fail("AC-6", "the meddled file was overwritten anyway");
  else if (lessons.includes("Caught by agentic-os"))
    fail("AC-6", "the lesson was appended even though the correction was refused — not all-or-nothing");
  else pass("AC-6", `refused with "${res.reason!.slice(0, 52)}…"; both files untouched`);
}

// ── AC-7 · the write lands unstaged, uncommitted ────────────────────────────
{
  const { dir, headSha } = makeFixture();
  applyFix(proposeOn(dir)!);
  const lines = status(dir).split("\n").filter(Boolean);
  const staged = lines.filter((l) => l[0] !== " " && l[0] !== "?");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  const count = execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();

  if (lines.length !== 2) fail("AC-7", `expected 2 modified files, got: ${JSON.stringify(lines)}`);
  else if (staged.length) fail("AC-7", `something was staged: ${staged.join(", ")}`);
  else if (head !== headSha || count !== "1") fail("AC-7", `history moved: ${head} (${count} commits)`);
  else pass("AC-7", `${lines.map((l) => l.trim()).join(", ")} — unstaged, HEAD unmoved`);
}

// ── AC-8 · no automatic fix says why ────────────────────────────────────────
{
  const { dir } = makeFixture();
  const dc3: CheckResult = {
    id: "DC3",
    severity: "drift",
    headline: "state doc 9d older than the last commit",
    confidence: 1,
    source: "docs/HANDOFF.md",
  };
  const r = proposeFix("fixture", dir, dc3, "2026-07-27");
  const dc8 = proposeFix("fixture", dir, { ...dc3, id: "DC8" }, "2026-07-27");
  if (r.available) fail("AC-8", "DC3 produced a proposal");
  else if (r.reason.length < 40) fail("AC-8", `reason is too thin to be an explanation: ${r.reason}`);
  else if (dc8.available || !/authorship/.test(dc8.reason))
    fail("AC-8", "DC8 did not explain that the remedy is authorship");
  else pass("AC-8", `DC3 → "${r.reason.slice(0, 58)}…"`);
}

// ── AC-9 · acknowledgements persist and expire on change ────────────────────
{
  const dataDir = mkdtempSync(join(tmpdir(), "agentic-os-data-"));
  TEMPS.push(dataDir);
  process.env.AGENTIC_OS_DATA_DIR = dataDir;

  const { dir } = makeFixture();
  const check = driftOn(dir)!;
  acknowledge(check.claimHash!, {
    atISO: new Date().toISOString(),
    project: "fixture",
    checkId: "DC1",
    claim: check.claimed!,
  });

  const reloaded = readAcknowledgements(); // a fresh read = a page reload
  const survives = Boolean(reloaded[check.claimHash!]);

  // Now the underlying claim changes: the doc is corrected to #23.
  applyFix(proposeOn(dir)!);
  const after = driftOn(dir); // reality is #23 merged, #24 open → still drift, new claim
  const expired = !after || !reloaded[after.claimHash!];

  delete process.env.AGENTIC_OS_DATA_DIR;
  if (!survives) fail("AC-9", "acknowledgement did not survive a reload");
  else if (!after) fail("AC-9", "the corrected fixture produced no follow-on claim to test expiry against");
  else if (!expired) fail("AC-9", "acknowledgement still applied after the claim text changed");
  else pass("AC-9", "survives reload; expires when the claim changes (hash keyed on claim + frontier)");
}

// ── AC-10 · path confinement ────────────────────────────────────────────────
{
  const { dir } = makeFixture();
  const escapee = join(tmpdir(), "agentic-os-escapee.md");
  writeFileSync(escapee, "should never be touched\n");
  TEMPS.push(escapee);

  const p = proposeOn(dir)!;
  const outside: FixProposal = {
    ...p,
    writes: [{ ...p.writes[0], absPath: escapee, relPath: "../../escapee.md" }],
  };
  const traversal: FixProposal = {
    ...p,
    writes: [{ ...p.writes[0], absPath: join(dir, "docs", "..", "..", "escapee.md") }],
  };
  const wrongFile: FixProposal = {
    ...p,
    writes: [{ ...p.writes[0], absPath: join(dir, "README.md"), relPath: "README.md" }],
  };

  const a = applyFix(outside);
  const b = applyFix(traversal);
  const c = applyFix(wrongFile);
  const readme = readFileSync(join(dir, "README.md"), "utf8");

  if (a.ok || b.ok) fail("AC-10", "a write outside the project directory was allowed");
  else if (!/resolves outside/.test(a.reason ?? "") || !/resolves outside/.test(b.reason ?? ""))
    fail("AC-10", `refused, but not by path confinement: ${a.reason} / ${b.reason}`);
  else if (c.ok || readme !== "# Fixture\n")
    fail("AC-10", "a write to a non-state, non-lessons file inside the project was allowed");
  else if (!/not this project's state document or lessons file/.test(c.reason ?? ""))
    // The allow-list must be what stops this, not the content hash further down:
    // a same-content file inside the repo would otherwise slip through.
    fail("AC-10", `README refused by the wrong guard: ${c.reason}`);
  else if (readFileSync(escapee, "utf8") !== "should never be touched\n")
    fail("AC-10", "the outside file was modified");
  else pass("AC-10", "outside path + traversal stopped by confinement; in-project non-target stopped by the allow-list");
}

// ── AC-11 · viewing the Board still writes to no watched repo ───────────────
// Stage 1's AC-6, re-run with proposals *rendered but unapproved*.
{
  let dirty = 0;
  let proposals = 0;
  for (const cfg of PROJECTS) {
    if (cfg.name === "agentic-os") continue; // this repo is mid-build; its own tree moves
    let before: string;
    try {
      before = status(cfg.path);
    } catch {
      continue; // unreadable repo is Stage 1 AC-7's business
    }
    const report = await reconcileProject(cfg);
    for (const check of report.checks.filter((c) => c.severity === "drift")) {
      if (proposeFix(cfg.name, cfg.path, check).available) proposals++;
    }
    if (status(cfg.path) !== before) {
      fail("AC-11", `${cfg.name} working tree changed while rendering proposals`);
      dirty++;
    }
  }
  if (!dirty) pass("AC-11", `${proposals} live proposal(s) built; no watched repo's tree changed`);
}

for (const t of TEMPS) rmSync(t, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll Stage 2 acceptance criteria pass.\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
