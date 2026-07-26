# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated 2026-07-27.
> Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is only "where we
> are and what's next."
>
> **Trust but verify:** this file can go stale between sessions — merged PRs, pushed commits, or
> a changed remote don't announce themselves here. Cross-check `git status`, `git log`, and
> `gh pr list` before acting on anything below as fact. *This project exists because that
> failure is real; do not be its next example.*

## Where things stand

- **Pre-code.** No `package.json`, no application code. What exists is the product definition,
  the design brief, round-1 wireframes, and — as of today — the itqan install.
- **`docs/PRD.md`** — the full product spec. Two pillars: the **Board** (drift reconciliation,
  §6.1) and the **Overview** (portfolio view, §6.8). Build order in §10, five stages.
- **`docs/DESIGN-BRIEF.md`** — round 1 delivered; **Concept C "Feed + Roster"** chosen by the
  owner (node `V1YpOq` in `design/wireframes.pen`). Round 2 is briefed but not drafted: the
  Overview concepts, the week view, and two corrections to Concept C.
- **All product decisions are closed** — `docs/DECISIONS.md` D1–D13. The open questions that
  blocked building (claim parsing, cost basis, refresh model, scope) were answered by the owner
  2026-07-27. **Nothing is waiting on a decision right now.**
- **itqan installed today** (`chore/itqan-install`) — lite profile plus `docs/specs/` (D1). This
  had been *claimed* in the PRD on 2026-07-26 while no role file existed; see
  `docs/LEARNINGS.md`.
- **Branch model live** (D13): `feature → develop → main`. `main` and `develop` both exist on
  `github.com:Sob7i/agentic-os` and are level at the three doc commits.

## How to pick up

1. `git status && git log --oneline -5 && gh pr list` — verify this file against reality first.
2. Read `docs/PRD.md` §1 (the problem) and §10 (build order), then `docs/DECISIONS.md`.
3. There are **no runnable commands yet** — Stage 1 creates them. `CLAUDE.md` §Commands is a
   slot waiting on that, deliberately not filled with guesses.

## Next up

Ordered. Nothing here is blocked on a decision; item 1 is blocked only on being written.

1. **Write the Stage 1 spec** — `docs/specs/stage-1-reconciliation.spec.md`. The scope is fixed
   by PRD §10 Stage 1: collectors for git, `gh`, and itqan docs; drift checks D1–D8 (PRD §6.1);
   the Board rendering Concept C. Its acceptance test is already written and falsifiable — *it
   must independently rediscover nadim's HANDOFF drift and show itqan as green.* Mark it `☑`
   only when its own decisions are closed.
2. **Scaffold the app** — Next.js + TypeScript + SQLite (D3). Fill `CLAUDE.md` §Commands with
   commands **verified by running them**, not copied from a template.
3. **Build Stage 1** against the spec.
4. **Round-2 wireframes** (the Overview) — can proceed in parallel; it blocks the Stage 3 spec,
   not Stage 1.

**Later stages** (PRD §10): Stage 2 gated fix proposals · Stage 3 the Overview · Stage 4
transcripts and cost · Stage 5 folded into the Overview (D12) · Stage 6+ pain-gated.

## Blockers

None. Every decision needed to start Stage 1 is closed.

## Session log

- **2026-07-26** — PRD written (`docs/PRD.md`); design brief written; round-1 wireframes
  delivered by a design agent, Concept C chosen. Three commits direct to `main` (before D13).
- **2026-07-27** — Owner closed the open decisions (PRD D4–D11 → `docs/DECISIONS.md` D5–D12).
  itqan installed: lite + `docs/specs/`. Branch model adopted (D13); `develop` created. The
  PRD's false self-install claim corrected and logged as a lesson.
