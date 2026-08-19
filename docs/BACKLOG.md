# Agentic OS — Backlog

Deferred work lands here as an entry — not as a paragraph in `docs/HANDOFF.md`, a PR
description, or a session log. If it's worth doing later, it's worth a line here; if it isn't
worth a line here, it wasn't worth deferring — say so and drop it.

This is not the roadmap. Planned scope lives in `docs/PRD.md` §10 (build order) and, once
decision-closed, in `docs/specs/`. BACKLOG is for one-off deferred items: cleanups, follow-ups,
and things explicitly punted with a reason.

## Open

- **`lib/tasks/data.ts` loads the Tasks board with N+1 queries** *(added 2026-08-19)*. Events are
  fetched per task, and tool calls, commit shas and inbox messages per session. Correct, and fine
  against the fixture-sized databases everything is currently tested on — but it grows linearly with
  a project's history, and the board is the page someone leaves open. Raised in review of #17 and
  **deliberately not fixed there**: the honest fix is a handful of grouped queries, and doing it
  before any real project has accumulated a single session would be optimising against a guess.
  **Unblock condition:** the first project with enough real tasks and sessions to measure — at which
  point measure first, then batch the three per-session loads.

- **Nothing connects an `agentos.yml` on disk to a `Project` row in `data/agentos.sqlite`** —
  resolved 2026-08-19 by Stage 3b T1–T4. T1 built the connector (an explicit *Initialize* button,
  D30); T2/T3 built agent and task creation behind it; T4's **AC-9** proves the whole cycle —
  dispatch → pause → resume → review → approve — runs end to end against fixtures. Still open:
  **no human has run it on a real project** (`docs/HUMAN-TEST.md` Part 7, added by T4) — that
  remains an owner gate, not a code gap, and is tracked in `docs/HANDOFF.md`'s *Next up* rather
  than here.
- **`runBootSweep` has no call site** — resolved 2026-08-19 by T7. `instrumentation.ts` calls it
  once per server process, passing `dispatch.ts`'s own `PROCESS_BOOT_ID`. Verified against a real
  boot rather than a fixture: with a stale `running` session seeded, starting the server logs
  `[agentos] boot sweep: interrupted 1 session(s) …` and the row reads `interrupted` afterwards.
- **T6's AC-6 must cover resuming a session whose teardown failed** — resolved 2026-08-19 by T6.
  AC-6 drives both the clean pause and the case where `worktreePath` is non-null, proving
  `resumeSession` clears the stale worktree before `createWorktree` reuses the same
  session-id-derived path.

- **Install itqan into this project** — done 2026-07-27, `chore/itqan-install`. Had been
  *claimed* as complete in `docs/PRD.md` on 2026-07-26 while no role file existed; see
  `docs/LEARNINGS.md`.
- **Fix the fabricated salla-apps drift card** — resolved 2026-07-27 in code rather than in the
  wireframe: salla-apps renders `◌ unverifiable` (no state doc → no claim → no possible
  claim-vs-fact drift). The `.pen` file still carries the fabricated card as round-1 record.
- **Decide what a Router-only project looks like on the Board** — resolved 2026-07-27 by the
  fourth severity level, `◌ unverifiable` (spec §3.4). Distinct from both in-sync and drift.
- **Round-2 wireframes** — delivered and reviewed 2026-07-27 (`design/wireframes.pen`): Overview
  A and B in both schemes, Board Quiet Day, and three fix-proposal states. Direction closed as
  D16. The Stage 3 spec is no longer blocked.
- **Rename or archive the superseded `Fix Proposal` frame** — done 2026-07-27, alongside the
  Stage 2 build: renamed to `SUPERSEDED (round 1) — Fix Proposal · violates D15, do not build`,
  so the warning is visible where someone reaches for it rather than only in a rationale note.
- **Stray `untitled.pen` (1 MB) at the repo root** — gone as of 2026-07-27; the file is no longer
  on disk. No gitignore rule was added, so a future autosave would reappear as untracked.
- **"Mark verified" / `data/verified.json`** — built 2026-07-27 as Stage 2's "Leave as is"
  control (AC-9). Keyed by claim hash, so acknowledgements expire by construction rather than by
  expiry logic. The gate's second button acknowledges rather than rejects — D17.
