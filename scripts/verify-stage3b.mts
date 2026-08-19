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
 * AC-4, AC-5, AC-8 (T2, "agent create and edit") append below AC-3. None of the three needs a git
 * fixture repo's *contents* — `createAgentForSlug` / `updateAgentForSlug` only need `boardOnce()`
 * to resolve a slug to a path and an execution-layer `Project` row already sitting at that path,
 * so each block reuses `makeConnectorFixtureRepo` purely for a real directory to point
 * `primaryRepoPath` at, and writes the `Project` row directly with `createProject` rather than
 * going through `initializeProject` (T1's own connector, already covered by AC-1..AC-2b above).
 *
 * AC-6, AC-7 (T3, "task create") append below AC-8b, plus AC-6b, a lead-review-style addition in
 * the same spirit as AC-8b: the ticket's own file names the exact hole ("what stops it naming an
 * agent in a different project?") so the check is written alongside the guard, not after a later
 * review finds it missing. AC-6 exercises `dispatch()` for real with a `FakeRunner` (empty script,
 * same shape as most of `verify-stage3.mts`'s own precondition checks) to prove the bound
 * assignee is actually dispatchable, not merely stored. AC-7 does the same for a human-only task
 * and asserts the SPECIFIC precondition dispatch refused by (`'agent'`), never just `started:
 * false`.
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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  openDb,
  listProjects,
  listTasksByProject,
  createProject,
  createAgent,
  createTask,
  createSession,
  updateSession,
  getAgent,
  getTask,
} from "../lib/agentos/db";
import { initializeProject, createTaskForSlug } from "../app/p/[slug]/[tab]/actions";
import { createAgentForSlug, updateAgentForSlug } from "../app/p/[slug]/config/actions";
import { parseAgentosYml } from "../lib/agentos/config";
import { EGRESS_DENIED_TOOLS } from "../lib/agentos/egress";
import { resolveToolGrants } from "../lib/agentos/agent-form";
import { loadProjectExecutionData } from "../lib/tasks/data";
import { dispatch } from "../lib/agentos/dispatch";
import { FakeRunner } from "../lib/agentos/runner/fake";
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

// ── AC-4 · an agent round-trips, including the two JSON tool columns ──────────────────────
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t2-ac4", dir);
  const db = openDb(":memory:");
  createProject(db, {
    slug: "t2-ac4",
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });

  const form = new FormData();
  form.set("slug", "t2-ac4");
  form.set("name", "Reviewer");
  form.set("monogram", "RV");
  form.set("model", "claude-opus-5");
  form.set("rolePrompt", "Reviews diffs for correctness.");
  form.append("tools", "Read");
  form.append("tools", "Bash");
  form.set("canCommit", "on");
  form.set("maxTurns", "42");
  form.set("maxBudgetUsd", "12.5");

  const result = await withOnlyProject(cfg, () => createAgentForSlug("t2-ac4", form, { db }));
  const agent = result.agentId ? getAgent(db, result.agentId) : null;

  if (!result.ok) {
    fail("AC-4", `create refused a valid agent submission: ${result.reason}`);
  } else if (!agent) {
    fail("AC-4", "createAgentForSlug reported ok but the row cannot be read back");
  } else {
    const allowed = (JSON.parse(agent.allowedToolsJson) as string[]).sort();
    const disallowed = (JSON.parse(agent.disallowedToolsJson) as string[]).sort();
    const mismatches: string[] = [];
    if (agent.name !== "Reviewer") mismatches.push(`name: ${agent.name}`);
    if (agent.monogram !== "RV") mismatches.push(`monogram: ${agent.monogram}`);
    if (agent.model !== "claude-opus-5") mismatches.push(`model: ${agent.model}`);
    if (agent.rolePrompt !== "Reviews diffs for correctness.")
      mismatches.push(`rolePrompt: ${agent.rolePrompt}`);
    if (JSON.stringify(allowed) !== JSON.stringify(["Bash", "Read"]))
      mismatches.push(`allowedToolsJson: ${JSON.stringify(allowed)}`);
    if (JSON.stringify(disallowed) !== JSON.stringify(["WebFetch", "WebSearch"]))
      mismatches.push(`disallowedToolsJson: ${JSON.stringify(disallowed)}`);
    if (agent.canCommit !== true || typeof agent.canCommit !== "boolean")
      mismatches.push(`canCommit: ${JSON.stringify(agent.canCommit)} (typeof ${typeof agent.canCommit})`);
    if (agent.maxTurns !== 42) mismatches.push(`maxTurns: ${agent.maxTurns}`);
    if (agent.maxBudgetUsd !== 12.5) mismatches.push(`maxBudgetUsd: ${agent.maxBudgetUsd}`);

    if (mismatches.length > 0) fail("AC-4", `round-trip mismatch — ${mismatches.join("; ")}`);
    else
      pass(
        "AC-4",
        `every field round-tripped unchanged — allowedToolsJson=${JSON.stringify(allowed)}, disallowedToolsJson=${JSON.stringify(disallowed)}, canCommit=true (boolean, not 1)`,
      );
  }
  db.close();
}

