/**
 * The write. Everything else in this project reads.
 * Spec: docs/specs/stage-2-fix-proposals.spec.md §3.4.
 *
 * Four guards stand between a proposal and a file: the target must resolve
 * inside the project, it must be one of the two documents the fix is allowed to
 * touch, its contents must be unchanged since the proposal was built, and every
 * file must pass all three before *any* of them is written. A half-applied
 * approval — the correction landed, the lesson did not — would break the pairing
 * the correction exists to serve (§3.5).
 *
 * What this file does not do is as load-bearing as what it does: no `git add`,
 * no commit, no branch, no push. The change lands unstaged and stops (AC-7).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { findRoleFile } from "../collectors/itqan-docs";
import { sha256, type FileWrite, type FixProposal } from "./propose";

export interface ApplyOutcome {
  ok: boolean;
  /** Repo-relative paths actually written. Empty on any refusal. */
  written: string[];
  /** Shown to the user verbatim when ok is false. Never a bare "failed". */
  reason?: string;
}

const refuse = (reason: string): ApplyOutcome => ({ ok: false, written: [], reason });

/**
 * Files a fix may touch, resolved from the repo's own role detection — never
 * from the proposal.
 *
 * An earlier version took the state doc from `proposal.writes[0].relPath`, which
 * is circular: a proposal naming README.md as its target had README.md allowed,
 * and the write was stopped only by the content hash further down. Guards must
 * not take their bounds from the thing they are bounding.
 */
function allowedTargets(root: string): string[] {
  return (["state", "lessons"] as const)
    .map((role) => findRoleFile(root, role))
    .filter((rel): rel is string => rel !== null)
    .map((rel) => resolve(join(root, rel)));
}

export function applyFix(proposal: FixProposal): ApplyOutcome {
  const root = resolve(proposal.projectPath);
  if (!proposal.writes.length) return refuse("the proposal contains no file to write");

  const allowed = new Set(allowedTargets(root));

  // ── Verify every file first; write only if all pass ───────────────────────
  for (const w of proposal.writes) {
    const problem = verify(w, root, allowed);
    if (problem) return refuse(problem);
  }

  const written: string[] = [];
  for (const w of proposal.writes) {
    try {
      writeFileSync(resolve(w.absPath), w.nextContent, "utf8");
      written.push(w.relPath);
    } catch (e) {
      // Partial failure is reported as partial. Claiming a clean write here
      // would be exactly the kind of unverified assertion this product exists
      // to catch — in its own code.
      return {
        ok: false,
        written,
        reason: `wrote ${written.join(", ") || "nothing"}, then failed on ${w.relPath}: ${String(e).slice(0, 160)}`,
      };
    }
  }

  return { ok: true, written };
}

function verify(w: FileWrite, root: string, allowed: Set<string>): string | null {
  const abs = resolve(w.absPath);

  // Path confinement (AC-10).
  if (abs !== root && !abs.startsWith(root + sep)) {
    return `refused: ${abs} resolves outside ${root}`;
  }
  if (!allowed.has(abs)) {
    return `refused: ${w.relPath} is not this project's state document or lessons file`;
  }
  if (!existsSync(abs)) {
    return `refused: ${w.relPath} no longer exists`;
  }

  // Content hash re-check (AC-6). The gap between reading a file and writing it
  // is where a human edit or another agent's change gets silently clobbered.
  let current: string;
  try {
    current = readFileSync(abs, "utf8");
  } catch (e) {
    return `refused: could not re-read ${w.relPath}: ${String(e).slice(0, 120)}`;
  }
  if (sha256(current) !== w.beforeHash) {
    return `refused: ${w.relPath} changed after the proposal was built. Nothing was written — reload the Board and re-propose.`;
  }
  return null;
}
