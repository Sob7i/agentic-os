# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated 2026-07-27 (Stage 2).
> Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is only "where we
> are and what's next."
>
> **Trust but verify:** this file can go stale between sessions — merged PRs, pushed commits, or
> a changed remote don't announce themselves here. Cross-check `git status`, `git log`, and
> `gh pr list` before acting on anything below as fact. *This project exists because that
> failure is real; do not be its next example.* **You can now also just run the app** — it
> checks this project too.

## Where things stand

- **Stage 2 ships: the gate is live.** The Board now offers a correction on DC1 drift and writes
  it only on an explicit click. `pnpm verify` runs **both** suites — 8 Stage 1 checks and 11
  Stage 2 checks, **19 passing** as of this commit. Stage 2's tests run entirely against
  generated fixture repos in a temp dir; no watched project is written to by a test.
- **The write path, in order:** `lib/fix/propose.ts` (pure, reads only) → `lib/fix/apply.ts`
  (four guards, all-or-nothing) → `app/actions.ts` (rebuilds the proposal server-side from the
  claim hash — the browser never names a path or supplies bytes) → the card UI in `app/page.tsx`.
- **Nothing has actually been approved yet.** All four UI states were rendered against live data,
  but no watched repo has been corrected through the button — that is an owner gate. nadim's
  `#22` → `#23` proposal is sitting on the Board waiting.
- **Stage 1 still ships: the reconciliation Board runs.** `pnpm install && pnpm dev` → the Board
  at `localhost:3000` (`:3001` if the port is busy).
- **It found the drift it was built to find, unaided.** nadim's HANDOFF claims *"PRs #1 through
  #22 merged"*; the Board reports `#23 is merged (1 past the claim); unclaimed open: #24`, and
  cites `docs/HANDOFF.md` as the source.
- **Live board state** (2026-07-27): nadim `⚠ drift` · agentic-os `○ attention` · fractal-code,
  my-personal-website, salla-apps `◌ unverifiable` (no state doc) · itqan `✓ in sync`.
- **Built:** collectors (`git`, `github`, `itqan-docs`), checks DC1–DC8, the Board UI per
  Concept C, degraded states, and `scripts/verify-acceptance.mts`.
- **D14 closed mid-build** — DC4 (uncommitted work) needed a threshold. Without one every
  project was permanently non-green and `✓ in sync` could never render, failing AC-2. Default 5,
  configurable per project.
- **Building it found something the wireframe got wrong.** `Fix Proposal v2` draws nadim's claim
  on `line 24` as a tidy snippet; it is really on **line 15**, inside a ~600-character bullet, so
  the live diff wraps to a paragraph. The design's *structure* held — full line, amber-flagged
  date — but its content was a reconstruction → `docs/BACKLOG.md`, `docs/LEARNINGS.md`.
- **The superseded `Fix Proposal` frame is renamed** to `SUPERSEDED (round 1) — … do not build`,
  closing the round-2 review's one blocking item.
- **Round-2 designs delivered, reviewed, and now partly consumed.** Overview direction is closed
  as **D16** (Concept A, tabbed/by-band, plus Concept B's "blocked on you" spotlight band).
- **All product decisions closed** — `docs/DECISIONS.md` D1–D17. D17 is new: the gate's second
  button acknowledges, it does not reject.

## How to pick up

1. `git status && git log --oneline -5 && gh pr list` — verify this file against reality.
2. `pnpm install && pnpm verify` — should print **19 passes** (8 + 11). If Stage 1's AC-1 now
   fails, that is **good news**: it means nadim's HANDOFF was fixed. Update the acceptance
   fixture rather than the check.
3. `pnpm dev` → read the Board. It includes itself, and nadim's card carries a live proposal.
4. `pnpm type-check` and `pnpm build` both clean as of this commit.

## Next up

1. **Approve nadim's proposal once, by hand** (owner gate). It is the only thing separating
   "eleven fixture tests pass" from "this has corrected a real document". Afterwards the card
   should read `✎ written · awaiting re-check` with git's own porcelain beneath it, and the next
   reload should decide for itself whether the drift is gone. Undo is
   `git checkout -- docs/HANDOFF.md docs/LEARNINGS.md` in nadim.
2. **Write the Stage 3 spec — the Overview** (PRD §6.8), against **D16**, not against either
   wireframe as drawn: Concept A's tabbed by-band layout **plus** Concept B's "blocked on you"
   spotlight band. Nothing blocks it; the wireframes exist and the direction is closed.
3. **Build Stage 3.** Provenance rendering (◆ derived / ✓ verified / ~ suspect) is the part that
   earns the surface — and `~ suspect` must be sourced from *this* Board's drift state, not
   re-derived, or the Overview becomes the second source of truth D11 forbids.

**Later** (PRD §10): Stage 4 transcripts and cost · Stage 5 folded into the Overview (D12) ·
Stage 6+ pain-gated.

## Blockers

None.

## Session log

- **2026-07-26** — PRD written; design brief written; round-1 wireframes delivered, Concept C
  chosen. Three commits direct to `main` (before D13).
- **2026-07-27** — Owner closed the open decisions (→ D5–D12). itqan installed (lite +
  `docs/specs/`), PR #1 merged. Stage 1 spec written and decision-closed, PR #2 merged. Stage 1
  built: all acceptance criteria pass, the Board runs in both colour schemes, and D14 was closed
  mid-build when DC4's threshold surfaced. Stage 2 spec written (PR #4), round-2 designs reviewed
  and D15/D16 recorded (PR #5).
- **2026-07-27 (later)** — Stage 2 built: propose → apply → 11 fixture-based acceptance checks →
  UI, in that order. Two defects were caught by *running* it rather than by review — a
  path-confinement guard that derived its bounds from its own input, and the JSX-newline bug
  recurring as "2 file s". The second one had already bitten once, so it was promoted from a
  lesson to a rule in `CLAUDE.md`.
