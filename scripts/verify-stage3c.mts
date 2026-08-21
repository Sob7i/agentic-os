/**
 * Stage 3c acceptance — the board and the rail, second pass.
 * Spec: docs/specs/stage-3c-board-and-rail.spec.md
 *
 * **Two classes of check, marked, because conflating them is how this repo has three times shipped
 * code whose deletion left the suite green:**
 *
 *   [F] feature — fails when the feature is deleted. The deletion probe is named in the spec.
 *   [G] guard   — passes trivially today; fails only when a specific sin is committed. Every guard
 *                 must have had its sin committed and observed red before its ticket shipped.
 *
 * Idioms copied from `verify-stage3b.mts` deliberately: the pass/fail pair, one unconditional TEMPS
 * sweep at the true end, and a try/catch/finally around the whole run so a check that *throws*
 * reports as a failure instead of vanishing with an exit code nobody reads.
 *
 * T1 lands AC-1..AC-8, AC-17, AC-19 and AC-21. T2, T3 and T4 append their own.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname, resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  SETUP_ROWS,
  setupSectionFor,
  driftLineFor,
  projectRailModel,
  type ProjectNav,
} from "../lib/shell/model";
import { drawerOutcome, initialDrawerFor } from "../lib/shell/drawer";
import { GLYPH, WORD } from "../lib/severity";
import { gateRefusalReason } from "../lib/agentos/mcp/gate";
import { dropVerdict, dropTargets, handMoveReason } from "../lib/tasks/dnd";
import { gateModelFor, cardModel, registerFor, evidenceLineFor } from "../lib/tasks/model";
import { moveTaskForSlug, moveTaskAction } from "../app/p/[slug]/[tab]/actions";
import {
  openDb,
  createProject,
  createAgent,
  createTask,
  createSession,
  createInboxMessage,
  getTask,
  listTaskEvents,
  listSessionsByProject,
  writeTaskTransition,
} from "../lib/agentos/db";
import { openInboxCount } from "../lib/tasks/data";
import { inboxModel } from "../lib/tasks/inbox-model";
import type { BoardReport, ProjectReport, Severity } from "../lib/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `PROJECTS` is reached through `createRequire`, never a top-level import — the two-registry
 * problem `verify-stage3b.mts` documents: this file is native ESM, but `projects.config.ts` loads
 * through tsx's CommonJS path everywhere else, including the chain `resolveNav` reads. A top-level
 * import would splice a second, independent array nothing else ever sees.
 */
const projectsConfigRequire = createRequire(import.meta.url);
interface ProjectConfigLike { name: string; path: string; stalledAfterDays: number; dirtyThreshold: number }
function getProjects(): ProjectConfigLike[] {
  return (projectsConfigRequire("../projects.config") as { PROJECTS: ProjectConfigLike[] }).PROJECTS;
}

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

const TEMPS: string[] = [];

// ── Fixtures ────────────────────────────────────────────────────────────────

function fixtureProject(over: Partial<ProjectReport> = {}): ProjectReport {
  return {
    name: "fixture",
    path: "/tmp/fixture",
    severity: "in-sync",
    git: { ok: true } as ProjectReport["git"],
    github: { ok: true } as ProjectReport["github"],
    docs: {} as ProjectReport["docs"],
    checks: [],
    checkedAtISO: "2026-08-21T00:00:00.000Z",
    ...over,
  };
}

/** A ProjectNav without touching disk — `projectNav` itself reads `agentos.yml` via existsSync. */
function navFor(opts: { executionLayer: boolean; project?: ProjectReport }): ProjectNav {
  const project = opts.project ?? fixtureProject();
  return {
    project,
    slug: project.name,
    executionLayer: opts.executionLayer,
    tabs: opts.executionLayer
      ? [
          { key: "tasks", label: "Tasks" },
          { key: "goals", label: "Goals" },
          { key: "inbox", label: "Inbox" },
          { key: "sessions", label: "Sessions" },
          { key: "costs", label: "Costs" },
        ]
      : [],
    setup: opts.executionLayer ? [...SETUP_ROWS] : [],
  };
}

function tmpDir(tag: string): string {
  const d = mkdtempSync(join(tmpdir(), `agentic-os-stage3c-${tag}-`));
  TEMPS.push(d);
  return d;
}


/**
 * A project seeded in its own in-memory store, spliced into `PROJECTS` so `resolveNav` — and
 * therefore `moveTaskForSlug` — can resolve its slug. The `Project.primaryRepoPath` must equal the
 * config `path`, because that is the one fact the two sides share (`lib/tasks/data.ts`).
 */
function seedProject(tag: string, sharedDb?: ReturnType<typeof openDb>) {
  const dir = tmpDir(tag);
  const db = sharedDb ?? openDb(join(dir, "t.sqlite"));
  const project = createProject(db, {
    slug: tag,
    primaryRepoPath: dir,
    yamlPath: join(dir, "agentos.yml"),
  });
  writeFileSync(join(dir, "agentos.yml"), "");
  const agent = createAgent(db, {
    projectId: project.id,
    name: `${tag}-agent`,
    monogram: "AA",
    model: "m",
    rolePrompt: "r",
    allowedTools: [],
    disallowedTools: [],
    canCommit: false,
    maxTurns: 5,
    maxBudgetUsd: 1,
  });
  const PROJECTS = getProjects();
  PROJECTS.push({ name: tag, path: dir, stalledAfterDays: 365, dirtyThreshold: 50 });
  return { dir, db, project, agent, slug: tag };
}


/**
 * Runs a call that is expected to **refuse**, turning a throw into a reportable outcome instead of
 * killing the run.
 *
 * The file-level try/catch already stops a throw from vanishing, but it attributes every throw to
 * `suite` and abandons the remaining checks. That matters here because the whole point of AC-13 is
 * that an unvalidated destination reaches SQLite and *throws* rather than being refused — so the
 * failure this suite must describe most precisely was the one it reported least precisely, and a
 * sin committed in one check was hiding every check after it.
 */
