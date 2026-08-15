# Agentic OS — Feature Map

> **What the system does *today*** — not what it is planned to do. Read this before building
> anything, to answer "does it already do X?" Write to it after building, in the same PR as the
> code. Planned behaviour lives in `docs/PRD.md`; it does not belong here until it runs.

**Status as of 2026-07-27: Stages 1 and 2 run** — the reconciliation Board, and gated fix
proposals that write into a watched repo only on an explicit per-proposal click. Every row below
was verified by running it, not by reading the code. The `Verify` column is the command or action
that was actually executed.

**Run it:** `pnpm install && pnpm dev` → the Board. `pnpm verify` runs both acceptance suites
(8 checks for Stage 1, 11 for Stage 2); `pnpm verify:stage2` runs Stage 2's alone.

## How to read a row

| Column | Means |
|---|---|
| **Behaviour** | One user-observable capability, stated as what the system does |
| **Expected outcome** | What an observer sees when it works |
| **Verify** | The cheapest way to confirm it right now — a command, a route + action, or a test id |
| **Since** | The version or commit where this behaviour became true |

## Surfaces

### The Board (`/`)

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Lists every configured project | 6 rows, matching `projects.config.ts`; none auto-discovered | `pnpm verify` → AC-7 | Stage 1 |
| Reports verified git facts | Branch, dirty count, last-commit age match `git` in that repo | Compare a row to `git -C <repo> status` | Stage 1 |
| Reports open PR state | Open PR numbers match `gh pr list` | Compare to `gh pr list` in that repo | Stage 1 |
| Detects a stale PR claim (DC1) | nadim: claim `"PRs #1 through #22 merged"` shown beside `#23 merged; open #24` | `pnpm verify` → AC-1 | Stage 1 |
| Separates claim from fact visually | "Claimed" in quoted italic sans; "Verified" in mono with a green rule | Load `/`, read the drift card | Stage 1 |
| Shows in-sync projects as a result | A project with no findings renders `✓ in sync` with a check timestamp — **not** a blank row | `pnpm verify` → AC-2 *(currently failing — see Known gaps)* | Stage 1 |
| Distinguishes "nothing to check" from "checked and fine" | Projects with no state doc render `◌ unverifiable`, not green | Load `/`; salla-apps, fractal-code, my-personal-website | Stage 1 |
| Shows role coverage incl. full-profile alternates | salla-apps: router+queue+lessons+record filled | `pnpm verify` → AC-3 | Stage 1 |
| Names the source of every claim | Drift card shows the repo-relative doc path | `pnpm verify` → AC-4 | Stage 1 |
| Shows check confidence | `DC1 · confidence 0.95`; sub-0.9 rendered in the attention colour | Load `/`, read the card footer | Stage 1 |
| Degrades visibly when `gh` is unavailable | PR cell reads "unavailable", never "0 open"; git data still shown | `pnpm verify` → AC-5 | Stage 1 |
| Survives an unreadable repo | That row degrades; the other five render | `pnpm verify` → AC-7 | Stage 1 |
| Sorts by severity | drift → attention → unverifiable → in-sync | Load `/`, read the roster order | Stage 1 |
| States its own freshness | Header shows project count and check time | Load `/`, read the header | Stage 1 |
| Renders in light and dark | Both use validated palettes; dark is designed, not inverted | Load `/` with each OS appearance | Stage 1 |

**Checks implemented:** DC1 PR-frontier mismatch · DC2 "Next up" already done · DC3 state doc
older than last commit · DC4 uncommitted work (threshold, D14) · DC5 branch ahead/behind ·
DC6 open PR aging without review · DC7 stalled project · DC8 role-coverage gaps.

### Fix proposals — the gate (on the drift card)

**This is the only part of the system that writes outside this repo.** It writes one line into
one document, unstaged, after one click, and never marks its own work done.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Proposes a correction for DC1 drift | nadim's card offers `#22` → `#23` in `docs/HANDOFF.md` | `pnpm verify:stage2` → AC-1 | Stage 2 |
| Shows the change in its **full line** | The whole line renders, old token struck in drift red, new in sync green | Load `/`, read the drift card | Stage 2 |
| Flags a date the edit cannot see | Amber: `"2026-07-13" now sits next to a fact re-verified today` | `pnpm verify:stage2` → AC-2 | Stage 2 |
| Writes nothing until approved | Building and rendering a proposal leaves the fixture byte-identical | `pnpm verify:stage2` → **AC-3** | Stage 2 |
| Writes exactly what it previewed | The file on disk equals the previewed content byte for byte | `pnpm verify:stage2` → AC-4 | Stage 2 |
| Appends a paired lesson in the same approval | One dated line in `LEARNINGS.md`, under an existing heading when one matches | `pnpm verify:stage2` → AC-5 | Stage 2 |
| Skips the lesson honestly | A project with no lessons file is told so; the file is never created | `pnpm verify:stage2` → AC-5 | Stage 2 |
| Refuses a stale proposal | File changed since the proposal was built → refused, both files untouched | `pnpm verify:stage2` → AC-6 | Stage 2 |
| Refuses all-or-nothing | A refusal on either file writes neither | `pnpm verify:stage2` → AC-6 | Stage 2 |
| Leaves the write unstaged | `git status --porcelain` shows the worktree-modified marker, nothing staged, HEAD unmoved | `pnpm verify:stage2` → AC-7 | Stage 2 |
| Confines writes to two files | Outside paths and traversal refused by confinement; in-project non-targets by the allow-list | `pnpm verify:stage2` → AC-10 | Stage 2 |
| Explains when there is no fix | DC2–DC8 show *why* — never a disabled button | `pnpm verify:stage2` → AC-8 | Stage 2 |
| Never marks the drift resolved | After writing: `⚠ drift → ✎ written → ⟳ re-check pending → ?` | Load `/?written=<hash>&project=<name>` | Stage 2 |
| Shows git's own porcelain after a write | The unstaged file list comes from `git status`, not from our record of what we did | Load `/` after approving | Stage 2 |
| Acknowledges a drift locally | "Leave as is" mutes the card; survives reload; expires when the claim changes | `pnpm verify:stage2` → AC-9 | Stage 2 |
| Reports a refusal in the UI | Banner: **Nothing was written.** + the verbatim reason | Load `/?error=…` | Stage 2 |

