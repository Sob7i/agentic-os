import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BoardReport, CheckResult, ProjectReport, Severity } from "@/lib/types";
import { GLYPH, WORD } from "@/lib/severity";

/**
 * The shell's logic, as pure functions over a BoardReport.
 *
 * The components below `components/shell/` are deliberately dumb: everything
 * that could be *wrong* lives here, where `scripts/verify-stage3a.mts` can
 * assert it without rendering a route. A suite that could only check "the page
 * did not throw" would be theatre.
 */

export interface RibbonProject {
  name: string;
  slug: string;
  severity: Severity;
}

/** The ribbon either knows, or says it does not. There is no third state. */
export type RibbonModel =
  | { ok: true; projects: RibbonProject[]; checkedAtISO: string }
  | { ok: false; reason: string };

export const slugFor = (name: string) => name;

/**
 * D23: glyph and name only — no counts, no sentences, no deltas. The sentence
 * lives on the Board, so the two cannot disagree about what drift *means*.
 *
 * AC-4: when the collectors degraded, the ribbon renders no severities at all.
 * Six confident glyphs sourced from a failed run is invariant 2 broken in the
 * one component that is on screen at all times.
 */
export function ribbonModel(board: BoardReport): RibbonModel {
  if (board.degraded) {
    return {
      ok: false,
      reason: "One or more collectors failed — severities are not shown, because they were not checked.",
    };
  }
  return {
    ok: true,
    checkedAtISO: board.checkedAtISO,
    projects: board.projects.map((p) => ({
      name: p.name,
      slug: slugFor(p.name),
      severity: p.severity,
    })),
  };
}

/**
 * The drift band — the *conditional* half of D23.
 *
 * Returns the project's own drift check verbatim, or null. It never re-derives,
 * re-words or re-scores anything: the band is a quotation with a link, which is
 * what keeps it from becoming the second drift board D22 refused.
 */
export function driftBandFor(board: BoardReport, slug: string): CheckResult | null {
  const project = board.projects.find((p) => slugFor(p.name) === slug);
  if (!project || project.severity !== "drift") return null;
  return project.checks.find((c) => c.severity === "drift") ?? null;
}

/**
 * D18's opt-in, checked on disk rather than assumed. A project runs work here
 * only if it says so itself.
 */
export function hasExecutionLayer(projectPath: string): boolean {
  return existsSync(join(projectPath, "agentos.yml"));
}

export interface ProjectNav {
  project: ProjectReport;
  slug: string;
  /** Empty for a watched-only project — and that is a choice, not a gap (AC-6). */
  tabs: { key: string; label: string }[];
  /** Empty for the same reason, and by the same rule (D32). */
  setup: SetupRow[];
  executionLayer: boolean;
}

const EXECUTION_TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "goals", label: "Goals" },
  { key: "inbox", label: "Inbox" },
  { key: "sessions", label: "Sessions" },
  { key: "costs", label: "Costs" },
];

/**
 * Resolve a slug to a project, or null — never a blank shell (AC-8). An unknown
 * project must be refused rather than rendered as an empty frame, because an
 * empty frame reads as "nothing here yet" instead of "no such project".
 */
export function projectNav(board: BoardReport, slug: string): ProjectNav | null {
  const project = board.projects.find((p) => slugFor(p.name) === slug);
  if (!project) return null;
  const executionLayer = hasExecutionLayer(project.path);
  return {
    project,
    slug,
    executionLayer,
    tabs: executionLayer ? EXECUTION_TABS : [],
    setup: executionLayer ? [...SETUP_ROWS] : [],
  };
}

// ---------------------------------------------------------------------------
// D32 — the SETUP group. Work is `/p/<slug>/<tab>`; setup is
// `/p/<slug>/config/<section>`. EXECUTION_TABS above is untouched and stays
// five, so Stage 3a's AC-6 keeps passing unmodified — the split is a section
// boundary and a URL prefix, not a length limit.
// ---------------------------------------------------------------------------

export type SetupState = "live" | "placeholder";

export interface SetupRow {
  key: "agents" | "templates" | "environments" | "repos";
  label: string;
  state: SetupState;
  /**
   * Placeholders only: what will build this, named. `null` for a live section.
   *
   * Required rather than optional on purpose (AC-7). A placeholder that does
   * not say what replaces it is the "not built" chrome Stage 3a's AC-9 refuses
   * — indistinguishable from a surface that failed to load.
   */
  builtBy: string | null;
}