// ── AC-5 · the egress floor holds at creation, and it says so ─────────────────────────────
// Hostile fixture, per the spec's own instruction (§4): asks for WebFetch and WebSearch, plus
// one tool name that is not on the fixed list at all — "NotARealTool" — so this check also
// proves `resolveToolGrants`'s fixed-list filter is load-bearing, not just the egress floor.
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t2-ac5", dir);
  const db = openDb(":memory:");
  createProject(db, {
    slug: "t2-ac5",
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });

  const form = new FormData();
  form.set("slug", "t2-ac5");
  form.set("name", "Scraper");
  form.set("monogram", "SC");
  form.set("model", "claude-opus-5");
  form.set("rolePrompt", "Asks for the internet on purpose — a hostile fixture.");
  form.append("tools", "Read");
  form.append("tools", "WebFetch");
  form.append("tools", "WebSearch");
  form.append("tools", "NotARealTool");

  const result = await withOnlyProject(cfg, () => createAgentForSlug("t2-ac5", form, { db }));
  const agent = result.agentId ? getAgent(db, result.agentId) : null;

  if (!result.ok) {
    fail("AC-5", `create refused rather than stripping and storing: ${result.reason}`);
  } else if (!agent) {
    fail("AC-5", "createAgentForSlug reported ok but the row cannot be read back");
  } else {
    const allowed = JSON.parse(agent.allowedToolsJson) as string[];
    const disallowed = JSON.parse(agent.disallowedToolsJson) as string[];
    const problems: string[] = [];
    if (allowed.includes("WebFetch") || allowed.includes("WebSearch"))
      problems.push(`egress tools present in allowedToolsJson: ${JSON.stringify(allowed)}`);
    if (!disallowed.includes("WebFetch") || !disallowed.includes("WebSearch"))
      problems.push(`egress tools missing from disallowedToolsJson: ${JSON.stringify(disallowed)}`);
    if (allowed.includes("NotARealTool"))
      problems.push(`an unrecognized tool name reached allowedToolsJson unfiltered: ${JSON.stringify(allowed)}`);
    if (JSON.stringify([...allowed].sort()) !== JSON.stringify(["Read"]))
      problems.push(`allowedToolsJson should be exactly ["Read"], got ${JSON.stringify(allowed)}`);
    if (!result.reason || !result.reason.includes("WebFetch") || !result.reason.includes("WebSearch"))
      problems.push(`the UI's own result did not say so — reason: ${JSON.stringify(result.reason)}`);

    if (problems.length > 0) fail("AC-5", problems.join("; "));
    else
      pass(
        "AC-5",
        `WebFetch/WebSearch absent from allowedToolsJson, present in disallowedToolsJson, "NotARealTool" dropped, UI said: "${result.reason}"`,
      );
  }
  db.close();
}

