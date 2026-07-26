import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The watched set is explicit — never auto-discovered (DECISIONS D9).
 *
 * ~/Documents/sl/ holds 30+ directories; auto-discovery would surface ~14 stale
 * repos as permanent noise and destroy the three-second scan the Board exists for.
 */
export interface ProjectConfig {
  /** Display name. May differ from the directory (salla-apps lives in hadaya/). */
  name: string;
  /** Absolute path to the repo. */
  path: string;
  /** Days without a commit before DC7 flags the project as stalled. */
  stalledAfterDays: number;
  /**
   * Uncommitted files at or above which DC4 reports `attention` (DECISIONS D14).
   * Below it the count is still shown as a fact, but does not raise severity —
   * without a threshold no project is ever green, and `in-sync` never renders.
   */
  dirtyThreshold: number;
  /**
   * True for the itqan framework repo itself: it defines the seven roles rather
   * than instantiating them, so role-coverage gaps (DC8) are not findings there.
   */
  isFrameworkRepo?: boolean;
}

const SL = join(homedir(), "Documents", "sl");

export const PROJECTS: ProjectConfig[] = [
  { name: "salla-apps", path: join(SL, "hadaya"), stalledAfterDays: 14, dirtyThreshold: 5 },
  { name: "nadim", path: join(SL, "nadim"), stalledAfterDays: 14, dirtyThreshold: 5 },
  { name: "itqan", path: join(SL, "itqan"), stalledAfterDays: 14, dirtyThreshold: 5, isFrameworkRepo: true },
  { name: "fractal-code", path: join(SL, "fractal-code"), stalledAfterDays: 14, dirtyThreshold: 5 },
  { name: "my-personal-website", path: join(SL, "my-personal-website"), stalledAfterDays: 14, dirtyThreshold: 5 },
  { name: "agentic-os", path: join(SL, "agentic-os"), stalledAfterDays: 14, dirtyThreshold: 5 },
];
