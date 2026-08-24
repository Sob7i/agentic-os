/**
 * Pure rendering helpers for the delivery path — Stage 4b §3.7 (the dispatch preamble) and §3.8
 * (the PR body and the push control's own label). Ticket: docs/specs/stage-4b-tickets.md T3.
 *
 * **A leaf module — `chain-render.ts`'s own sibling.** No `db` import, no `node:` builtin.
 * `dispatch.ts` (which imports both) calls `composePreamble` into the prompt it builds; T4's push
 * server action will call `composePrBody` into the PR it opens; T4's client component will render
 * `pushControlLabel` directly on the session card. `verify:stage3c` AC-1 walks the client-reachable
 * import graph and would fail on either import this file must not carry
 * (docs/specs/stage-4b-tickets.md, "inherited fact 7") — if this file ever needs `db` or a `node:`
 * import, that work belongs in `dispatch.ts` instead.
 *
 * **Composed, not configured (§3.7).** Every string below is built from facts the caller already
 * holds — never retyped into `agentos.yml`, never a template with its own copy to keep in sync.
 * Two renderings of one fact that must agree are a second source of truth wearing a justification
 * — the same reasoning D36 already settled for `gateRefusalReason`'s two audiences (one function,
 * one place, every rendering), applied here one level down: the preamble is code, not a config
 * field, for the identical reason.
 */
import type { CommandSpec } from "./config";
import type { DriftAtSpawn } from "./types";

// ---------------------------------------------------------------------------
// §3.7 — the dispatch preamble
// ---------------------------------------------------------------------------

/**
 * Everything `composePreamble` needs, already resolved by the caller — `dispatch.ts` builds this
 * from the worktree it just created (D37) and the config it re-reads fresh every turn (§3.5's own
 * "declared, never inferred," which is why `prepare`/`verify` arrive here rather than being looked
 * up by this module).
 */
export interface PreambleInput {
  /** Absolute path to the session's worktree — gone the moment this session ends. */
  worktreePath: string;
  /** `agentos/<slug>-<8 hex>` — the ref every commit this session makes lands on (D37). */
  branchName: string;
  /** The **resolved sha** the worktree was branched from, never a symbolic ref
   *  (`worktree.ts`'s own `Worktree.baseRef` carries this same rule). */
  baseSha: string;
  /** `agentos.yml`'s `prepare:` key for this turn, or null if the project declares none. */
  prepare: CommandSpec | null;
  /** `agentos.yml`'s `verify:` key for this turn, or null if the project declares none. */
  verify: CommandSpec | null;
}

/**
 * Renders a declared command the way its own author typed it — argv joined with spaces — or names
 * its absence plainly. **Never a fabricated default:** "not configured" is the honest word for "no
 * such key in this project's `agentos.yml`," and inventing a stand-in here would let a project's
 * silence be misread as a choice it never made.
 */
function commandLine(label: "prepare" | "verify", spec: CommandSpec | null): string {
  return spec ? `${label}: ${spec.command.join(" ")}` : `${label}: not configured`;
}

/**
 * The block that precedes the task's own text (§3.7). `dispatch.ts` builds its prompt as
 * `composePreamble(...) + "\n\n" + taskText` — never the reverse: the task description stays the
 * brief; this preamble stays the environment.
 *
 * Every line is a fact a session in an ephemeral worktree cannot safely guess: where it is, what
 * ref its commits land on, what base it diverged from, whether anything will check its work
 * afterward — plus the two sentences with no code behind them the session could otherwise never
 * learn, that nothing survives past this run unless it is committed, and that the worktree itself
 * stops existing once the run ends.
 */