// ── AC-8 · an agent with a running session cannot be edited — refused, row unchanged ──────
// Includes a positive control: once the session completes, the identical edit succeeds and the
// row actually changes — proof the refusal above was caused by the live session and not by
// updateAgentForSlug being broken (the "check was green for the wrong reason" trap).
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t2-ac8", dir);
  const db = openDb(":memory:");
  createProject(db, {
    slug: "t2-ac8",
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    maxConcurrentSessions: 5,
  });

  const createForm = new FormData();
  createForm.set("slug", "t2-ac8");
  createForm.set("name", "Original Name");
  createForm.set("monogram", "OG");
  createForm.set("model", "claude-opus-5");
  createForm.set("rolePrompt", "Does the work.");

  const created = await withOnlyProject(cfg, () => createAgentForSlug("t2-ac8", createForm, { db }));
  if (!created.ok || !created.agentId) {
    fail("AC-8", `setup: could not create the agent under test: ${created.reason}`);
  } else {
    const agentId = created.agentId;
    const project = listProjects(db).find((p) => p.slug === "t2-ac8")!;
    const task = createTask(db, {
      projectId: project.id,
      name: "t2-ac8 task",
      description: "",
      approvalGate: false,
      assigneeAgentId: agentId,
    });
    const session = createSession(db, {
      taskId: task.id,
      agentId,
      triggerKind: "manual",
      worktreePath: "/tmp/agentic-os-t2-ac8-does-not-need-to-exist",
      baseRef: "main",
      pid: 1,
      bootId: "boot-1",
      driftAtSpawn: {
        severity: "in-sync",
        claim: "n/a",
        verified: "n/a",
        source: "fixture",
        check: "fixture",
        checkedAtISO: new Date().toISOString(),
      },
    });

    const editForm = new FormData();
    editForm.set("slug", "t2-ac8");
    editForm.set("agentId", agentId);
    editForm.set("name", "Renamed While Running");
    editForm.set("monogram", "RW");
    editForm.set("model", "claude-opus-5");
    editForm.set("rolePrompt", "Does the work, renamed.");

    const blocked = await withOnlyProject(cfg, () => updateAgentForSlug("t2-ac8", agentId, editForm, { db }));
    const afterBlocked = getAgent(db, agentId)!;

    // Positive control — see block comment above.
    updateSession(db, session.id, { status: "completed", endedAtISO: new Date().toISOString() });
    const allowed = await withOnlyProject(cfg, () => updateAgentForSlug("t2-ac8", agentId, editForm, { db }));
    const afterAllowed = getAgent(db, agentId)!;

    const problems: string[] = [];
    if (blocked.ok) problems.push("edit succeeded while the session was still 'running'");
    if (!blocked.reason || !blocked.reason.includes(session.id))
      problems.push(`refusal did not name the session — reason: ${JSON.stringify(blocked.reason)}`);
    if (afterBlocked.name !== "Original Name")
      problems.push(`row changed despite the refusal — name is now "${afterBlocked.name}"`);
    if (!allowed.ok)
      problems.push(`positive control failed: edit was still refused once the session completed (${allowed.reason})`);
    if (afterAllowed.name !== "Renamed While Running")
      problems.push(
        `positive control failed: edit reported ok but the row did not change — name is "${afterAllowed.name}"`,
      );

    if (problems.length > 0) fail("AC-8", problems.join("; "));
    else
      pass(
        "AC-8",
        `refused: "${blocked.reason}" — row unchanged while live; same edit succeeded once the session completed`,
      );
  }
  db.close();
}