async function attempt<T>(fn: () => Promise<T>): Promise<{ threw: false; value: T } | { threw: true; error: string }> {
  try {
    return { threw: false, value: await fn() };
  } catch (err) {
    return { threw: true, error: err instanceof Error ? err.message : String(err) };
  }
}


/** Every `*.module.css` under a directory. */
function walkCss(dir: string, hit: (f: string) => void): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkCss(p, hit);
    else if (/\.module\.css$/.test(e.name)) hit(p);
  }
}

// ── Import-graph walker (AC-1) ──────────────────────────────────────────────

/**
 * Follows **value** edges only. `import type { … }` and a clause whose every specifier is
 * `type X` are not followed, because both are erased before the bundler sees them.
 *
 * The rule is about the value graph, not the first edge: `components/config/AgentForm.tsx` makes a
 * *value* import of `TOOL_GRANT_OPTIONS` and is still safe, because `lib/agentos/agent-form.ts`
 * imports from `./db` **as a type**, so the walk stops there. An implementation that exempted value
 * imports, or that stopped at depth one, would pass that file for the wrong reason and wave through
 * exactly what this guard exists to catch.
 *
 * **Three forms, because the bundler follows three** (raised in review of #28; the first version
 * matched only the middle one, and the other two are not hypothetical — `app/layout.tsx:2` is a
 * bare `import "./globals.css"` and `lib/tasks/model.ts:271` re-exports `./columns`):
 *
 *   - `import … from "x"` — the ordinary edge.
 *   - `import "x"` — a **side-effect** import. It binds no name, which is exactly why a regex
 *     built around the `from` keyword cannot see it, and exactly why it is worth seeing: a module
 *     imported purely for its side effects is still executed, and everything it imports with it.
 *   - `export … from "x"` — a re-export. It reads like an export and behaves like an import: the
 *     re-exporting module loads the target. A client component that re-exported a server-only
 *     module would have pulled `node:sqlite` into the browser with AC-1 green.
 *
 * Type-only specifiers are filtered identically in the import and re-export forms, so
 * `export type { TaskRow } from "./types"` stays unfollowed.
 */
function valueImportsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];

  /** True when every specifier in a `{ … }` clause is `type X` — i.e. the whole edge is erased. */
  const allTypeSpecifiers = (clause: string): boolean => {
    const c = clause.trim();
    if (!c.startsWith("{") || !c.endsWith("}")) return false;
    const specs = c
      .slice(1, -1)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return specs.length > 0 && specs.every((sp) => sp.startsWith("type "));
  };

  const named = /import\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = named.exec(src))) {
    if (m[1]) continue;
    if (allTypeSpecifiers(m[2] ?? "")) continue;
    out.push(m[3]);
  }

  // A bare side-effect import. Anchored to a statement boundary so the `import` inside
  // `await import("x")` or a longer identifier is not mistaken for one.
  const bare = /(^|[\n;])\s*import\s*["']([^"']+)["']/g;
  while ((m = bare.exec(src))) out.push(m[2]);

  // A re-export. `export * from "x"` and `export { a } from "x"` both load the target.
  const reexport = /export\s+(type\s+)?(\*(?:\s+as\s+\w+)?|\{[\s\S]*?\})\s*from\s*["']([^"']+)["']/g;
  while ((m = reexport.exec(src))) {
    if (m[1]) continue;
    if (allTypeSpecifiers(m[2] ?? "")) continue;
    out.push(m[3]);
  }

  return out;
}

function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  const cands = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  for (const cand of cands) {
    try {
      if (existsSync(cand) && statSync(cand).isFile()) return cand;
    } catch {
      // unreadable candidate is simply not a match
    }
  }
  return null;
}

function walkFiles(dir: string, hit: (f: string) => void): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      walkFiles(p, hit);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      hit(p);
    }
  }
}

// ── Route tree (AC-21) ──────────────────────────────────────────────────────

/** Every page under `app/`, as a route path, flagged when the page is a bare redirect. */
function routeTree(): { route: string; redirectOnly: boolean }[] {
  const out: { route: string; redirectOnly: boolean }[] = [];
  walkFiles(join(ROOT, "app"), (f) => {
    if (!/[\\/]page\.tsx$/.test(f)) return;
    const rel = relative(join(ROOT, "app"), dirname(f));
    const route = "/" + (rel === "." ? "" : rel).split(/[\\/]/).filter(Boolean).join("/");
    const src = readFileSync(f, "utf8");
    const redirectOnly = /\bredirect\(/.test(src) && !/<main\b|<div\b|<section\b/.test(src);
    out.push({ route, redirectOnly });
  });
  return out;
}

const WILD = "__WILD__";

/** Turns a template literal into a matchable pattern by wildcarding its interpolations. */
function normalizeRevalidatePath(lit: string): string {
  return lit.replace(/\$\{[^}]*\}/g, WILD);
}

function routeMatches(pattern: string, route: string): boolean {
  const ps = pattern.split("/").filter(Boolean);
  const rs = route.split("/").filter(Boolean);
  if (ps.length !== rs.length) return false;
  return ps.every((seg, i) => {
    const r = rs[i];
    if (seg === WILD) return true;
    if (r.startsWith("[") && r.endsWith("]")) return true;
    return seg === r;
  });
}

/**
 * How many segments matched **literal-to-literal**, which is the whole reason this exists.
 *
 * `routeMatches` alone is too permissive in one direction: a dynamic route segment matches any
 * literal, so `/p/${slug}/config` matches BOTH `/p/[slug]/config` and `/p/[slug]/[tab]` — and
 * because the second is a real rendering route, the redirect-only first one was never flagged.
 * That is precisely the bug AC-21 exists to catch, and it made AC-21 unprovable until this was
 * fixed (caught while committing the guard's own sin, 2026-08-21).
 *
 * Next.js resolves a static segment before a dynamic one, so the most literal match is the route
 * that actually serves the path. Score the candidates and keep only the best.
 */
