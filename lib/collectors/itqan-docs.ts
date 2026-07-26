import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Claim, DocsFacts, Role, RoleCoverage } from "../types";
import { ROLE_ORDER } from "../types";

/**
 * Role detection must check FULL-profile alternates, not just lite paths
 * (spec §3.3).
 *
 * This is not a detail. Checking lite paths only produced a live error in this
 * project's own PRD: salla-apps was recorded as "Router only" when it actually has
 * a 467-line CLAUDE.md, 13 specs, MISTAKES.md + KNOWLEDGE.md and a 309-line
 * CHANGELOG — a full install missing just its State role. See docs/LEARNINGS.md.
 */
const ROLE_FILES: Record<Role, string[]> = {
  router: ["CLAUDE.md"],
  state: ["docs/HANDOFF.md", "COMPASS.md"],
  queue: ["docs/specs"],
  decisions: ["docs/DECISIONS.md", "DECISIONS.md"],
  lessons: ["docs/LEARNINGS.md", "MISTAKES.md", "KNOWLEDGE.md"],
  behaviour: ["docs/FEATURES.md"],
  record: ["CHANGELOG.md"],
};

/** Directory roles count as filled only when they actually contain markdown. */
function fills(repo: string, rel: string): boolean {
  const abs = join(repo, rel);
  if (!existsSync(abs)) return false;
  try {
    const st = statSync(abs);
    if (st.isDirectory()) {
      return readdirSync(abs).some((f) => f.endsWith(".md"));
    }
    return st.size > 0;
  } catch {
    return false;
  }
}

function detectRoles(repo: string): RoleCoverage[] {
  return ROLE_ORDER.map((role) => {
    const via = ROLE_FILES[role].find((rel) => fills(repo, rel));
    // Record is the one role git always fills, even without a CHANGELOG.
    if (!via && role === "record") {
      return { role, filled: true, via: "git history" };
    }
    return { role, filled: Boolean(via), via };
  });
}

/**
 * High-precision claim patterns ONLY (spec §3.2).
 *
 * A proximity pattern of the shape /PR #(\d+) .{0,40}? (merged|open)/ was written,
 * tested against nadim's real HANDOFF, and REJECTED: it captured "PR #5 unmerged"
 * as MERGED, because `merged` matches as a substring of `unmerged`. It also paired
 * "#24" with a `merged` belonging to a different clause. Both would have shipped
 * confident, wrong drift reports.
 *
 * Rule: a pattern must match the full claim including its verb, or it does not run.
 */
const PR_RANGE_MERGED =
  /\bPRs?\s+#(\d+)\s+(?:through|thru|to|–|—|-)\s+#?(\d+)\s+(?:are\s+|have\s+been\s+)?(merged)\b/gi;

export function extractClaims(doc: string, source: string): Claim[] {
  const claims: Claim[] = [];
  for (const m of doc.matchAll(PR_RANGE_MERGED)) {
    const idx = m.index ?? 0;
    const preceding = doc.slice(Math.max(0, idx - 12), idx).toLowerCase();
    if (/\b(not|un|no)\s*$/.test(preceding)) continue; // negation guard
    if (/un(?=merged)/i.test(m[0])) continue; // "unmerged" inside the match
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) continue;
    claims.push({
      kind: "pr-range-merged",
      lo,
      hi,
      text: m[0].replace(/\s+/g, " ").trim(),
      confidence: 0.95,
      source,
    });
  }
  return claims;
}

/** "Next up" items naming a PR — DC2's input. Low confidence by construction. */
function extractNextUpPrRefs(doc: string): { pr: number; line: string }[] {
  const out: { pr: number; line: string }[] = [];
  const section = doc.match(/^##\s+Next up\b([\s\S]*?)(?=^##\s|\Z)/im);
  if (!section) return out;
  for (const line of section[1].split("\n")) {
    if (!/^\s*[-*\d]/.test(line)) continue;
    for (const m of line.matchAll(/\bPR\s+#(\d+)\b/gi)) {
      out.push({ pr: Number(m[1]), line: line.replace(/\s+/g, " ").trim().slice(0, 200) });
    }
  }
  return out;
}

export function collectDocs(repo: string): DocsFacts {
  const roles = detectRoles(repo);
  const stateRel = ROLE_FILES.state.find((rel) => fills(repo, rel)) ?? null;

  let claims: Claim[] = [];
  let nextUpPrRefs: { pr: number; line: string }[] = [];
  let stateDocMtimeISO: string | null = null;

  if (stateRel) {
    const abs = join(repo, stateRel);
    try {
      const text = readFileSync(abs, "utf8");
      claims = extractClaims(text, stateRel);
      nextUpPrRefs = extractNextUpPrRefs(text);
      stateDocMtimeISO = statSync(abs).mtime.toISOString();
    } catch {
      // Unreadable state doc is not a drift — it is an absent claim.
    }
  }

  return { roles, stateDocPath: stateRel, stateDocMtimeISO, claims, nextUpPrRefs };
}