// ── AC-8b · one project cannot edit another project's agent ──────────────────────────────
// Not a spec-numbered criterion — a lead-review addition (2026-08-19). AC-4/5/8 all operate on an
// agent that legitimately belongs to the project named in the form, so the ownership guard in
// `updateAgentForSlug` could be deleted outright with all three still green. Verified by doing
// exactly that: reducing `if (!agent || agent.projectId !== owned.project.id)` to `if (!agent)`
// changed nothing. That guard is the *only* thing standing between a crafted form post and
// editing another project's agent — including its tool grants and `canCommit`. T7 shipped three
// server actions missing this same check and review found all three; the spec warned about it in
// advance (§6, "including its ownership check"). A security boundary nothing exercises is a
// boundary that will be removed by a future refactor without a single check going red.
{
  const victimRepo = makeConnectorFixtureRepo();
  const attackerRepo = makeConnectorFixtureRepo();
  const db = openDb(":memory:");

  for (const [slug, dir] of [["t2-victim", victimRepo.dir], ["t2-attacker", attackerRepo.dir]] as const) {
    createProject(db, { slug, primaryRepoPath: dir, yamlPath: join(dir, "agentos.yml"), maxConcurrentSessions: 1 });
  }

  const victimForm = new FormData();
  victimForm.set("slug", "t2-victim");
  victimForm.set("name", "Victim Agent");
  victimForm.set("monogram", "VA");
  victimForm.set("model", "claude-opus-5");
  victimForm.set("rolePrompt", "Belongs to the victim project.");
  victimForm.append("tools", "Read");
  const victim = await withOnlyProject(fixtureConfig("t2-victim", victimRepo.dir), () =>
    createAgentForSlug("t2-victim", victimForm, { db }),
  );

  // The crafted post: the attacker's own slug, the victim's agent id, and a wide grant.
  const craftedForm = new FormData();
  craftedForm.set("slug", "t2-attacker");
  craftedForm.set("name", "Owned");
  craftedForm.set("monogram", "XX");
  craftedForm.set("model", "claude-opus-5");
  craftedForm.set("rolePrompt", "Rewritten by another project.");
  craftedForm.append("tools", "Bash");
  craftedForm.set("canCommit", "on");

  const attempt = victim.agentId
    ? await withOnlyProject(fixtureConfig("t2-attacker", attackerRepo.dir), () =>
        updateAgentForSlug("t2-attacker", victim.agentId!, craftedForm, { db }),
      )
    : null;
  const after = victim.agentId ? getAgent(db, victim.agentId) : null;

  if (!victim.ok || !victim.agentId) fail("AC-8b", `setup: could not create the victim agent: ${victim.reason}`);
  else if (!attempt) fail("AC-8b", "setup: no attempt was made");
  else if (attempt.ok) fail("AC-8b", "one project edited another project's agent");
  else if (!attempt.reason?.includes(victim.agentId))
    fail("AC-8b", `the refusal did not name the agent it refused: ${JSON.stringify(attempt.reason)}`);
  else if (after?.name !== "Victim Agent" || after.canCommit !== false)
    fail("AC-8b", `the victim's row changed despite the refusal — name "${after?.name}", canCommit ${after?.canCommit}`);
  else pass("AC-8b", `refused: "${attempt.reason}" — the victim's row is untouched (name "${after.name}", canCommit false)`);
  db.close();
}

