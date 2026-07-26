# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated 2026-07-27.
> Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is only "where we
> are and what's next."
>
> **Trust but verify:** this file can go stale between sessions — merged PRs, pushed commits, or
> a changed remote don't announce themselves here. Cross-check `git status`, `git log`, and
> `gh pr list` before acting on anything below as fact. *This project exists because that
> failure is real; do not be its next example.* **You can now also just run the app** — it
> checks this project too.

## Where things stand

- **Stage 1 ships: the reconciliation Board runs.** `pnpm install && pnpm dev` → the Board at
  `localhost:3000`. `pnpm verify` runs the acceptance suite; **all 8 checks pass** (AC-1…AC-7
  plus an extractor-trap guard).
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
- **All product decisions closed** — `docs/DECISIONS.md` D1–D14.

## How to pick up

1. `git status && git log --oneline -5 && gh pr list` — verify this file against reality.
2. `pnpm install && pnpm verify` — should print 8 passes. If AC-1 now fails, that is **good
   news**: it means nadim's HANDOFF was fixed. Update the acceptance fixture rather than the
   check.
3. `pnpm dev` → read the Board. It includes itself.
4. `pnpm type-check` and `pnpm build` both clean as of this commit.

## Next up

1. **Stage 2 — gated fix proposals** (PRD §6.2). The Board detects drift but cannot yet offer
   the correction. This is where `data/verified.json` and "mark verified" get built, together
   with the write path and its approval gate — they are one problem, which is why Stage 1
   deliberately shipped without the acknowledge control (`docs/BACKLOG.md`).
2. **Round-2 wireframes — the Overview** (`docs/DESIGN-BRIEF.md` §5.5). Blocks the Stage 3 spec,
   nothing else. Can run in parallel with Stage 2.
3. **Stage 3 — the Overview** (PRD §6.8), once its wireframes exist and a spec closes.

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
  mid-build when DC4's threshold surfaced.
