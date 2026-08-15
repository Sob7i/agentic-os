/** Shared types for collectors and checks. Spec: docs/specs/stage-1-reconciliation.spec.md */

/** The four result states (spec §3.4). `unverifiable` is required, not a nicety. */
export type Severity = "drift" | "attention" | "in-sync" | "unverifiable";

/** Which of the seven itqan roles a project fills. */
export type Role = "router" | "state" | "queue" | "decisions" | "lessons" | "behaviour" | "record";

export const ROLE_ORDER: Role[] = [
  "router",
  "state",
  "queue",
  "decisions",
  "lessons",
  "behaviour",
  "record",
];

/** Single-letter labels for the roster matrix, in ROLE_ORDER. */
export const ROLE_LABEL: Record<Role, string> = {
  router: "R",
  state: "S",
  queue: "Q",
  decisions: "D",
  lessons: "L",
  behaviour: "B",
  record: "C",
};

export interface RoleCoverage {
  role: Role;
  filled: boolean;
  /** The file that filled it, repo-relative — evidence, so the UI never asserts blindly. */
  via?: string;
}

export interface GitFacts {
  ok: true;
  branch: string;
  dirtyCount: number;
  ahead: number;
  behind: number;
  lastCommitSha: string;
  lastCommitISO: string;
  lastCommitAgeDays: number;
}

export interface CollectorFailure {
  ok: false;
  /** Shown to the user verbatim. Never swallowed into a silent zero. */
  reason: string;
}

export type GitResult = GitFacts | CollectorFailure;

export interface PullRequest {
  number: number;
  title: string;
  updatedAtISO: string;
  reviewDecision: string | null;
  isDraft: boolean;
}

export interface GitHubFacts {
  ok: true;
  open: PullRequest[];
  mergedNumbers: number[];
  maxMerged: number;
}

export type GitHubResult = GitHubFacts | CollectorFailure;

/**
 * A claim extracted from a state document. Only high-precision patterns produce
 * these (spec §3.2) — proximity matching is prohibited.
 */
export interface PrRangeClaim {
  kind: "pr-range-merged";
  lo: number;
  hi: number;
  /** The matched text, whitespace-normalised. Quoted in the UI; never paraphrased. */
  text: string;
  /**
   * The matched text exactly as it appears in the file — line breaks and all.
   * `text` is for reading; `raw` is what a correction may splice (Stage 2 §3.2).
   */
  raw: string;
  /** Character offset of `raw` in the source document. The edit target. */
  start: number;
  confidence: number;
  /** Repo-relative path of the document that made the claim. */
  source: string;
}

export type Claim = PrRangeClaim;

export interface DocsFacts {
  roles: RoleCoverage[];
  /** Repo-relative path of the state doc, or null when the role is unfilled. */
  stateDocPath: string | null;
  stateDocMtimeISO: string | null;
  claims: Claim[];
  /** "Next up" entries referencing a PR number, for DC2. */
  nextUpPrRefs: { pr: number; line: string }[];
}

/**
 * Everything a deterministic DC1 correction needs, captured at check time
 * (Stage 2 spec §3.2). Present on DC1 and nowhere else — its absence is how the
 * UI knows a drift has no automatic fix, rather than a disabled button (AC-8).
 */
export interface Dc1FixData {
  stateDocPath: string;
  /** The claim exactly as it sits in the file. Located again before any write. */
  claimRaw: string;
  claimLo: number;
  claimHi: number;
  /** The number the claim should carry. */
  actualMaxMerged: number;
  /** Open PRs numbered past the claim — context for the paired lesson. */
  unclaimedOpen: number[];
}

/** A single check result. `derived` checks cannot be wrong about their own inputs. */
export interface CheckResult {
  id: string;
  severity: Severity;
  /** One-line headline, e.g. "2 PRs behind · stale 12 days". */
  headline: string;
  /** What the document says — quoted verbatim. Absent for derived checks. */
  claimed?: string;
  /** What git/GitHub say now. */
  verified?: string;
  confidence: number;
  /** Where the claim came from, so the UI can cite it. */
  source?: string;
  /** Stable identity for acknowledgements — changes when the claim changes. */
  claimHash?: string;
  /** DC1 only: the inputs a deterministic correction needs (Stage 2). */
  fix?: Dc1FixData;
}

export interface ProjectReport {
  name: string;
  path: string;
  severity: Severity;
  git: GitResult;
  github: GitHubResult;
  docs: DocsFacts;
  checks: CheckResult[];
  /** ISO timestamp of when this project's checks ran. */
  checkedAtISO: string;
}

export interface BoardReport {
  projects: ProjectReport[];
  checkedAtISO: string;
  /** True when any collector failed anywhere — drives the degraded banner. */
  degraded: boolean;
}
