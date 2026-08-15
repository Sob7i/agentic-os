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

### From the round-2 design review (2026-07-27)

- **`Fix Proposal v2` draws a claim that does not look like the real one** — it cites
  `docs/HANDOFF.md · line 24` as a tidy two-line snippet. Confirmed while building: the claim is
  on **line 15**, inside a ~600-character bullet, so the real card's diff is a wrapped paragraph
  rather than the mockup's neat line. The design's structure survives; its content was a
  reconstruction. Its dates also read `2026-07-26` where the review ran on `07-27`. Unblocked by:
  the next design pass — redraw the diff against the actual line.

### From the Stage 2 build (2026-07-27)

- **The approval flow has never been exercised end-to-end on a real repo.** AC-1…AC-11 prove it
  on fixture repos and all four UI states were rendered against live data, but no watched project
  has been corrected through the button — writing into another repo is an owner gate. Unblocked
  by: the owner approving nadim's `#22` → `#23` proposal once, and confirming the resulting
  working-tree change reads as expected.
- **`data/verified.json` has no pruning.** Acknowledgements expire logically (their key stops
  matching) but the rows stay in the file forever. Harmless at this size. Unblocked by: the file
  becoming large enough to notice, or a "show acknowledged" view wanting to list them.
- **Lesson insertion picks the first matching heading only.** `appendLesson` targets the first of
  `## Workflow` / `## Docs` / `## Process`; a file whose lesson belongs under a later, more
  specific heading gets it in the wrong section. Unblocked by: a watched project where this
  actually lands badly — the fallback (end of file) is already correct for files with no heading.
- **DC1 fires per claim, so a doc repeating its frontier twice offers two proposals.** Each is
  individually correct and the exactly-once guard refuses both (identical text, two occurrences),
  so nothing can be written — but the card shows two proposals that will each refuse. Unblocked
  by: seeing it happen; the refusal is safe, the UI is just noisy.

### Product / design

- **Propose structured claim markers upstream to itqan** — D5 chose prose heuristics so the tool
  delivers value without first editing five repos. If heuristics prove too noisy, the fix is a
  small itqan convention (dated header format, canonical PR-reference syntax) that makes
  reconciliation exact rather than heuristic — a framework proposal, not a local hack.
  Unblocked by: measured false-positive/false-negative rates from Stage 1 in real use.
- **Revisit whether Blocked deserves its own screen** — D12 folded the decision queue into the
  Overview's Blocked band. Unblocked by: the band proving too crowded in daily use.
- **Concept C shows each project twice (feed + roster)** — the concept's own rationale names
  this as its sacrifice. *Partly solved in the build:* rostered projects with a card above carry
  a left marker. Unblocked by: round-2 design, if it finds something better
  (`docs/DESIGN-BRIEF.md` §5.1.1b).

### From the Stage 1 build (2026-07-27)

- **AC-5 degrades both collectors instead of isolating `gh`** — the test strips `PATH`, which
  disables `git` too. It proves failures surface with readable reasons and no silent zeros, but
  does not prove a `gh`-only outage leaves git data intact. Was expected to land with Stage 2's
  fixture harness and did not: Stage 2's fixtures stub GitHub facts as data rather than stubbing
  the `gh` binary, so they gave the needed capability no push. Unblocked by: a stub `gh` earlier
  on `PATH` that exits non-zero — the harness in `scripts/verify-stage2.mts` now makes this cheap.
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
