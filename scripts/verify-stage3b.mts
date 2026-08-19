/**
 * AC-1, AC-2, AC-3 from docs/specs/stage-3b-onboarding.spec.md §4 — T1, "the connector" — plus
 * AC-1b and AC-2b, two lead-review additions (2026-08-19) that are not spec-numbered: the three
 * criteria as written all feed the parser an empty file, so nothing proved the parser's output
 * was load-bearing and nothing proved §3.3's malformed-file refusal at all. Each carries its own
 * note at the check
 * (docs/specs/stage-3b-tickets.md). The rest of Stage 3b's nine checks land with later tickets,
 * appending to this same file (T1's own note in stage-3b-tickets.md: "everything else stacks on
 * this branch ... and to scripts/verify-stage3b.mts").
 *
 * Fixture repos in a temp dir; the model is never called. `initializeProject`'s only non-injected
 * dependency is `boardOnce()` (spec §7's seam table names only `Runner` and the fixture repo — a
 * "board fetcher" seam is not on it), so a fixture project is substituted by splicing
 * `projects.config.ts`'s `PROJECTS` array for the duration of one call — the exact trick
 * `scripts/verify-stage3.mts`'s `withOnlyProject` already established for `dispatch()`'s own
 * drift read. That helper is not exported (each verify-stage*.mts script owns its own fixture
 * family — verify-stage2.mts and verify-stage3.mts each define their own, never a shared module),
 * so it is copied here rather than imported.
 *
 * Every fixture directory is added to TEMPS as it is created; the single sweep at the bottom is
 * unconditional and runs last, after every check — including a failing one — has had the chance
 * to create its fixtures. Stage 3's suite leaked 454 temp dirs by having two sweeps that each only
 * covered what preceded them; this file has exactly one, at the true end.
 *
 * Run: pnpm verify:stage3b
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { openDb, listProjects } from "../lib/agentos/db";
import { initializeProject } from "../app/p/[slug]/[tab]/actions";
import { parseAgentosYml } from "../lib/agentos/config";
import { loadProjectExecutionData } from "../lib/tasks/data";
import type { ProjectConfig } from "../projects.config";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

const TEMPS: string[] = [];

// ── Fixture ─────────────────────────────────────────────────────────────────

/** A real git repo in a temp dir, with (or, deliberately, without) an `agentos.yml` at its root. */
function makeConnectorFixtureRepo(opts: { withAgentosYml?: boolean; yamlContents?: string } = {}): {
  dir: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "agentic-os-stage3b-connector-"));
  TEMPS.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  if (opts.withAgentosYml !== false) {
    writeFileSync(join(dir, "agentos.yml"), opts.yamlContents ?? "");
  }
  writeFileSync(join(dir, "README.md"), "# Stage 3b connector fixture\n");
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
  return { dir };
}

/**
 * Splices `PROJECTS`' *contents* — not the exported binding, which is `const` — to exactly one
 * fixture config for the duration of `fn`, then restores the original list. Reached via
 * `createRequire`, not a top-level `import`, for the same reason `verify-stage3.mts` documents at
 * its own `getProjects()`: this file is `.mts` (native ESM), but package.json carries no
 * `"type": "module"`, so `projects.config.ts` (a plain `.ts` file) loads through tsx's
 * CommonJS-compat path everywhere else in this codebase — `lib/reconcile/board.ts` included, which
 * is what `initializeProject`'s call to `boardOnce()` ultimately reads. A top-level `import`
 * here would resolve through the *ESM* registry instead: a different cache, holding a second,
 * independent array that `board.ts`'s own `require` chain never sees a splice to.
 */
const projectsConfigRequire = createRequire(import.meta.url);
function getProjects(): ProjectConfig[] {
  return (projectsConfigRequire("../projects.config") as { PROJECTS: ProjectConfig[] }).PROJECTS;
}

async function withOnlyProject<T>(cfg: ProjectConfig, fn: () => Promise<T>): Promise<T> {
  const PROJECTS = getProjects();
  const saved = PROJECTS.splice(0, PROJECTS.length, cfg);
  try {
    return await fn();
  } finally {
    PROJECTS.splice(0, PROJECTS.length, ...saved);
  }
}

function fixtureConfig(name: string, path: string): ProjectConfig {
  return { name, path, stalledAfterDays: 365, dirtyThreshold: 50 };
}

console.log("\nStage 3b acceptance — the connector, fixture repos only\n");

// ── AC-1 · initialize writes exactly one row, primaryRepoPath matches the board's own path ──
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t1-ac1", dir);
  const db = openDb(":memory:");

  const result = await withOnlyProject(cfg, () => initializeProject("t1-ac1", { db }));
  const rows = listProjects(db);
  const data = loadProjectExecutionData(dir, db);

  if (!result.ok) fail("AC-1", `initialize refused a fixture with a valid agentos.yml: ${result.reason}`);
  else if (rows.length !== 1) fail("AC-1", `expected exactly 1 Project row, got ${rows.length}`);
  else if (rows[0].primaryRepoPath !== dir)
    fail("AC-1", `primaryRepoPath "${rows[0].primaryRepoPath}" !== the board's own path "${dir}"`);
  else if (!data)
    fail("AC-1", "loadProjectExecutionData still returns null after a successful initialize — the Tasks page would still render 'not initialized'");
  else pass("AC-1", `1 row written, primaryRepoPath matches the board's own path (${dir}); Tasks page now loads`);
  db.close();
}