export const SETUP_ROWS: readonly SetupRow[] = [
  { key: "agents", label: "Agents", state: "live", builtBy: null },
  { key: "templates", label: "Templates", state: "live", builtBy: null },
  {
    key: "environments",
    label: "Environments",
    state: "placeholder",
    builtBy: "not specced — will hold the network and path grants sketched as frame A1",
  },
  {
    key: "repos",
    label: "Repos",
    state: "placeholder",
    builtBy: "not specced — will hold the per-session repo manifest",
  },
];

/**
 * The `[section]` segment's validator — the twin of `[tab]`'s
 * `nav.tabs.some(...)`, and the single definition the rail also renders from.
 *
 * Returns null for a watched-only project too, which is a **behaviour change**
 * recorded in the spec (§3.3): `/config` renders today for such a project and
 * 404s after this. That is the correct reading of D18 and Stage 3a's AC-6 —
 * no execution layer, no execution surfaces.
 */
export function setupSectionFor(nav: ProjectNav, section: string): SetupRow | null {
  if (!nav.executionLayer) return null;
  return nav.setup.find((r) => r.key === section) ?? null;
}

// ---------------------------------------------------------------------------
// D35 — the rail's identity line
// ---------------------------------------------------------------------------

export interface DriftLine {
  severity: Severity;
  glyph: string;
  /** Glyph + word. Never a delta — see D35. */
  text: string;
}

/**
 * The rail's severity line: `⚠ drift`, `◌ unverifiable`, and so on.
 *
 * **No day count**, though frame B'2 draws one. There is no structured age to
 * render it from — `ProjectReport` has no age field and the number exists only
 * as prose inside `CheckResult.headline` — so producing it would be a second
 * derivation of a figure the drift band already quotes verbatim (invariant 5).
 *
 * Renders at **every** severity, including `unverifiable`, and that case gets
 * no special wording: a line that appeared only on drift would make its own
 * absence a claim.
 */
export function driftLineFor(project: ProjectReport): DriftLine {
  const glyph = GLYPH[project.severity];
  return { severity: project.severity, glyph, text: `${glyph} ${WORD[project.severity]}` };
}

// ---------------------------------------------------------------------------
// The rail, as decided data. `ProjectRail.tsx` is a map over this.
// ---------------------------------------------------------------------------

export interface NavRow {
  key: string;
  label: string;
  href: string;
  current: boolean;
  /**
   * Non-null on exactly one row, ever: Inbox.
   *
   * `null` means **not counted**, and is not the same as `0`. Rendering a zero
   * for a project with no store asserts "no open questions" about something
   * never opened — invariant 2, in a component that is always on screen.
   */
  count: number | null;
  state: SetupState;
}

export interface ProjectRailModel {
  back: { href: string; label: string };
  identity: { name: string; drift: DriftLine };
  work: NavRow[];
  setupLabel: "SETUP";
  setup: NavRow[];
  footer: string;
}

/**
 * The whole rail, decided here so `scripts/verify-stage3c.mts` can assert it
 * without rendering a route (CLAUDE.md: shell logic is pure, components dumb).
 *
 * `inboxOpenCount` arrives as a **parameter, never a database read**. This
 * module imports `node:fs`, `lib/severity` and types and nothing else, and
 * AC-1 asserts that nothing client-reachable reaches the store — D19's layer
 * boundary being real in code rather than merely stated.
 */
export function projectRailModel(input: {
  nav: ProjectNav;
  currentKey: string | null;
  /** `null` when it was not or could not be counted — no store, no Project row. */
  inboxOpenCount: number | null;
}): ProjectRailModel {
  const { nav, currentKey, inboxOpenCount } = input;
  return {
    back: { href: "/", label: "All projects" },
    identity: { name: nav.project.name, drift: driftLineFor(nav.project) },
    work: nav.tabs.map((t) => ({
      key: t.key,
      label: t.label,
      href: `/p/${nav.slug}/${t.key}`,
      current: t.key === currentKey,
      count: t.key === "inbox" ? inboxOpenCount : null,
      state: "live" as const,
    })),
    setupLabel: "SETUP",
    setup: nav.setup.map((r) => ({
      key: r.key,
      label: r.label,
      href: `/p/${nav.slug}/config/${r.key}`,
      current: r.key === currentKey,
      count: null,
      state: r.state,
    })),
    footer: "Nothing about the other five projects competes for attention in here.",
  };
}