### The Overview

*Not built.* Planned: PRD §6.8, Stage 3. Round-2 wireframes not yet drafted.

### Usage & cost

*Not built.* Planned: PRD §6.3, Stage 4.

## Invariants in force

Stated in full in `CLAUDE.md` §Invariants.

1. Local-only, no egress (except `gh` to GitHub).
2. Never assert without a check — every displayed fact carries what was checked, and when.
3. Reality wins; a document is a hypothesis.
4. Read-only toward watched repos — **verified by AC-6**, which diffs every watched repo's
   working tree across a full reconciliation.
5. No second source of truth.

## Deliberately not supported

- **Unapproved writes of any kind.** Every write is one click on one proposal; there is no
  "fix all", no auto-apply, and no background write path.
- **Committing, staging, branching, or pushing in a watched repo.** The change lands as an
  unstaged working-tree edit and stops there. Undo is `git checkout -- <file>` — stated in the UI.
- **Model-generated corrections.** Deterministic string edits only (D15); the egress invariant
  forbids the alternative.
- **An in-app undo.** Tracking prior state would be a second source of truth (D11); git already
  has one.
- **A "reject" button.** The gate's second action acknowledges instead (D17).
- **Fixes for DC2–DC8.** None of them is a wrong string; each says so with a reason.
- **Task creation, assignment, due dates, status toggles** — D11.
- **Sprints, burndowns, velocity** — the watched system is gate-driven (PRD §6.8.3).
- **Auto-discovery of projects** — the watched set is explicit (D9).
- **Auto-refresh** — on load plus a manual refresh only (D8).
- **Proximity-matched claim extraction** — prohibited; it inverted meaning in testing
  (spec §3.2).
- Cloud sync, telemetry, accounts, multi-user views.

## Known gaps in this map

- **⚠ AC-2 currently fails, and the code is right.** The check asserts *"itqan renders `✓ in sync`"*
  **by name**; itqan has not committed since 2026-07-21, so DC7 correctly reports it stalled and the
  row is `○ attention`. The *behaviour* in the table above is intact — a finding-free project does
  render green — but the row's original wording named a live repo as its example, which made a
  behaviour claim rot when the world moved. **Reworded 2026-08-15** to state the behaviour and stop
  naming the specimen. Fixing the check itself amends a PRD acceptance criterion, so it is a
  decision, logged as blocking in `docs/BACKLOG.md`.

- **A corrected line can carry a stale date.** The substitution changes one integer inside the
  matched claim and cannot read the prose beside it, so `(verified 2026-07-13)` survives next to
  a fact re-verified today. **Accepted deliberately** (D15): the diff shows the full line and the
  UI flags the date in amber. This is the limitation the approval gate exists to catch, not a bug
  to be fixed by editing more.
- **Only DC1 has a fix, and only when the doc is *behind*.** A claim that is correct about merged
  PRs but silent about an open one produces no proposal — the missing sentence is authorship. The
  card says so.
- **The approval flow has not been exercised end-to-end on a real repo.** AC-1…AC-11 prove it on
  fixture repos, and the UI's four states were each rendered against live data, but no watched
  project has actually been corrected through the button. Writing into another repo is an owner
  gate → `docs/BACKLOG.md`.
- **Acknowledgements are keyed per claim, not per project.** Acknowledging one drift says nothing
  about the next; there is no "mute this project", by design.
- **DC2 has never fired on real data.** No watched project currently has a "Next up" line naming
  a merged PR, so its 0.6-confidence rendering is unexercised. Verified only by construction.
- **DC5 (ahead/behind) is unexercised** — no watched branch currently diverges from its upstream.
- **AC-5 degrades both collectors, not just `gh`.** The test strips `PATH`, which disables `git`
  too. It proves failures surface with readable reasons and no silent zeros, but does not isolate
  a `gh`-only outage. A narrower fixture belongs with Stage 2 → `docs/BACKLOG.md`.
