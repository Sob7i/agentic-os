# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated **2026-08-15**
> (execution-layer re-scope).
> Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is only "where we
> are and what's next."
>
> **Trust but verify:** this file can go stale between sessions — merged PRs, pushed commits, or
> a changed remote don't announce themselves here. Cross-check `git status`, `git log`, and
> `gh pr list` before acting on anything below as fact. *This project exists because that
> failure is real; do not be its next example.* **You can now also just run the app** — it
> checks this project too.

## Where things stand

- **⚠ The product was re-scoped on 2026-08-15 — read `docs/PRD.md` §12 before planning anything.**
  Agentic OS is now **two layers**: the portfolio (Board + Overview, read-only, what exists today)
  and a new per-project, opt-in **execution layer** adapted from
  [`docs/specs/AgentOS-spec.md`](specs/AgentOS-spec.md) — tasks, goals, inbox, sessions, costs,
  with agents and templates as configuration. **Nothing of it is built.** Decisions D18–D22 are
  closed; the build order in PRD §10 was renumbered and old Stage 3 (Overview) moved to Stage 6.
- **Stage 2 is built but NOT merged.** PR **#6** (`feat/stage-2-fix-proposals`) is still open, and
  Stage 2's own acceptance criterion — *one real drift corrected through the dashboard* — has never
  been met. Both are owner gates. Do not treat Stage 2 as closed.
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

1. **Approve nadim's proposal once, by hand, and merge PR #6** (both owner gates). This is the
   only thing separating "eleven fixture tests pass" from "this has corrected a real document",
   and it should happen *before* the execution layer starts, so the pivot begins from a closed
   stage rather than an open one. Afterwards the card should read `✎ written · awaiting re-check`
   with git's own porcelain beneath it, and the next reload should decide for itself whether the
   drift is gone. Undo is `git checkout -- docs/HANDOFF.md docs/LEARNINGS.md` in nadim.
2. **Hand `docs/DESIGN-BRIEF-EXECUTION.md` to a design agent** (round 3). Its main ask is the
   **shell and navigation** — four architectures are laid out in §4.2 with the brief's own lean
   toward C (portfolio as a persistent spine, project as the pane) and an explicit invitation to
   beat it. Nothing blocks this; it can run in parallel with everything below.
3. **Write the Stage 3 spec — the execution MVP** (PRD §12.4): one vertical thread, one project,
   local runner. `docs/specs/` conventions apply — `☐` until every question in §5 is answered.
   The interesting decisions it must close: the SQLite schema for tasks/sessions, how a session
   token is scoped, how the ephemeral worktree is created and torn down, and which watched repo is
   the first target (PRD §12.4 says a low-stakes one, **not** agentic-os).
4. **Build Stage 3.** Then Stage 4 templates → Stage 5 goals → Stage 6 the rewritten Overview →
   Stage 7 portfolio cost. PRD §10 has the acceptance criterion for each.

**Deliberately not next:** the Overview as previously specced (cancelled by D22 — it must read the
execution layer's tasks and goals, which do not exist yet), and everything in PRD §12.7.

**One thing to keep honest.** PRD §11.3 contains a standing instruction written before enthusiasm:
*if the Board is not opened daily within two weeks of Stage 2, the premise was wrong — record it
and stop.* Stage 2 is not merged and that clock has not meaningfully started. The re-scope does
not void that instruction; it makes it easier to forget.

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
- **2026-08-15** — Nineteen days idle; PR #6 never merged. `docs/specs/AgentOS-spec.md` arrived as
  the target for where the product should go. Evaluated against the shipped code, and the finding
  that shaped everything: the two systems point in **opposite directions** and the source spec
  breaks three of the five invariants — so the integration was written as **narrowing ADRs rather
  than deletions** (D19), which turned out to produce a better rule than the one it replaced.
  Phase A shipped this session: D18–D22, PRD §12 + a renumbered §10, the round-3 design brief, and
  the invariants scoped in `CLAUDE.md`. **Also found stale:** `CLAUDE.md` still read *"Status:
  pre-code"* while its own Commands table documented 19 passing acceptance checks — fixed, with a
  lesson (`docs/LEARNINGS.md`). **No code was written and no behaviour changed**, so
  `docs/FEATURES.md` is deliberately untouched.
