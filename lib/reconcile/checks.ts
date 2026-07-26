import { createHash } from "node:crypto";
import type { ProjectConfig } from "../../projects.config";
import { collectDocs } from "../collectors/itqan-docs";
import { collectGit } from "../collectors/git";
import { collectGitHub } from "../collectors/github";
import { ageInDays, humanAge } from "../collectors/exec";
import type { CheckResult, ProjectReport, Severity } from "../types";

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

/** Severity ranking — highest wins for the project's overall state. */
const RANK: Record<Severity, number> = {
  drift: 3,
  attention: 2,
  unverifiable: 1,
  "in-sync": 0,
};

export async function reconcileProject(cfg: ProjectConfig): Promise<ProjectReport> {
  // Collectors run in parallel and independently: one failing must never blank
  // the others (spec §3.1, AC-7).
  const [git, github] = await Promise.all([collectGit(cfg.path), collectGitHub(cfg.path)]);
  const docs = collectDocs(cfg.path);
  const checks: CheckResult[] = [];

  // ── DC1 · PR frontier mismatch ─────────────────────────────────────────────
  // The only check with a sub-1.0 claim confidence that can produce a drift.
  if (github.ok && docs.claims.length) {
    for (const claim of docs.claims) {
      const unclaimedOpen = github.open.filter((p) => p.number > claim.hi);
      const behind = github.maxMerged - claim.hi;
      if (behind > 0 || unclaimedOpen.length > 0) {
        const parts: string[] = [];
        if (behind > 0) parts.push(`#${github.maxMerged} is merged (${behind} past the claim)`);
        if (unclaimedOpen.length) {
          parts.push(`unclaimed open: ${unclaimedOpen.map((p) => `#${p.number}`).join(", ")}`);
        }
        const staleFor = docs.stateDocMtimeISO ? ageInDays(docs.stateDocMtimeISO) : null;
        checks.push({
          id: "DC1",
          severity: "drift",
          headline:
            (behind > 0 ? `${behind + unclaimedOpen.length} PRs unaccounted for` : "open PR unaccounted for") +
            (staleFor !== null ? ` · doc unchanged ${staleFor}d` : ""),
          claimed: claim.text,
          verified: parts.join("; "),
          confidence: claim.confidence,
          source: claim.source,
          claimHash: hash(`${cfg.name}:DC1:${claim.text}:${github.maxMerged}`),
        });
      }
    }
  }

  // ── DC2 · "Next up" item already done ──────────────────────────────────────
  // Confidence 0.6 by construction: a "Next up" line naming a merged PR usually
  // means the item shipped, but it can also be citing context. Rendered tentative.
  if (github.ok && docs.nextUpPrRefs.length) {
    const merged = new Set(github.mergedNumbers);
    for (const ref of docs.nextUpPrRefs) {
      if (merged.has(ref.pr)) {
        checks.push({
          id: "DC2",
          severity: "drift",
          headline: `"Next up" item may already be done (PR #${ref.pr} merged)`,
          claimed: ref.line,
          verified: `PR #${ref.pr} is merged`,
          confidence: 0.6,
          source: docs.stateDocPath ?? undefined,
          claimHash: hash(`${cfg.name}:DC2:${ref.pr}:${ref.line}`),
        });
      }
    }
  }

  // ── DC3 · State doc older than the last commit ─────────────────────────────
  if (git.ok && docs.stateDocMtimeISO) {
    const docMs = new Date(docs.stateDocMtimeISO).getTime();
    const commitMs = new Date(git.lastCommitISO).getTime();
    if (commitMs > docMs) {
      const gap = Math.floor((commitMs - docMs) / 86_400_000);
      if (gap >= 1) {
        checks.push({
          id: "DC3",
          severity: gap >= 7 ? "drift" : "attention",
          headline: `state doc ${gap}d older than the last commit`,
          claimed: `${docs.stateDocPath} last written ${humanAge(docs.stateDocMtimeISO)} ago`,
          verified: `last commit ${git.lastCommitSha} was ${humanAge(git.lastCommitISO)} ago`,
          confidence: 1,
          source: docs.stateDocPath ?? undefined,
          claimHash: hash(`${cfg.name}:DC3:${docs.stateDocMtimeISO}:${git.lastCommitSha}`),
        });
      }
    }
  }

  // ── DC4 · Uncommitted work ─────────────────────────────────────────────────
  // Threshold, not presence (DECISIONS D14). A couple of stray files is normal
  // working state; without a threshold every project is permanently non-green and
  // `in-sync` never renders at all.
  if (git.ok && git.dirtyCount >= cfg.dirtyThreshold) {
    checks.push({
      id: "DC4",
      severity: "attention",
      headline: `${git.dirtyCount} uncommitted files`,
      verified: `${git.dirtyCount} changed on ${git.branch} (threshold ${cfg.dirtyThreshold})`,
      confidence: 1,
    });
  }

  // ── DC5 · Branch ahead/behind its remote ───────────────────────────────────
  if (git.ok && (git.ahead > 0 || git.behind > 0)) {
    const bits = [git.ahead ? `${git.ahead} ahead` : null, git.behind ? `${git.behind} behind` : null]
      .filter(Boolean)
      .join(", ");
    checks.push({
      id: "DC5",
      severity: "attention",
      headline: `branch ${bits} of its remote`,
      verified: `${git.branch} is ${bits}`,
      confidence: 1,
    });
  }

  // ── DC6 · Open PR aging without a review ───────────────────────────────────
  if (github.ok) {
    for (const pr of github.open) {
      const age = pr.updatedAtISO ? ageInDays(pr.updatedAtISO) : 0;
      if (!pr.isDraft && !pr.reviewDecision && age >= 3) {
        checks.push({
          id: "DC6",
          severity: "attention",
          headline: `PR #${pr.number} open ${age}d with no review`,
          verified: `#${pr.number} "${pr.title.slice(0, 60)}" · last activity ${humanAge(pr.updatedAtISO)} ago`,
          confidence: 1,
        });
      }
    }
  }

  // ── DC7 · Stalled ──────────────────────────────────────────────────────────
  if (git.ok && git.lastCommitAgeDays >= cfg.stalledAfterDays) {
    checks.push({
      id: "DC7",
      severity: "attention",
      headline: `no commit in ${git.lastCommitAgeDays} days`,
      verified: `last commit ${git.lastCommitSha}, ${humanAge(git.lastCommitISO)} ago`,
      confidence: 1,
    });
  }

  // ── DC8 · Role coverage gaps ───────────────────────────────────────────────
  // The framework repo defines the roles rather than instantiating them, so gaps
  // there are not findings.
  if (!cfg.isFrameworkRepo) {
    const missing = docs.roles.filter((r) => !r.filled).map((r) => r.role);
    if (missing.length) {
      checks.push({
        id: "DC8",
        severity: "attention",
        headline: `${missing.length} itqan role${missing.length === 1 ? "" : "s"} not instantiated`,
        verified: `missing: ${missing.join(", ")}`,
        confidence: 1,
      });
    }
  }

  return {
    name: cfg.name,
    path: cfg.path,
    severity: overallSeverity(checks, docs.stateDocPath, cfg),
    git,
    github,
    docs,
    checks,
    checkedAtISO: new Date().toISOString(),
  };
}

/**
 * The fourth state exists for correctness, not nuance (spec §3.4).
 *
 * A project with no state doc has made no claim, so nothing was checked against
 * reality. Calling that "in sync" would assert a verification that never ran —
 * the product breaking its own verify-before-claim invariant on its main screen.
 */
function overallSeverity(
  checks: CheckResult[],
  stateDocPath: string | null,
  cfg: ProjectConfig,
): Severity {
  const worst = checks.reduce<Severity>(
    (acc, c) => (RANK[c.severity] > RANK[acc] ? c.severity : acc),
    "in-sync",
  );
  if (worst === "drift") return "drift";
  // No state doc and not the framework repo → nothing was verifiable.
  if (!stateDocPath && !cfg.isFrameworkRepo) return "unverifiable";
  return worst;
}
