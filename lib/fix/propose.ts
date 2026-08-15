/**
 * Build a proposed correction from a drift. Reads files; writes none.
 * Spec: docs/specs/stage-2-fix-proposals.spec.md §3.
 *
 * The corrections are computed, never generated (DECISIONS D15). That is forced
 * by CLAUDE.md §Invariants 1 — no egress means no model may draft prose here —
 * and it is also the better answer: a one-integer splice is reviewable in a
 * glance, which is the only thing that makes the approval gate meaningful.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  findRoleFile,
  extractClaims,
  prRangeHiSpan,
  rewritePrRangeHi,
} from "../collectors/itqan-docs";
import type { CheckResult } from "../types";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Why a check has no automatic fix — spec §3.1, verbatim reasoning.
 *
 * The Board shows these instead of a disabled button (AC-8). "No fix available"
 * with no explanation reads as a broken feature; the truth is that most drift is
 * not a wrong string, and saying so is the honest answer.
 */
export const NO_FIX_REASON: Record<string, string> = {
  DC2: "The fix is to delete or move a line from a plan — an editorial judgement, and this check runs at 0.6 confidence. Proposing deletions on a coin-flip is the wrong trade.",
  DC3: "Nothing in the text is wrong; the document is merely old. The fix is to write a session update — that is authorship, not correction.",
  DC4: "Not a claim. Uncommitted files are a fact about your working tree, not a statement in a document, so there is nothing to substitute.",
  DC5: "Not a claim. A branch ahead of its remote is a fact about git, not a sentence to correct.",
  DC6: "Not a claim. An aging PR needs a review, not an edit.",
  DC7: "Not a claim. A stalled project needs a commit, not a corrected document.",
  DC8: "The remedy is authorship, not substitution: someone has to write the missing role. A machine can propose a one-character diff — it cannot decide what a project's status is.",
};

const GENERIC_NO_FIX =
  "This drift has no deterministic correction — only DC1 (the PR frontier) carries a number that can be substituted unambiguously.";

export interface FileWrite {
  /** Repo-relative, for display. */
  relPath: string;
  absPath: string;
  /** SHA-256 of the whole file when the proposal was built; re-checked at write (§3.4). */
  beforeHash: string;
  /** The complete file to write. AC-4 compares the disk result against this. */
  nextContent: string;
  action: "replace-one-line" | "append-one-line";
}

export interface FixProposal {
  available: true;
  checkId: "DC1";
  claimHash: string;
  projectName: string;
  projectPath: string;
  /** The whole line, before and after — never the token alone (§3.3 consequence 1). */
  line: { number: number; before: string; after: string };
  /** Where the change sits inside the line, so the UI can mark it inline. */
  token: { start: number; end: number; before: string; after: string };
  writes: FileWrite[];
  /** The templated lesson, or null when the project has no lessons file. */
  lessonLine: string | null;
  lessonsSkippedReason: string | null;
  /**
   * A date left untouched on the edited line (§3.3).
   *
   * The mechanical fix substitutes an integer and cannot read the prose beside
   * it, so a "(verified 2026-07-13)" clause survives next to a fact re-verified
   * today. Surfacing it is the argument for the gate, stated concretely.
   */
  contextWarning: { date: string; text: string } | null;
}

export interface NoFix {
  available: false;
  checkId: string;
  reason: string;
}

export type ProposalResult = FixProposal | NoFix;

const no = (checkId: string, reason: string): NoFix => ({ available: false, checkId, reason });

/**
 * Build the proposal, or explain why there isn't one.
 *
 * Every abandonment path returns a readable reason rather than null: a silent
 * absence would be indistinguishable from a bug, and this slice writes to disk.
 */
