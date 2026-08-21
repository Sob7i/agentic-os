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
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
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
import {
  openDb,
  createProject,
  createAgent,
  createTask,
  createSession,
  createInboxMessage,
} from "../lib/agentos/db";
import { openInboxCount } from "../lib/tasks/data";
import { inboxModel } from "../lib/tasks/inbox-model";
import type { BoardReport, ProjectReport, Severity } from "../lib/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