// ── AC-6 · a task is created with its assignee bound at creation, and dispatch succeeds ───
// T3, "task create". Both halves matter (docs/specs/stage-3b-tickets.md): the row carries the
// agent AND the task is actually dispatchable. Uses the scripted `FakeRunner`
// (`lib/agentos/runner/fake.ts`) — the model is never called, per spec §4.
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t3-ac6", dir);
  const db = openDb(":memory:");
  const project = createProject(db, {
    slug: "t3-ac6",
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });
  const agent = createAgent(db, {
    projectId: project.id,
    name: "Fixer",
    monogram: "FX",
    model: "claude-opus-5",
    rolePrompt: "Fixes things.",
    allowedTools: ["Read"],
    disallowedTools: [],
    canCommit: false,
  });

  const form = new FormData();
  form.set("slug", "t3-ac6");
  form.set("name", "Fix the flaky test");
  form.set("description", "It fails on CI about 1 in 10 runs.");
  form.set("assigneeAgentId", agent.id);
  form.set("approvalGate", "on");

  const created = await withOnlyProject(cfg, () => createTaskForSlug("t3-ac6", form, { db }));
  const task = created.taskId ? getTask(db, created.taskId) : null;

  // Left open (never `db.close()`ed) once a real dispatch is attempted below: a `dispatch()` that
  // starts kicks off an unawaited background continuation (§7.4) against this in-memory db, and
  // closing immediately after could race it into a benign, caught "database is not open" log line
  // (`dispatch.ts`'s own `.catch()`) — harmless, but avoided rather than invited, the same posture
  // `verify-stage3.mts`'s AC-16 documents at its own trailing comment.
  let dispatchAttempted = false;

  if (!created.ok || !task) {
    fail("AC-6", `task creation refused or unreadable: ${created.reason}`);
  } else if (task.assigneeAgentId !== agent.id) {
    fail(
      "AC-6",
      `assignee not bound at creation — assigneeAgentId is ${task.assigneeAgentId}, expected ${agent.id}`,
    );
  } else if (
    task.name !== "Fix the flaky test" ||
    task.description !== "It fails on CI about 1 in 10 runs." ||
    task.approvalGate !== true
  ) {
    fail(
      "AC-6",
      `task fields did not round-trip — name="${task.name}", description="${task.description}", approvalGate=${task.approvalGate}`,
    );
  } else {
    dispatchAttempted = true;
    const dispatched = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
    if (!dispatched.started) {
      fail("AC-6", `task carried its assignee but dispatch refused: (${dispatched.refusedBy}) ${dispatched.reason}`);
    } else {
      pass(
        "AC-6",
        `assignee "${agent.id}" bound at creation (task ${task.id}), title/description/approvalGate round-tripped, dispatch started session ${dispatched.sessionId}`,
      );
    }
  }
  if (!dispatchAttempted) db.close();
}