function literalScore(pattern: string, route: string): number {
  const ps = pattern.split("/").filter(Boolean);
  const rs = route.split("/").filter(Boolean);
  let n = 0;
  ps.forEach((seg, i) => {
    if (seg !== WILD && seg === rs[i]) n++;
  });
  return n;
}

/** The route(s) Next would actually serve for this path — most-literal wins. */
function resolvedRoutes<T extends { route: string }>(pattern: string, tree: T[]): T[] {
  const hits = tree.filter((t) => routeMatches(pattern, t.route));
  if (hits.length === 0) return [];
  const best = Math.max(...hits.map((h) => literalScore(pattern, h.route)));
  return hits.filter((h) => literalScore(pattern, h.route) === best);
}

// ── Checks ──────────────────────────────────────────────────────────────────

async function runChecks(): Promise<void> {
  // ---- AC-1 [G] — no client component reaches node:* or the store ----
  {
    const clientFiles: string[] = [];
    for (const root of ["app", "components"]) {
      walkFiles(join(ROOT, root), (f) => {
        const head = readFileSync(f, "utf8").slice(0, 200);
        if (/^\s*["']use client["']/m.test(head)) clientFiles.push(f);
      });
    }
    const offenders: string[] = [];
    for (const entry of clientFiles) {
      const seen = new Set<string>();
      const stack = [entry];
      while (stack.length) {
        const cur = stack.pop() as string;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const spec of valueImportsOf(cur)) {
          if (spec.startsWith("node:")) {
            offenders.push(`${relative(ROOT, entry)} → … → ${relative(ROOT, cur)} imports ${spec}`);
            continue;
          }
          const next = resolveImport(spec, cur);
          if (!next) continue;
          if (/lib[\\/]agentos[\\/]db\.ts$/.test(next)) {
            offenders.push(
              `${relative(ROOT, entry)} → … → ${relative(ROOT, cur)} imports lib/agentos/db`,
            );
            continue;
          }
          stack.push(next);
        }
      }
    }
    if (clientFiles.length === 0) {
      fail("AC-1", 'found no "use client" files — the walker is broken, not the code');
    } else if (offenders.length > 0) {
      fail("AC-1", `client bundle reaches server-only code: ${offenders.join(" | ")}`);
    } else {
      pass(
        "AC-1",
        `${clientFiles.length} client components; none transitively value-imports node:* or lib/agentos/db`,
      );
    }
  }

  // ---- AC-2 [F] — five work rows, four setup rows, nine unique keys ----
  {
    const opted = projectRailModel({
      nav: navFor({ executionLayer: true }),
      currentKey: "tasks",
      inboxOpenCount: 2,
    });
    const watched = projectRailModel({
      nav: navFor({ executionLayer: false }),
      currentKey: null,
      inboxOpenCount: null,
    });
    const keys = [...opted.work, ...opted.setup].map((r) => r.key);
    const current = [...opted.work, ...opted.setup].filter((r) => r.current);
    const ok =
      opted.work.length === 5 &&
      opted.setup.length === 4 &&
      opted.setupLabel === "SETUP" &&
      new Set(keys).size === 9 &&
      current.length === 1 &&
      watched.work.length === 0 &&
      watched.setup.length === 0;
    ok
      ? pass(
          "AC-2",
          "opted-in: 5 work + 4 setup, 9 unique keys, exactly one current, label SETUP; watched-only: both empty",
        )
      : fail(
          "AC-2",
          `work=${opted.work.length} setup=${opted.setup.length} unique=${new Set(keys).size} current=${current.length} watched=${watched.work.length}/${watched.setup.length}`,
        );
  }

  // ---- AC-3 [F] — Inbox is the only counter; null is not zero ----
  {
    const nav = navFor({ executionLayer: true });
    const withCount = projectRailModel({ nav, currentKey: null, inboxOpenCount: 2 });
    const counted = [...withCount.work, ...withCount.setup]
      .filter((r) => r.count !== null)
      .map((r) => r.key);
    const uncounted = projectRailModel({ nav, currentKey: null, inboxOpenCount: null });
    const noneCounted = [...uncounted.work, ...uncounted.setup].every((r) => r.count === null);
    const zero = projectRailModel({ nav, currentKey: null, inboxOpenCount: 0 });
    const zeroShows = zero.work.find((r) => r.key === "inbox")?.count === 0;
    counted.length === 1 && counted[0] === "inbox" && noneCounted && zeroShows
      ? pass(
          "AC-3",
          "inbox is the only counted row; null → nothing counted; 0 → renders 0 (a fact, not an absence)",
        )
      : fail(
          "AC-3",
          `counted=${JSON.stringify(counted)} allNullWhenNull=${noneCounted} zeroRenders=${zeroShows}`,
        );
  }

  // ---- AC-4 [F] — the rail's count and the Inbox page's count are one number ----
  {
    const dir = tmpDir("inbox");
    const db = openDb(join(dir, "t.sqlite"));
    const project = createProject(db, {
      slug: "p",
      primaryRepoPath: dir,
      yamlPath: join(dir, "agentos.yml"),
    });
    const agent = createAgent(db, {
      projectId: project.id,
      name: "a",
      monogram: "AA",
      model: "m",
      rolePrompt: "r",
      allowedTools: [],
      disallowedTools: [],
      canCommit: false,
      maxTurns: 5,
      maxBudgetUsd: 1,
    });
    const task = createTask(db, {
      projectId: project.id,
      name: "t",
      description: "",
      assigneeAgentId: agent.id,
      approvalGate: false,
    });
    const session = createSession(db, {
      taskId: task.id,
      agentId: agent.id,
      triggerKind: "manual",
      worktreePath: join(dir, "wt"),
      baseRef: "main",
      pid: process.pid,
      bootId: "stage3c-fixture",
      driftAtSpawn: null,
    });
    createInboxMessage(db, {
      sessionId: session.id,
      taskId: task.id,
      kind: "ask",
      body: "q1",
      choices: null,
    });
    createInboxMessage(db, {
      sessionId: session.id,
      taskId: task.id,
      kind: "ask",
      body: "q2",
      choices: null,
    });
    const answered = createInboxMessage(db, {
      sessionId: session.id,
      taskId: task.id,
      kind: "ask",
      body: "q3",
      choices: null,
    });
    db.prepare("UPDATE InboxMessage SET status='answered', answer='x' WHERE id=?").run(answered.id);

    const railCount = openInboxCount(dir, db);
    const messages = db
      .prepare("SELECT * FROM InboxMessage")
      .all() as unknown as Parameters<typeof inboxModel>[0]["messages"];
    const page = inboxModel({
      messages,
      sessionsById: new Map([[session.id, session]]),
      tasksById: new Map([[task.id, task]]),
      agentsById: new Map([[agent.id, agent]]),
    });
    railCount === 2 && page.openCount === 2
      ? pass("AC-4", `rail ${railCount} === inbox page ${page.openCount} (2 open of 3), from one rule`)
      : fail("AC-4", `rail=${railCount} page=${page.openCount} — expected 2 and 2`);
    db.close();
  }

  // ---- AC-5 [F] — glyph + word at every severity, never a delta ----
  {
    const sevs: Severity[] = ["drift", "attention", "in-sync", "unverifiable"];
    const bad: string[] = [];
    for (const sev of sevs) {
      const line = driftLineFor(fixtureProject({ severity: sev }));
      if (line.glyph !== GLYPH[sev]) bad.push(`${sev}: glyph ${line.glyph} !== ${GLYPH[sev]}`);
      if (line.text !== `${GLYPH[sev]} ${WORD[sev]}`) bad.push(`${sev}: text "${line.text}"`);
      if (/\d/.test(line.text)) bad.push(`${sev}: contains a digit — D35 forbids a delta`);
    }
    const degraded = driftLineFor(
      fixtureProject({
        severity: "unverifiable",
        git: { ok: false, reason: "boom" } as unknown as ProjectReport["git"],
      }),
    );
    if (degraded.text !== `${GLYPH.unverifiable} ${WORD.unverifiable}`) {
      bad.push(`degraded got its own wording: "${degraded.text}"`);
    }
    bad.length === 0
      ? pass(
          "AC-5",
          "glyph + word at all four severities, no digits, degraded gets no special wording",
        )
      : fail("AC-5", bad.join("; "));
  }

  // ---- AC-6 [G] — D23's five-tab cap survives the SETUP group ----
  {
    const src = readFileSync(join(ROOT, "lib/shell/model.ts"), "utf8");
    const from = src.indexOf("const EXECUTION_TABS");
    const block = src.slice(from, src.indexOf("]", from));
    const tabKeys = [...block.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);
    const setupKeys = SETUP_ROWS.map((r) => r.key as string);
    const leaked = tabKeys.filter((k) => setupKeys.includes(k));
    tabKeys.length === 5 && leaked.length === 0
      ? pass("AC-6", `EXECUTION_TABS is still 5 (${tabKeys.join(", ")}); no setup key leaked into it`)
      : fail("AC-6", `tabs=${tabKeys.length} [${tabKeys.join(", ")}] leaked=[${leaked.join(", ")}]`);
  }

  // ---- AC-7 [F] — the validator, and honest placeholders ----
  {
    const nav = navFor({ executionLayer: true });
    const watched = navFor({ executionLayer: false });
    const problems: string[] = [];

    // The roster is D32's contract and is pinned: exactly these four keys, in this order. Adding a
    // fifth setup destination is a decision, and this is where it has to be taken rather than
    // noticed.
    const ROSTER = ["agents", "templates", "environments", "repos"];
    const actual = SETUP_ROWS.map((r) => r.key);
    if (actual.join(",") !== ROSTER.join(",")) {
      problems.push(`setup roster is ${actual.join(",")}, expected ${ROSTER.join(",")}`);
    }

    // **Each row's honesty is derived from its own state, never from a hardcoded list of which
    // rows are placeholders today.** The first version listed `templates/environments/repos`
    // literally, which made this check a pinned baseline: Stage 4 flips `templates` to `live` by
    // design (its spec §5.8 says so), and the suite would have gone red for the feature landing.
    // That is the same rot that has two upstream oracles red right now for repairing a known
    // failure — so the invariant asserted here is the one that does not expire: **a live row
    // claims no future stage, and a placeholder names the thing that will build it.**
    for (const row of SETUP_ROWS) {
      const resolved = setupSectionFor(nav, row.key);
      if (!resolved) {
        problems.push(`${row.key} does not resolve`);
        continue;
      }
      if (resolved.state === "live") {
        if (resolved.builtBy !== null) problems.push(`${row.key} is live but still names a builder`);
      } else if (resolved.state === "placeholder") {
        if (!resolved.builtBy || resolved.builtBy.trim().length === 0) {
          problems.push(`${row.key} does not say what will build it`);
        }
      } else {
        problems.push(`${row.key} has an unknown state`);
      }
    }

    // `agents` is the one row whose state is asserted outright: it is live, it is the only setup
    // surface Stage 3b actually built, and a regression to `placeholder` would be a silently
    // unreachable feature rather than an honest one.
    const agents = setupSectionFor(nav, "agents");
    if (!agents || agents.state !== "live") problems.push("agents is not a live section");

    for (const bad of ["skills", "nope", "../../etc/passwd", ""]) {
      if (setupSectionFor(nav, bad) !== null) problems.push(`unknown section "${bad}" resolved`);
    }
    for (const key of ROSTER) {
      if (setupSectionFor(watched, key) !== null) problems.push(`watched-only resolved "${key}"`);
    }

    const live = SETUP_ROWS.filter((r) => r.state === "live").length;
    problems.length === 0
      ? pass(
          "AC-7",
          `four setup rows in D32's order; ${live} live with no builder named, ${SETUP_ROWS.length - live} placeholders each naming one; unknown sections and watched-only → null`,
        )
      : fail("AC-7", problems.join("; "));
  }

  // ---- AC-8 [F] — SETUP_ROWS is the single definition, and the route reads it ----
  {
    const page = readFileSync(join(ROOT, "app/p/[slug]/config/[section]/page.tsx"), "utf8");
    const usesResolver = /setupSectionFor\s*\(/.test(page);
    const hardcodes = /["'](templates|environments|repos)["']/.test(page);
    const model = readFileSync(join(ROOT, "lib/shell/model.ts"), "utf8");
    const defs = [...model.matchAll(/SETUP_ROWS\s*:\s*readonly/g)].length;
    usesResolver && !hardcodes && defs === 1
      ? pass("AC-8", "the [section] route validates via setupSectionFor and hardcodes no section list")
      : fail(
          "AC-8",
          `usesResolver=${usesResolver} hardcodesSectionLiteral=${hardcodes} SETUP_ROWS definitions=${defs}`,
        );
  }

  // ---- AC-9 [F] — drawerOutcome over four inputs, including the egress-floor note ----
  // T2. The deletion probe named in the spec: simplifying the implementation to
  // `return { close: state.ok }` passes the pending/refused/clean cases and drops this one — the
  // egress-floor note is `ok: true` on a *successful* create (config/actions.ts:105-110), and
  // Stage 3b AC-5 requires it to stay on screen rather than have the drawer close under it.
  {
    const bad: string[] = [];
    const reasonFor = (o: ReturnType<typeof drawerOutcome>) => (o.close ? null : o.keepOpenBecause);

    const pendingCase = drawerOutcome({ ok: true, reason: null }, true);
    if (reasonFor(pendingCase) !== "pending") bad.push(`pending → ${JSON.stringify(pendingCase)}`);

    const refusedCase = drawerOutcome({ ok: false, reason: "nope" }, false);
    if (reasonFor(refusedCase) !== "refused") bad.push(`refused → ${JSON.stringify(refusedCase)}`);

    const noteCase = drawerOutcome(
      { ok: true, reason: "WebFetch and WebSearch were denied by the egress floor" },
      false,
    );
    if (reasonFor(noteCase) !== "note") bad.push(`egress-floor note → ${JSON.stringify(noteCase)}`);

    const cleanCase = drawerOutcome({ ok: true, reason: null }, false);
    if (!cleanCase.close) bad.push(`clean ok+null → ${JSON.stringify(cleanCase)}`);

    bad.length === 0
      ? pass(
          "AC-9",
          "drawerOutcome over four inputs: pending, a refusal, and a successful create carrying the egress-floor note all keep the drawer open; only ok+reason:null closes it",
        )
      : fail("AC-9", bad.join("; "));
  }

  // ---- AC-10 [G] — the forms still call useActionState and render state.reason; the wrapper ----
  // ---- decides via drawerOutcome, not state.ok directly --------------------------------------
  // Not fully renderable — no acceptance script here imports a component, same posture as
  // verify-stage3b.mts's AC-7b. This is a structural approximation: it reads the two form files
  // and checks the shape the hand-off from T1 requires (`useActionState(` and `state.reason` still
  // present) plus the T2 contract (`drawerOutcome(` called; no `state.ok` used to gate a call to
  // `onClose(` directly, which is the negative match the spec names — "close from state.ok in the
  // component"). A textual check that the decision is delegated is worth more than no check that
  // it is.
  {
    const files = ["components/tasks/TaskForm.tsx", "components/config/AgentForm.tsx"];
    const problems: string[] = [];
    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      if (!/useActionState\(/.test(src)) problems.push(`${rel}: no longer calls useActionState(`);
      if (!/state\.reason/.test(src)) problems.push(`${rel}: no longer renders state.reason`);
      if (!/drawerOutcome\(/.test(src)) problems.push(`${rel}: does not call drawerOutcome(`);
      if (/state\.ok\b[\s\S]{0,60}?onClose\s*\(/.test(src)) {
        problems.push(`${rel}: appears to decide closing from state.ok directly, bypassing drawerOutcome`);
      }
    }
    problems.length === 0
      ? pass(
          "AC-10",
          "both forms still call useActionState( and render state.reason; both decide closing via drawerOutcome(, not state.ok directly",
        )
      : fail("AC-10", problems.join("; "));
  }

  // ---- AC-11 [F] — initialDrawerFor: known → edit; unknown → closed; absent → closed ----
  {
    const known = new Set(["a1", "a2"]);
    const bad: string[] = [];
    const edit = initialDrawerFor({ agent: "a1" }, known);
    if (!(edit.open && edit.mode === "edit" && edit.agentId === "a1")) {
      bad.push(`known id → ${JSON.stringify(edit)}`);
    }
    const unknown = initialDrawerFor({ agent: "ghost" }, known);
    if (unknown.open) {
      bad.push(`unknown id → ${JSON.stringify(unknown)} (an empty edit sheet would claim an agent exists)`);
    }
    const absent = initialDrawerFor({}, known);
    if (absent.open) bad.push(`absent → ${JSON.stringify(absent)}`);

    bad.length === 0
      ? pass("AC-11", "initialDrawerFor: known id → edit with that id; unknown id → closed; absent → closed")
      : fail("AC-11", bad.join("; "));
  }

  // ---- AC-17 [G] — exactly eight tables ----
  {
    const src = readFileSync(join(ROOT, "lib/agentos/db.ts"), "utf8");
    const names = [...src.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]).sort();
    const expected = [
      "Agent",
      "CommitSha",
      "InboxMessage",
      "Project",
      "Session",
      "Task",
      "TaskEvent",
      "ToolCall",
    ];
    JSON.stringify(names) === JSON.stringify(expected)
      ? pass("AC-17", "eight tables, names unchanged — a placeholder cannot have grown a schema")
      : fail("AC-17", `got ${names.length}: ${names.join(", ")}`);
  }

  // ---- AC-19 [F] — the session rendering is frozen; the human one is different and correct ----
  {
    const FROZEN =
      "task T1 has approvalGate=true; a session may not move it to 'done'. " +
      "Leave it in 'review' (or another non-done status) for a human to close, or use " +
      "inbox_ask if you need a decision before continuing.";
    const actual = gateRefusalReason("T1");
    const human = gateRefusalReason("T1", "human");
    const problems: string[] = [];
    if (actual !== FROZEN) problems.push(`session rendering drifted — got: ${actual}`);
    if (human === actual) problems.push("the human rendering is identical — D36 bought nothing");
    if (/inbox_ask/.test(human)) {
      problems.push("the human rendering mentions inbox_ask, a tool a person cannot call");
    }
    if (!/Approve/i.test(human)) problems.push("the human rendering does not name the Approve control");
    problems.length === 0
      ? pass(
          "AC-19",
          "session string frozen byte-for-byte; human string differs, names Approve, drops inbox_ask",
        )
      : fail("AC-19", problems.join("; "));
  }

  // ---- AC-21 [G] — every revalidatePath names a real, non-redirect route ----
  {
    const tree = routeTree();
    const bad: string[] = [];
    walkFiles(join(ROOT, "app"), (f) => {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/revalidatePath\(\s*[`'"]([^`'"]+)[`'"]/g)) {
        const pattern = normalizeRevalidatePath(m[1]);
        const hits = resolvedRoutes(pattern, tree);
        if (hits.length === 0) {
          bad.push(`${relative(ROOT, f)}: "${m[1]}" matches no route`);
        } else if (hits.every((h) => h.redirectOnly)) {
          bad.push(
            `${relative(ROOT, f)}: "${m[1]}" matches only a redirect-only route — revalidating it refreshes nothing`,
          );
        }
      }
    });
    if (tree.length === 0) fail("AC-21", "derived an empty route tree — the walker is broken");
    else if (bad.length > 0) fail("AC-21", bad.join("; "));
    else pass("AC-21", `every revalidatePath in app/ resolves to a rendering route (${tree.length} routes known)`);
  }

  // ---- AC-12 [F] — a gated review card refuses exactly one column, in human words ----
  {
    const gated = { taskId: "T1", from: "review" as const, gate: { humanRefusalReason: gateRefusalReason("T1", "human") } };
    const ungated = { taskId: "T2", from: "review" as const, gate: null };
    const g = dropTargets(gated);
    const u = dropTargets(ungated);
    const refusedG = g.filter((x) => !x.accepts && x.key !== "review").map((x) => x.key);
    const refusedU = u.filter((x) => !x.accepts && x.key !== "review").map((x) => x.key);
    const doneReason = g.find((x) => x.key === "done")?.reason ?? "";
    const problems: string[] = [];
    if (JSON.stringify(refusedG) !== JSON.stringify(["done"])) problems.push(`gated refused ${JSON.stringify(refusedG)}, expected ["done"]`);
    if (refusedU.length !== 0) problems.push(`ungated refused ${JSON.stringify(refusedU)} — the positive control failed, so AC-12 could pass by refusing everything`);
    if (doneReason !== gateRefusalReason("T1", "human")) problems.push("done's reason is not gateRefusalReason(id, 'human')");
    if (/inbox_ask/.test(doneReason)) problems.push("the drag refusal mentions inbox_ask — that is the session rendering (D36)");
    if (!/Approve/i.test(doneReason)) problems.push("the drag refusal does not name the Approve control");
    problems.length === 0
      ? pass("AC-12", "gated review refuses only 'done', in the human rendering; ungated accepts every column")
      : fail("AC-12", problems.join("; "));
  }

  // ---- AC-13 [F, hostile] — the server refuses what the browser never sends ----
  {
    const f = seedProject("hostile");
    const gatedTask = createTask(f.db, { projectId: f.project.id, name: "gated", description: "", assigneeAgentId: f.agent.id, approvalGate: true });
    writeTaskTransition(f.db, { taskId: gatedTask.id, toStatus: "doing", actorType: "session", actorId: null, reason: null });
    writeTaskTransition(f.db, { taskId: gatedTask.id, toStatus: "review", actorType: "session", actorId: null, reason: null });
    const before = listTaskEvents(f.db, gatedTask.id).length;

    const gate = await attempt(() => moveTaskForSlug(f.slug, gatedTask.id, "done", { db: f.db }));
    const bogus = await attempt(() => moveTaskForSlug(f.slug, gatedTask.id, "archived", { db: f.db }));

    const after = listTaskEvents(f.db, gatedTask.id).length;
    const status = getTask(f.db, gatedTask.id)?.status;
    const problems: string[] = [];
    if (gate.threw) problems.push(`the gated drop THREW instead of refusing: ${gate.error}`);
    else if (gate.value.ok) problems.push("the gated drop to 'done' was ACCEPTED server-side");
    if (bogus.threw) problems.push(`an arbitrary destination THREW instead of refusing (${bogus.error}) — a TypeScript signature is not a runtime allowlist`);
    else if (bogus.value.ok) problems.push("an arbitrary destination was ACCEPTED");
    if (status !== "review") problems.push(`status moved to '${status}'`);
    if (after !== before) problems.push(`${after - before} TaskEvent(s) written by a refused move`);
    problems.length === 0
      ? pass("AC-13", "gated 'done' and an arbitrary destination both refused server-side; status and event count unchanged")
      : fail("AC-13", problems.join("; "));
    f.db.close();
  }

  // ---- AC-14 [F] — a legal drop is recorded as hand-moved, through the real model ----
  {
    const f = seedProject("handmove");
    const task = createTask(f.db, { projectId: f.project.id, name: "t", description: "", assigneeAgentId: f.agent.id, approvalGate: false });
    const before = listTaskEvents(f.db, task.id).length;
    const attempted = await attempt(() => moveTaskForSlug(f.slug, task.id, "doing", { db: f.db }));
    const res = attempted.threw ? { ok: false, reason: `threw: ${attempted.error}` } : attempted.value;
    const events = listTaskEvents(f.db, task.id);
    const ev = events[events.length - 1];
    const moved = getTask(f.db, task.id);
    const card = cardModel({
      task: moved!,
      events,
      agentsById: new Map([[f.agent.id, f.agent]]),
      sessionsById: new Map(),
      toolCallCountBySession: new Map(),
      commitShasBySession: new Map(),
    });
    const problems: string[] = [];
    if (!res.ok) problems.push(`the legal move was refused: ${res.reason}`);
    if (events.length !== before + 1) problems.push(`${events.length - before} events written, expected 1`);
    if (ev?.actorType !== "human") problems.push(`actorType '${ev?.actorType}', expected 'human'`);
    if (ev?.actorId !== "owner") problems.push(`actorId '${ev?.actorId}'`);
    if (ev?.reason !== handMoveReason("todo", "doing")) problems.push(`reason '${ev?.reason}' is not handMoveReason's`);
    if (card.evidence.kind !== "hand-moved") problems.push(`evidence kind '${card.evidence.kind}', expected 'hand-moved'`);
    if (card.register !== "claim") problems.push(`register '${card.register}', expected 'claim'`);
    problems.length === 0
      ? pass("AC-14", "one human TaskEvent with handMoveReason; cardModel renders it hand-moved, in the claim register")
      : fail("AC-14", problems.join("; "));
    f.db.close();
  }

  // ---- AC-15 [F] — a drop never dispatches (D24) ----
  {
    // **The source scan runs first, before anything calls the action.** Ordering is load-bearing
    // here: a wrong implementation that actually dispatches does real work — spawning a runner —
    // and can take the whole process down before a later assertion is reached. A guard that only
    // reports when the code is already correct is not a guard, and this one was exactly that until
    // the two halves were swapped.
    const src = readFileSync(join(ROOT, "app/p/[slug]/[tab]/actions.ts"), "utf8");
    const from = src.indexOf("export async function moveTaskForSlug");
    const to = src.indexOf("\nexport async function", from + 1);
    const body = src.slice(from, to === -1 ? undefined : to);
    const callsDispatch = from === -1 ? true : /\bdispatch\s*\(/.test(body);
    if (from === -1) {
      fail("AC-15", "could not find moveTaskForSlug to scan — the check is broken, not the code");
    } else if (callsDispatch) {
      fail("AC-15", "moveTaskForSlug's body calls dispatch( — D24: Run now is the only path into a session");
    } else {
      // The behavioural half corroborates, and is deliberately NOT the whole check: `dispatch`
      // only accepts a task in `todo` (lib/agentos/dispatch.ts), so an implementation that moves
      // todo → doing and *then* dispatches is refused by dispatch itself, leaves zero sessions
      // behind, and would satisfy a row-count assertion with the guard entirely removed.
      const f = seedProject("nodispatch");
      const task = createTask(f.db, { projectId: f.project.id, name: "t", description: "", assigneeAgentId: f.agent.id, approvalGate: false });
      await attempt(() => moveTaskForSlug(f.slug, task.id, "doing", { db: f.db }));
      const sessions = listSessionsByProject(f.db, f.project.id).length;
      sessions === 0
        ? pass("AC-15", "moveTaskForSlug's body never calls dispatch(, and a drop produced 0 sessions")
        : fail("AC-15", `${sessions} session row(s) after a drop`);
      f.db.close();
    }
  }

  // ---- AC-16 [F, hostile] — one project cannot drag another's card ----
  {
    // Both projects live in ONE store on purpose. With two separate databases the attacker's repo
    // path simply finds no Project row, so the refusal comes from the data lookup and the
    // `task.projectId !== data.project.id` comparison is never reached — the check would pass with
    // the ownership guard deleted. Proven: it did, until this was restructured.
    const shared = openDb(join(tmpDir("shared"), "t.sqlite"));
    const victim = seedProject("victim", shared);
    const attacker = seedProject("attacker", shared);
    const task = createTask(shared, { projectId: victim.project.id, name: "v", description: "", assigneeAgentId: victim.agent.id, approvalGate: false });
    const before = listTaskEvents(shared, task.id).length;
    const attempted = await attempt(() => moveTaskForSlug(attacker.slug, task.id, "doing", { db: shared }));
    const res = attempted.threw ? { ok: false, reason: `threw: ${attempted.error}` } : attempted.value;
    const after = listTaskEvents(shared, task.id).length;
    const status = getTask(shared, task.id)?.status;
    const problems: string[] = [];
    if (res.ok) problems.push("the cross-project move was ACCEPTED");
    if (!res.reason || !res.reason.includes(task.id)) problems.push("the refusal does not name the task id");
    if (status !== "todo") problems.push(`victim status moved to '${status}'`);
    if (after !== before) problems.push(`${after - before} event(s) written on the victim`);
    problems.length === 0
      ? pass("AC-16", "a task id from another project in the SAME store is refused, names the id, and writes nothing")
      : fail("AC-16", problems.join("; "));
    shared.close();
  }

  // ---- AC-16b [G, hostile] — an incomplete request is refused at the form boundary ----
  {
    // A server action is reachable by any POST, not only by the board that renders it. Before this
    // guard existed an empty `slug` revalidated the literal path `/p//tasks` and the refusal read
    // `task  is not in project ''` — a missing field described as a missing task (review of #30).
    //
    // The check runs `moveTaskAction` itself rather than `moveTaskForSlug`, because the guard being
    // asserted lives at the form boundary and the delegate has no idea it was skipped. That also
    // makes the sin self-reporting: with the guard removed, execution reaches `revalidatePath`,
    // which throws outside a request scope — so the check goes red rather than quietly agreeing.
    const problems: string[] = [];
    for (const [label, fields] of [
      ["all three empty", {}],
      ["no slug", { taskId: "t1", to: "doing" }],
      ["no taskId", { slug: "x", to: "doing" }],
      ["no destination", { slug: "x", taskId: "t1" }],
    ] as [string, Record<string, string>][]) {
      const body = new FormData();
      for (const [k, v] of Object.entries(fields)) body.set(k, v);
      const r = await attempt(() => moveTaskAction(body));
      if (r.threw) problems.push(`${label}: threw instead of refusing — ${r.error}`);
      else if (r.value.ok) problems.push(`${label}: ACCEPTED`);
      else if (!r.value.reason) problems.push(`${label}: refused with no reason`);
      else if (/''|is not in project\s*''/.test(r.value.reason)) {
        problems.push(`${label}: the refusal quotes an empty field — "${r.value.reason}"`);
      }
    }
    problems.length === 0
      ? pass("AC-16b", "an incomplete move request is refused at the form boundary, without reaching revalidatePath or naming an empty field")
      : fail("AC-16b", problems.join("; "));
  }

  // ---- AC-12b [G] — the board hands the drag path the HUMAN rendering ----
  {
    // AC-12 asserts `dropTargets` on a hand-built gate, so it cannot see how the board wires it.
    // A correct pure function that the UI feeds the wrong string is the T7-2 failure exactly
    // (`docs/LEARNINGS.md`, 2026-08-19), and it stayed green here until this check existed.
    const src = readFileSync(join(ROOT, "components/tasks/Board.tsx"), "utf8");
    const passesHuman = /humanRefusalReason:\s*card\.gate\.humanRefusalReason/.test(src);
    const passesSession = /humanRefusalReason:\s*card\.gate\.refusalReason/.test(src);
    passesHuman && !passesSession
      ? pass("AC-12b", "Board passes gate.humanRefusalReason into the drop candidate, not the session string (D36)")
      : fail("AC-12b", `passesHuman=${passesHuman} passesSession=${passesSession}`);
  }


  // ---- AC-18 [G] — no new surface hardcodes a colour ----
  {
    const offenders: string[] = [];
    walkCss(join(ROOT, "components"), (f) => {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        offenders.push(`${relative(ROOT, f)}: ${m[0]}`);
      }
    });
    offenders.length === 0
      ? pass("AC-18", "no CSS Module under components/ contains a hex literal — tokens come from globals.css")
      : fail("AC-18", offenders.join("; "));
  }

  // ---- AC-20 [G] — the regression oracle, which SKIPS rather than fails on a degraded upstream ----
  {
    // `verify:stage3a`'s own AC-1 shells out to GitHub and can go red because GitHub is down —
    // already a docs/BACKLOG.md entry. Importing that flakiness here would teach us to ignore this
    // suite too, so a degraded upstream is reported as a SKIP with its reason, never a FAIL.
    const run = (script: string) => {
      try {
        const out = execFileSync("pnpm", ["--silent", script], { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
        return { out, ran: true };
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        return { out: `${e.stdout ?? ""}${e.stderr ?? ""}`, ran: true };
      }
    };
    const summarize = (out: string) => ({
      passes: (out.match(/^\s*PASS\s/gm) ?? []).length,
      failIds: [...out.matchAll(/^\s*FAIL\s+(\S+)/gm)].map((m) => m[1]),
    });

    const degraded = /gh: |Bad credentials|ENOTFOUND|rate limit/i;
    const three = run("verify:stage3");
    const threeA = run("verify:stage3a");

    if (degraded.test(three.out) || degraded.test(threeA.out)) {
      pass("AC-20", "SKIP — an upstream suite is degraded (GitHub unreachable); not reported as a regression");
    } else {
      const a = summarize(three.out);
      const b = summarize(threeA.out);
      // The two known failures on this base, both recorded in docs/HANDOFF.md and docs/BACKLOG.md:
      // each pins Stage 1's expected result at the literal 7P/1F, and Stage 1 now passes 8/8 —
      // two oracles red because a known failure was repaired. Anything ELSE red is this stage's.
      const KNOWN = { "verify:stage3": ["AC-11"], "verify:stage3a": ["AC-1"] };
      const unexpected = [
        ...a.failIds.filter((id) => !KNOWN["verify:stage3"].includes(id)).map((id) => `stage3:${id}`),
        ...b.failIds.filter((id) => !KNOWN["verify:stage3a"].includes(id)).map((id) => `stage3a:${id}`),
      ];
      unexpected.length === 0
        ? pass("AC-20", `upstream unchanged — stage3 ${a.passes}P (known: ${a.failIds.join(",") || "none"}), stage3a ${b.passes}P (known: ${b.failIds.join(",") || "none"})`)
        : fail("AC-20", `NEW upstream failures introduced by this stage: ${unexpected.join(", ")}`);
    }
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────

try {
  await runChecks();
} catch (err) {
  fail(
    "suite",
    `a check threw instead of reporting — ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
  );
} finally {
  for (const t of TEMPS) rmSync(t, { recursive: true, force: true });
}

if (failures > 0) {
  console.log(`\n${failures} FAILING.`);
  process.exit(1);
}
console.log("\nAll Stage 3c acceptance criteria pass.");
