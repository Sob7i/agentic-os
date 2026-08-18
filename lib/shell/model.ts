import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BoardReport, CheckResult, ProjectReport, Severity } from "@/lib/types";

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
  };
}