// ── AC-6b · one project cannot assign another project's agent at task creation ────────────
// Not spec-numbered — the same hole T2's AC-8b caught, and this ticket's own file warns about it
// by name (docs/specs/stage-3b-tickets.md T3: "what stops it naming an agent in a different
// project? If nothing checks that, that is the same hole T2 had."). Proven by doing exactly
// that: a crafted post, posted as the attacker project, names the victim project's agent.
{
  const victimRepo = makeConnectorFixtureRepo();
  const attackerRepo = makeConnectorFixtureRepo();
  const db = openDb(":memory:");
  const victimProject = createProject(db, {
    slug: "t3-victim",
    primaryRepoPath: victimRepo.dir,
    yamlPath: join(victimRepo.dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });
  const attackerProject = createProject(db, {
    slug: "t3-attacker",
    primaryRepoPath: attackerRepo.dir,
    yamlPath: join(attackerRepo.dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });
  const victimAgent = createAgent(db, {
    projectId: victimProject.id,
    name: "Victim Agent",
    monogram: "VA",
    model: "claude-opus-5",
    rolePrompt: "Belongs to the victim project.",
    allowedTools: [],
    disallowedTools: [],
    canCommit: false,
  });

  const craftedForm = new FormData();
  craftedForm.set("slug", "t3-attacker");
  craftedForm.set("name", "Steal the victim's agent");
  craftedForm.set("description", "");
  craftedForm.set("assigneeAgentId", victimAgent.id);

  const attempt = await withOnlyProject(fixtureConfig("t3-attacker", attackerRepo.dir), () =>
    createTaskForSlug("t3-attacker", craftedForm, { db }),
  );
  const attackerTasks = listTasksByProject(db, attackerProject.id).length;

  if (attempt.ok) fail("AC-6b", "one project assigned another project's agent to a new task");
  else if (!attempt.reason?.includes(victimAgent.id))
    fail("AC-6b", `refusal did not name the agent it refused: ${JSON.stringify(attempt.reason)}`);
  else if (attackerTasks !== 0)
    fail("AC-6b", `expected 0 tasks written for the attacker project, got ${attackerTasks}`);
  else pass("AC-6b", `refused: "${attempt.reason}" — 0 tasks written for project 't3-attacker'`);
  db.close();
}

// ── AC-7 · a human-only task refuses dispatch by precondition 4, naming it ────────────────
// A null assignee is deliberately human (Stage 3 spec §7.1), never unassigned. Asserts the
// SPECIFIC precondition ('agent'), not merely started === false — any of the five preconditions
// could produce that, and a check that cannot tell them apart is not testing this one.
{
  const { dir } = makeConnectorFixtureRepo();
  const cfg = fixtureConfig("t3-ac7", dir);
  const db = openDb(":memory:");
  const project = createProject(db, {
    slug: "t3-ac7",
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
    maxConcurrentSessions: 1,
  });
  // An agent exists in the project — proves the human-only choice was deliberate, not "there
  // was nothing to pick."
  createAgent(db, {
    projectId: project.id,
    name: "Bystander",
    monogram: "BY",
    model: "claude-opus-5",
    rolePrompt: "Exists to prove human-only was a choice, not a default.",
    allowedTools: [],
    disallowedTools: [],
    canCommit: false,
  });

  const form = new FormData();
  form.set("slug", "t3-ac7");
  form.set("name", "Human review of the release notes");
  form.set("description", "Needs a person's judgement.");
  // No assigneeAgentId field posted at all — the same as the select's own human-only option
  // ("") once read back with `String(formData.get(...) ?? "")`.

  const created = await withOnlyProject(cfg, () => createTaskForSlug("t3-ac7", form, { db }));
  const task = created.taskId ? getTask(db, created.taskId) : null;

  if (!created.ok || !task) {
    fail("AC-7", `task creation refused or unreadable: ${created.reason}`);
  } else if (task.assigneeAgentId !== null) {
    fail("AC-7", `assigneeAgentId was not null for a human-only task — got ${task.assigneeAgentId}`);
  } else {
    const dispatched = await dispatch(task.id, "manual", { db, runner: new FakeRunner({ messages: [] }) });
    if (dispatched.started) {
      fail("AC-7", "dispatch started a session for a human-only (null-assignee) task");
    } else if (dispatched.refusedBy !== "agent") {
      fail(
        "AC-7",
        `refused by the wrong precondition — expected 'agent', got '${dispatched.refusedBy}' (${dispatched.reason})`,
      );
    } else {
      pass(
        "AC-7",
        `human-only task (assigneeAgentId null) refused dispatch by precondition 'agent': "${dispatched.reason}"`,
      );
    }
  }
  db.close();
}

// ── AC-5b · the egress floor has exactly one definition ───────────────────────────────────
// Not spec-numbered — a lead-review addition (2026-08-19). T2 shipped a second copy of the denied
// list in `lib/agentos/agent-form.ts`, with a comment accepting "two independent lists that must
// agree" as a cost. A security boundary with two definitions is a second source of truth whose
// divergence is silent (invariant 5). Review extracted `lib/agentos/egress.ts`; this asserts the
// extraction holds — the floor is enforced at two moments, from one list.
{
  const files = ["lib/agentos/agent-form.ts", "lib/agentos/runner/local.ts"];
  const redefiners = files.filter((f) =>
    /(const|let|var)\s+\w*EGRESS\w*\s*[:=]/.test(readFileSync(join(process.cwd(), f), "utf8")),
  );
  const floorHolds =
    resolveToolGrants(["Read", "WebFetch", "WebSearch"]).allowed.join(",") === "Read" &&
    EGRESS_DENIED_TOOLS.length === 2;

  if (redefiners.length > 0)
    fail("AC-5b", `the egress list is redefined outside lib/agentos/egress.ts: [${redefiners.join(", ")}]`);
  else if (!floorHolds)
    fail("AC-5b", `the single shared list does not actually deny egress: ${JSON.stringify(resolveToolGrants(["Read", "WebFetch", "WebSearch"]))}`);
  else
    pass("AC-5b", `one definition (lib/agentos/egress.ts), imported by both enforcement points; [${EGRESS_DENIED_TOOLS.join(", ")}] denied at write time and at spawn`);
}

for (const t of TEMPS) rmSync(t, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll Stage 3b acceptance criteria pass.\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