export function composePreamble(input: PreambleInput): string {
  return [
    "You are working inside an ephemeral git worktree prepared for this session.",
    `Worktree: ${input.worktreePath}`,
    `Branch: ${input.branchName}`,
    `Base: ${input.baseSha}`,
    commandLine("prepare", input.prepare),
    commandLine("verify", input.verify),
    "",
    "Commit your work before you finish or stop — nothing uncommitted survives this session.",
    "This directory is destroyed when this session ends.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// §3.8 — the PR body and the push control's label
// ---------------------------------------------------------------------------

/**
 * Everything `composePrBody` needs — a settled session's own evidence, gathered by the caller.
 * This module has no `db`, so it reads nothing itself.
 */
export interface PrBodyInput {
  sessionId: string;
  /** Null means the SDK never reported a cost — **unknown, never zero.** The same rule
   *  `lib/tasks/model.ts`'s own `money()` enforces for the session view; restated here rather than
   *  imported, since that module is not a leaf and this one must stay one. */
  costUsd: number | null;
  /** §7.5's snapshot — what the portfolio layer claimed true when this session spawned, rendered
   *  in the past tense (D19's evidence rule: a status must be able to name the check behind it). */
  driftAtSpawn: DriftAtSpawn;
  /** Every `CommitSha` row for this session, oldest first (`listCommitShas`'s own ordering). */
  commitShas: string[];
  /** Null means "no `verify:` key was configured," a different fact from `0` meaning "ran and
   *  passed" (D40) — collapsing the two would let a session with no check at all read as green. */
  verifyExitCode: number | null;
}

/**
 * The evidence body §3.8's push click writes onto the PR it opens — session id, cost, the drift
 * snapshot taken at spawn, every commit sha, and the verify result. Never asserts anything the
 * `Session` row itself doesn't already carry; this function only renders it (D19: "a status that
 * cannot name the session that produced it is a claim").
 */
export function composePrBody(input: PrBodyInput): string {
  const cost = input.costUsd === null ? "cost unknown" : `$${input.costUsd.toFixed(2)}`;
  const verify = input.verifyExitCode === null ? "not configured" : `exited ${input.verifyExitCode}`;
  const shas =
    input.commitShas.length > 0
      ? input.commitShas.map((sha) => `- \`${sha}\``).join("\n")
      : "- (no commits)";

  /**
   * **All five fields of the drift record, not just the severity and the claim.** T3's first
   * version rendered `<severity> — <claim>` and dropped `verified`, `source`, `check` and
   * `checkedAtISO`; the author flagged it as a judgement call and it is the wrong side of one.
   *
   * A claim with no contradicting fact beside it, no file it came from, and no time it was
   * checked is *an assertion* — which is the one thing invariant 2 forbids the product to make
   * ("every fact displayed carries what was checked and when"), and the Board's own drift card
   * has never been allowed to render less. It matters more here than on the card, not less: §3.8
   * calls the PR body the point where "that evidence stops being internal", so this is the single
   * place the record leaves the machine, in front of a reviewer who cannot click through to the
   * session view to recover what was elided.
   *
   * Every field is always populated for every severity, including `in-sync` and `unverifiable` —
   * `driftAtSpawnFromReport` in `dispatch.ts` fills all six on all three of its paths — so this
   * renders sensibly for a clean project rather than printing empty labels.
   */
  const drift = input.driftAtSpawn;

  return [
    `Session: ${input.sessionId}`,
    `Cost: ${cost}`,
    `Verify: ${verify}`,
    "",
    `Drift at spawn: ${drift.severity}`,
    `- claimed: ${drift.claim}`,
    `- verified: ${drift.verified}`,
    `- source: ${drift.source}`,
    `- check: ${drift.check}`,
    `- checked at: ${drift.checkedAtISO}`,
    "",
    "Commits:",
    shas,
  ].join("\n");
}

/**
 * `` Push `agentos/stage-6-t1-a1b2c3d4` & open PR → develop `` — the push control's own label
 * (§3.8, AC-12). **Never "Ship":** a push and an opened PR is exactly what the one click does, and
 * D41 draws the product's authority at that line — its own copy must not claim more than it did.
 * A single template literal, no line break between the branch name and its surrounding text —
 * this stage's version of the twice-shipped "interpolate complete strings" defect.
 */
export function pushControlLabel(branch: string, base: string): string {
  return `Push \`${branch}\` & open PR → ${base}`;
}