// ── AC-2 · no agentos.yml, no project — refused with a stated reason, zero new rows ─────────
{
  const { dir } = makeConnectorFixtureRepo({ withAgentosYml: false });
  const cfg = fixtureConfig("t1-ac2", dir);
  const db = openDb(":memory:");

  const result = await withOnlyProject(cfg, () => initializeProject("t1-ac2", { db }));
  const rows = listProjects(db);

  if (result.ok) fail("AC-2", "initialize succeeded against a fixture with no agentos.yml on disk");
  else if (!result.reason || result.reason.length < 10) fail("AC-2", `refusal reason too thin to be a stated reason: ${JSON.stringify(result.reason)}`);
  else if (rows.length !== 0) fail("AC-2", `expected 0 rows, got ${rows.length}`);
  else pass("AC-2", `refused: "${result.reason}" — 0 rows written`);
  db.close();
}

// ── AC-1b · the file's own values reach the row ────────────────────────────────────────────
// Not a spec-numbered criterion — a lead-review addition (2026-08-19). AC-1/2/3 all feed the
// parser an empty file, so `parsed.slug` and `parsed.maxConcurrentSessions` could both be
// deleted from `createProject` with every check still green. Verified by doing exactly that:
// all three passed. That is the T7-2 failure again — `registerFor()` was dead for rendering and
// its check asserted a value the UI ignored (docs/LEARNINGS.md, 2026-08-19). This check is what
// makes the parser's output load-bearing.
{
  const { dir } = makeConnectorFixtureRepo({
    yamlContents: "slug: from-the-file\nmaxConcurrentSessions: 3\n",
  });
  const cfg = fixtureConfig("t1-ac1b", dir);
  const db = openDb(":memory:");

  const result = await withOnlyProject(cfg, () => initializeProject("t1-ac1b", { db }));
  const rows = listProjects(db);

  if (!result.ok) fail("AC-1b", `initialize refused a well-formed agentos.yml: ${result.reason}`);
  else if (rows[0]?.slug !== "from-the-file")
    fail("AC-1b", `slug came from somewhere other than the file: got "${rows[0]?.slug}", expected "from-the-file"`);
  else if (rows[0]?.maxConcurrentSessions !== 3)
    fail("AC-1b", `maxConcurrentSessions did not reach the row: got ${rows[0]?.maxConcurrentSessions}, expected 3`);
  else if (rows[0]?.primaryRepoPath !== dir)
    fail("AC-1b", `the file must not be able to set primaryRepoPath — got "${rows[0]?.primaryRepoPath}"`);
  else pass("AC-1b", `slug "${rows[0].slug}" and maxConcurrentSessions ${rows[0].maxConcurrentSessions} both read from the file; primaryRepoPath still the board's`);
  db.close();
}

// ── AC-2b · a malformed agentos.yml refuses, verbatim, with zero rows ──────────────────────
// Spec §3.3 states this outright — "a malformed yaml is a refusal with the parse error shown
// verbatim, never a partially-created project" — and no numbered criterion covered it. A
// behaviour the spec requires and nothing checks is a behaviour that will be quietly lost.
{
  const { dir } = makeConnectorFixtureRepo({ yamlContents: "slug: [unclosed\n  bad: : :\n" });
  const cfg = fixtureConfig("t1-ac2b", dir);
  const db = openDb(":memory:");

  const parsed = parseAgentosYml("slug: [unclosed\n  bad: : :\n");
  const result = await withOnlyProject(cfg, () => initializeProject("t1-ac2b", { db }));
  const rows = listProjects(db);

  if (parsed.ok) fail("AC-2b", "the fixture yaml this check depends on is not actually malformed — the check would prove nothing");
  else if (result.ok) fail("AC-2b", "initialize accepted a malformed agentos.yml");
  else if (rows.length !== 0) fail("AC-2b", `expected 0 rows after a malformed file, got ${rows.length}`);
  else if (!result.reason?.includes(parsed.error))
    fail("AC-2b", `the refusal did not carry the parser's own message verbatim — reason: ${JSON.stringify(result.reason)}, parser said: ${JSON.stringify(parsed.error)}`);
  else pass("AC-2b", `refused verbatim: "${result.reason.slice(0, 90)}" — 0 rows written`);
  db.close();
}

// ── AC-3 · initializing twice is idempotent — second call reports already-initialized, ─────
// ── row count is still one ───────────────────────────────────────────────────────────────
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t1-ac3", dir);
  const db = openDb(":memory:");

  const first = await withOnlyProject(cfg, () => initializeProject("t1-ac3", { db }));
  const second = await withOnlyProject(cfg, () => initializeProject("t1-ac3", { db }));
  const rows = listProjects(db);

  if (!first.ok) fail("AC-3", `first initialize refused: ${first.reason}`);
  else if (!second.ok || !second.alreadyInitialized)
    fail("AC-3", `second call did not report already-initialized: ${JSON.stringify(second)}`);
  else if (rows.length !== 1) fail("AC-3", `expected exactly 1 row after two calls, got ${rows.length}`);
  else pass("AC-3", `second call reported "${second.reason}"; row count still 1 after two calls`);
  db.close();
}

for (const t of TEMPS) rmSync(t, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll Stage 3b acceptance criteria pass.\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