export function proposeFix(
  projectName: string,
  projectPath: string,
  check: CheckResult,
  todayISO: string = new Date().toISOString().slice(0, 10),
): ProposalResult {
  if (check.id !== "DC1" || !check.fix) {
    return no(check.id, NO_FIX_REASON[check.id] ?? GENERIC_NO_FIX);
  }
  const fix = check.fix;

  if (fix.actualMaxMerged <= fix.claimHi) {
    // Behind-ness is what a number substitution can fix. An open PR the doc
    // never mentions is a missing sentence, and writing sentences is authorship.
    return no(
      check.id,
      `The merged frontier already reads #${fix.claimHi}. The difference is an unmentioned open PR (${fix.unclaimedOpen
        .map((n) => `#${n}`)
        .join(", ")}), which is a sentence someone has to write, not a number to substitute.`,
    );
  }

  const docAbs = join(projectPath, fix.stateDocPath);
  if (!existsSync(docAbs)) {
    return no(check.id, `${fix.stateDocPath} no longer exists — re-run the check.`);
  }

  let doc: string;
  try {
    doc = readFileSync(docAbs, "utf8");
  } catch (e) {
    return no(check.id, `could not read ${fix.stateDocPath}: ${String(e).slice(0, 120)}`);
  }

  // Locate the claim by re-running the extractor rather than trusting the offset
  // captured at check time — the file may have been edited since (§3.2 step 1).
  const here = extractClaims(doc, fix.stateDocPath).filter((c) => c.raw === fix.claimRaw);
  if (here.length !== 1) {
    return no(
      check.id,
      here.length === 0
        ? "The claim is no longer in the document — it was edited since this drift was found. Reload."
        : `The claim text appears ${here.length} times. Refusing to guess which one to edit (§3.4).`,
    );
  }
  const claim = here[0];

  const hiSpan = prRangeHiSpan(claim.raw);
  const fixedRaw = rewritePrRangeHi(claim.raw, fix.actualMaxMerged);
  if (!hiSpan || fixedRaw === null) {
    return no(check.id, "could not locate the upper bound inside the claim — abandoning the edit.");
  }

  const nextDoc = doc.slice(0, claim.start) + fixedRaw + doc.slice(claim.start + claim.raw.length);

  // ── The line, for the diff ────────────────────────────────────────────────
  const lineStart = doc.lastIndexOf("\n", claim.start - 1) + 1;
  const lineEndRaw = doc.indexOf("\n", claim.start);
  const lineEnd = lineEndRaw === -1 ? doc.length : lineEndRaw;
  const lineBefore = doc.slice(lineStart, lineEnd);
  const lineNumber = doc.slice(0, lineStart).split("\n").length;

  // The changed span, relative to the line — taken from the regex's own capture,
  // not from diffing the strings: "#22" → "#23" first differs at the *second*
  // digit, and a token span computed that way would mark the wrong characters.
  const tokenStart = claim.start + hiSpan.start - lineStart;
  const beforeTok = claim.raw.slice(hiSpan.start, hiSpan.end);
  const afterTok = String(fix.actualMaxMerged);

  const lineAfter =
    lineBefore.slice(0, tokenStart) + afterTok + lineBefore.slice(tokenStart + beforeTok.length);

  // ── The inaccuracy the edit cannot see (§3.3) ─────────────────────────────
  const contextWarning = findUntouchedDate(lineBefore, tokenStart, beforeTok.length);

  const writes: FileWrite[] = [
    {
      relPath: fix.stateDocPath,
      absPath: docAbs,
      beforeHash: sha256(doc),
      nextContent: nextDoc,
      action: "replace-one-line",
    },
  ];

  // ── The paired lesson (§3.5) ──────────────────────────────────────────────
  let lessonLine: string | null = null;
  let lessonsSkippedReason: string | null = null;
  const lessonsRel = findRoleFile(projectPath, "lessons");

  if (!lessonsRel) {
    lessonsSkippedReason =
      "This project has no lessons file, so no entry is appended. It is never created from nothing.";
  } else {
    const lessonsAbs = join(projectPath, lessonsRel);
    try {
      const lessons = readFileSync(lessonsAbs, "utf8");
      lessonLine = buildLesson(fix.stateDocPath, claim.text, fix.actualMaxMerged, fix.unclaimedOpen, todayISO);
      writes.push({
        relPath: lessonsRel,
        absPath: lessonsAbs,
        beforeHash: sha256(lessons),
        nextContent: appendLesson(lessons, lessonLine),
        action: "append-one-line",
      });
    } catch (e) {
      lessonsSkippedReason = `could not read ${lessonsRel}: ${String(e).slice(0, 120)}`;
    }
  }

  return {
    available: true,
    checkId: "DC1",
    claimHash: check.claimHash ?? "",
    projectName,
    projectPath: resolve(projectPath),
    line: { number: lineNumber, before: lineBefore, after: lineAfter },
    token: { start: tokenStart, end: tokenStart + beforeTok.length, before: beforeTok, after: afterTok },
    writes,
    lessonLine,
    lessonsSkippedReason,
    contextWarning,
  };
}

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

/**
 * A date on the edited line that the substitution does not touch.
 *
 * Not a heuristic about meaning — it makes no claim about whether the date is
 * wrong. It says only that the tool changed a number on this line and left a
 * date alone, which is precisely what a human reviewer is here to judge.
 */
function findUntouchedDate(
  line: string,
  tokenStart: number,
  tokenLen: number,
): { date: string; text: string } | null {
  for (const m of line.matchAll(ISO_DATE)) {
    const at = m.index ?? 0;
    if (at + m[0].length <= tokenStart || at >= tokenStart + tokenLen) {
      return {
        date: m[0],
        // The headline sentence lives in the UI (app/page.tsx). Repeating it here
        // rendered it twice on the card.
        text: `“${m[0]}” now sits next to a fact re-verified today. The tool never read that clause — you can. Read the whole line before approving.`,
      };
    }
  }
  return null;
}

/** Templated, not generated (§3.5). The shape is fixed; only the facts vary. */
function buildLesson(
  docPath: string,
  claimText: string,
  actualMerged: number,
  unclaimedOpen: number[],
  todayISO: string,
): string {
  const open = unclaimedOpen.length
    ? ` and ${unclaimedOpen.map((n) => `#${n}`).join(", ")} open`
    : "";
  return `- (${todayISO}) ${docPath}'s PR frontier was stale — it claimed "${claimText}" while #${actualMerged} was merged${open}. Caught by agentic-os.`;
}

/** Prefer an existing workflow/docs heading; otherwise the end of the file (§3.5). */
const LESSON_HEADINGS = /^##\s+(workflow|docs|docs & claims|process)\b.*$/gim;

export function appendLesson(lessons: string, line: string): string {
  const body = lessons.endsWith("\n") ? lessons : lessons + "\n";
  const heads = [...body.matchAll(LESSON_HEADINGS)];
  const head = heads[0];

  if (head) {
    const from = (head.index ?? 0) + head[0].length;
    const nextHead = body.slice(from).search(/^##\s/m);
    const insertAt = nextHead === -1 ? body.length : from + nextHead;
    // Land the line at the end of that section, above the blank line that
    // separates it from the next heading, so the file's shape survives.
    const head_ = body.slice(0, insertAt).replace(/\n+$/, "\n");
    return head_ + line + "\n" + (nextHead === -1 ? "" : "\n" + body.slice(insertAt));
  }
  return body + line + "\n";
}
