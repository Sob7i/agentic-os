# Agentic OS — Feature Map

> **What the system does *today*** — not what it is planned to do. Read this before building
> anything, to answer "does it already do X?" Write to it after building, in the same PR as the
> code. Planned behaviour lives in `docs/PRD.md`; it does not belong here until it runs.

**Status as of 2026-07-27: Stage 1 (the reconciliation Board) runs.** Every row below was
verified by running it, not by reading the code. The `Verify` column is the command or action
that was actually executed.

**Run it:** `pnpm install && pnpm dev` → the Board. `pnpm verify` runs the acceptance suite.

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
| Shows in-sync projects as a result | itqan renders `✓ in sync` with a check timestamp | `pnpm verify` → AC-2 | Stage 1 |
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

- **Writing to a watched repo.** Stage 1 is strictly read-only; gated fix proposals are Stage 2.
- **Task creation, assignment, due dates, status toggles** — D11.
- **Sprints, burndowns, velocity** — the watched system is gate-driven (PRD §6.8.3).
- **Auto-discovery of projects** — the watched set is explicit (D9).
- **Auto-refresh** — on load plus a manual refresh only (D8).
- **Proximity-matched claim extraction** — prohibited; it inverted meaning in testing
  (spec §3.2).
- Cloud sync, telemetry, accounts, multi-user views.

## Known gaps in this map

- **`data/verified.json` ("mark verified") is specified but not implemented.** The Board has no
  acknowledge action yet; the drift card's footer shows state, not controls. Deferred to Stage 2,
  where the write path and its gate are built together → `docs/BACKLOG.md`.
- **DC2 has never fired on real data.** No watched project currently has a "Next up" line naming
  a merged PR, so its 0.6-confidence rendering is unexercised. Verified only by construction.
- **DC5 (ahead/behind) is unexercised** — no watched branch currently diverges from its upstream.
- **AC-5 degrades both collectors, not just `gh`.** The test strips `PATH`, which disables `git`
  too. It proves failures surface with readable reasons and no silent zeros, but does not isolate
  a `gh`-only outage. A narrower fixture belongs with Stage 2 → `docs/BACKLOG.md`.
