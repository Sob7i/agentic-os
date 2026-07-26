# Agentic OS — Backlog

Deferred work lands here as an entry — not as a paragraph in `docs/HANDOFF.md`, a PR
description, or a session log. If it's worth doing later, it's worth a line here; if it isn't
worth a line here, it wasn't worth deferring — say so and drop it.

This is not the roadmap. Planned scope lives in `docs/PRD.md` §10 (build order) and, once
decision-closed, in `docs/specs/`. BACKLOG is for one-off deferred items: cleanups, follow-ups,
and things explicitly punted with a reason.

## Open

### From the itqan install (2026-07-27)

- **CHANGELOG.md + release ritual** — deferred at install (interview Q2/Q6): no versions, no
  production users, nothing promoted. Unblocked by: the first tagged release or an external
  user. See `docs/DECISIONS.md` D1.
- **SPEC-CONTRACT §5–§7 gate template** — deferred at install (Q3): no feature has been rebuilt
  because a decision surfaced mid-build, and with zero code there is no churn to mine findings
  from. Specs stay plain decision-closed documents until then. Unblocked by: the first time a
  feature *is* rebuilt for that reason — mine `git log` for the rewritten files and the root
  cause. See D1.
- **Split `docs/LEARNINGS.md` into MISTAKES + KNOWLEDGE** — lite merges them. Unblocked by: the
  file passing ~40 lines, or lessons becoming hard to find (itqan SPEC §4 graduation trigger).
- **Graduate to COMPASS + per-track handoffs** — lite uses a single `HANDOFF.md`. Unblocked by:
  a second genuinely parallel track of work appearing.

### Product / design

- **Propose structured claim markers upstream to itqan** — D5 chose prose heuristics so the tool
  delivers value without first editing five repos. If heuristics prove too noisy, the fix is a
  small itqan convention (dated header format, canonical PR-reference syntax) that makes
  reconciliation exact rather than heuristic — a framework proposal, not a local hack.
  Unblocked by: measured false-positive/false-negative rates from Stage 1 in real use.
- **Revisit whether Blocked deserves its own screen** — D12 folded the decision queue into the
  Overview's Blocked band. Unblocked by: the band proving too crowded in daily use.
- **Round-2 wireframes** — brief written and re-scoped 2026-07-27 (`docs/DESIGN-BRIEF.md` §8):
  the Overview, the week view, and the fix-proposal gate. Concepts not yet drafted. Unblocked
  by: a design agent run. **Blocks the Stage 3 spec only** — Stage 2 can build against §5.2.1.
- **Concept C shows each project twice (feed + roster)** — the concept's own rationale names
  this as its sacrifice. *Partly solved in the build:* rostered projects with a card above carry
  a left marker. Unblocked by: round-2 design, if it finds something better
  (`docs/DESIGN-BRIEF.md` §5.1.1b).

### From the Stage 1 build (2026-07-27)

- **"Mark verified" / `data/verified.json` is specified but not implemented** — the Board shows
  drift state but has no acknowledge control. Deferred because the write path and its approval
  gate are the same problem, and that problem is Stage 2. **Now scoped**: it is Stage 2's §1.5
  and AC-9 (`docs/specs/stage-2-fix-proposals.spec.md`). Unblocked by: building Stage 2.
- **AC-5 degrades both collectors instead of isolating `gh`** — the test strips `PATH`, which
  disables `git` too. It proves failures surface with readable reasons and no silent zeros, but
  does not prove a `gh`-only outage leaves git data intact. Unblocked by: a narrower fixture
  (a stub `gh` on `PATH` that exits non-zero), worth building alongside Stage 2's tests.
- **DC2 and DC5 have never fired on real data** — no watched project currently has a "Next up"
  line naming a merged PR, nor a branch diverging from its upstream. Both are verified by
  construction only. Unblocked by: real instances appearing, or a synthetic fixture repo.
- **Multiple lockfiles warning from Next.js** — `~/Documents/sl/` has a sibling lockfile, so Next
  warns about the inferred workspace root. Harmless. Unblocked by: setting
  `outputFileTracingRoot` in `next.config.mjs` if it ever affects a build.

### Engineering, once code exists

- **Borrow cost math from ccusage rather than hand-rolling it** — pricing tables and 5-hour
  block accounting are the part most likely to be subtly wrong. Unblocked by: Stage 4 (cost).
  See `docs/PRD.md` §5.
- **Incremental transcript parsing** — 170 MB across 137 JSONL files cannot be re-parsed per
  request; needs `(file, byte-offset, mtime)` tracking into SQLite. Unblocked by: Stage 4.
- **Behaviour-map drift check (D-check on `FEATURES.md`)** — compare each project's behaviour
  map against merged PRs touching app code. Unblocked by: any watched project actually having a
  `FEATURES.md`; today **none do** except this one.

## Done / superseded

<!-- Move items here when resolved (with the resolution) or dropped (with why), rather than
     deleting them. -->

- **Install itqan into this project** — done 2026-07-27, `chore/itqan-install`. Had been
  *claimed* as complete in `docs/PRD.md` on 2026-07-26 while no role file existed; see
  `docs/LEARNINGS.md`.
- **Fix the fabricated salla-apps drift card** — resolved 2026-07-27 in code rather than in the
  wireframe: salla-apps renders `◌ unverifiable` (no state doc → no claim → no possible
  claim-vs-fact drift). The `.pen` file still carries the fabricated card as round-1 record.
- **Decide what a Router-only project looks like on the Board** — resolved 2026-07-27 by the
  fourth severity level, `◌ unverifiable` (spec §3.4). Distinct from both in-sync and drift.
