# Agentic OS — Feature Map

> **What the system does *today*** — not what it is planned to do. Read this before building
> anything, to answer "does it already do X?" Write to it after building, in the same PR as the
> code. Planned behaviour lives in `docs/PRD.md`; it does not belong here until it runs.

**Status as of 2026-07-27: the system does nothing yet. There is no application code.**

That is the honest state of the behaviour map, and it is deliberately not padded with planned
rows. Every row below would be a claim, and this file's entire purpose is to hold only claims
that have been verified by running the thing.

## How to read a row

| Column | Means |
|---|---|
| **Behaviour** | One user-observable capability, stated as what the system does |
| **Expected outcome** | What an observer sees when it works |
| **Verify** | The cheapest way to confirm it right now — a command, a route + action, or a test id |
| **Since** | The version or commit where this behaviour became true |

## Surfaces

### The Board

*No behaviours yet.* Planned: PRD §6.1 (reconciliation board) and §6.2 (gated fix proposals).
First behaviours land with Stage 1 (`docs/PRD.md` §10).

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| — | — | — | — |

### The Overview

*No behaviours yet.* Planned: PRD §6.8. Design not yet drafted (round-2 brief written,
wireframes pending — see `docs/BACKLOG.md`).

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| — | — | — | — |

### Usage & cost

*No behaviours yet.* Planned: PRD §6.3, Stage 4.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| — | — | — | — |

## Invariants in force

These hold for every behaviour added below, and a change that breaks one is a decision, not a
refactor. Stated in full in `CLAUDE.md` §Invariants.

1. Local-only, no egress (except `gh` to GitHub).
2. Never assert without a check — every displayed fact carries what was checked, and when.
3. Reality wins; a document is a hypothesis.
4. Read-only toward watched repos by default; every write is individually gated.
5. No second source of truth — every item traces to a file in a repo or to git.

## Deliberately not supported

- **Task creation, assignment, due dates, effort estimates, status toggles** — the Overview is
  read-only by decision (D11). Anything editable becomes a second source of truth that can
  drift, which is the failure this product exists to catch.
- **Sprints, burndowns, velocity, story points** — the system being watched is gate-driven, not
  time-boxed. These metrics would be fabricated (`docs/PRD.md` §6.8.3).
- **Auto-fixing drift** — corrections are proposed as a diff and require an approval click
  (PRD §6.2).
- **Auto-discovery of projects** — the watched set is explicit (D9).
- **Cloud sync, telemetry, accounts, team/multi-user views** — local-only, one user.

## Known gaps in this map

- **The map is empty because the system is empty.** This is verified, not assumed: the repo
  contains `CLAUDE.md`, `docs/`, `design/`, `mcp.json`, and `.gitignore` — no `package.json`,
  no application code.
- No `Verify` steps exist yet because there is nothing to run. The first spec (Stage 1) must
  define its verification steps as part of being decision-closed, so that the rows added with
  it arrive verifiable rather than retrofitted.
