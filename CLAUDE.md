# Agentic OS — CLAUDE.md

> **Read this first.** It is the router: where everything lives, how we work, what is never
> violated. Then read `docs/HANDOFF.md` for where things stand — and **verify it against git
> before acting on it as fact.**

**What this project is.** A local dashboard that continuously runs itqan's session-start ritual
across all active projects and shows where state documents disagree with git/GitHub reality
(the **Board**), plus a portfolio view of what's in flight, ready, blocked, and shipped (the
**Overview**). Local-only, read-only, no egress. Full rationale: `docs/PRD.md`.

**Status: pre-code.** Decisions are closed; no application code exists yet. The next build step
is Stage 1 in `docs/PRD.md` §10.

---

## Session ritual

**At session start:**

1. Read this file.
2. Read `docs/HANDOFF.md`.
3. **Verify it against reality before acting on anything in it as fact:**
   - `git status` / `git log --oneline -5` — does the tree and history match what the doc says?
   - `gh pr list` — are the PR states it claims still true?
   - Run the app if it is cheap to do so (once there is one).
4. **If you find staleness: fix the doc now**, in this session, and add a dated line to
   `docs/LEARNINGS.md`. Staleness found is a lesson, not just a correction.
5. Only then start work.

**At session end** — in the *same commit/PR as the code*, never a separate "docs" commit:

- Update `docs/HANDOFF.md` (where things stand, next up).
- Add any lesson to `docs/LEARNINGS.md`.
- Add any deferred work to `docs/BACKLOG.md` as an entry — never as prose elsewhere.
- Update `docs/FEATURES.md` if observable behaviour changed.
- Record any decision made in `docs/DECISIONS.md`.

## Doc map (where knowledge lives)

| File | Role | Answers |
|---|---|---|
| `CLAUDE.md` (this) | Router | Where is everything, how do we work |
| `docs/HANDOFF.md` | State | Where are we, what's next |
| `docs/specs/*.spec.md` | Queue | What's decision-closed and ready to build |
| `docs/DECISIONS.md` | Decisions | Why we chose X — don't re-litigate |
| `docs/LEARNINGS.md` | Lessons | What we must not re-buy |
| `docs/FEATURES.md` | Behaviour | What the system does **today** |
| `docs/BACKLOG.md` | — | Deferred work, with unblock conditions |
| git history | Record | What changed, when |
| `docs/PRD.md` | Product | The problem, the features, the build order |
| `docs/DESIGN-BRIEF.md` | Design | Wireframe brief; paired with PRD |
| `design/wireframes.pen` | Design | Round-1 wireframes (Pencil; plain JSON, readable directly) |

**Paired docs** — these update in the same PR, never one without the other:
`docs/PRD.md` ⇄ `docs/DESIGN-BRIEF.md`; any behaviour change ⇄ `docs/FEATURES.md`.

## Invariants (never violate)

These are the product's identity. A change that breaks one is a decision, not a refactor.

1. **Local-only, no egress.** Session transcripts hold source code, keys, and business logic.
   Everything is parsed on-machine. The only network call is `gh` to GitHub's API. No
   telemetry, no cloud, ever.
2. **Never assert without a check.** Every fact displayed carries what was checked and when.
   The dashboard obeys `verify-before-claim` about *itself*, not just about the projects it
   watches.
3. **Reality wins; a doc is a hypothesis.** Git/GitHub are ground truth. State docs are
   last-known claims. The UI never gives a claim the same weight as a verified fact.
4. **Read-only by default; writes are gated.** No file in another repo is modified without an
   explicit per-change approval click. No auto-fix, ever.
5. **No second source of truth.** Every item shown traces to a file in a repo or to git. The
   dashboard stores no task, status, or plan of its own — that is the drift this product exists
   to prevent (D11).

## Commands

Every command below was **run**, not copied from a template. Next.js 15 + TypeScript; no database
yet (D3 plans SQLite for Stage 4's transcript index — nothing needs it before then).

| Command | Does |
|---|---|
| `pnpm install` | Install. |
| `pnpm dev` | The Board at `localhost:3000` (falls back to `:3001` if the port is taken). |
| `pnpm verify` | **Both** acceptance suites — 8 Stage 1 checks, 11 Stage 2. Non-zero exit on any failure. |
| `pnpm verify:stage1` | Stage 1 only. Runs against the **real** watched repos, read-only. |
| `pnpm verify:stage2` | Stage 2 only. Runs against **generated fixture repos in a temp dir** — never a watched project. |
| `pnpm type-check` | `tsc --noEmit`. |
| `pnpm build` | Production build. |

If `pnpm build` fails on a missing `pages-manifest.json`, the cause is a stale cache:
`chmod -R u+w .next && rm -rf .next`.

## Conventions

- **TypeScript**, Next.js App Router. Collectors are server-side under `lib/collectors/`;
  the write path is `lib/fix/`.
- **In JSX, interpolate complete strings.** Never let a line break fall between literal text and
  an expression continuing the same word — JSX collapses the newline to a space, and
  `write {n} file\n{n === 1 ? "" : "s"}` renders as *"2 file s"*. This has shipped twice
  (`docs/LEARNINGS.md`); use a ternary returning whole phrases.
- **Docs are prose, not bullets-only** — these files are read by models under time pressure;
  state the reason inline so it survives out of context.
- Dates are absolute (`2026-07-27`), never "yesterday" or "last week".
- Prefer markdown links (`[file.ts](lib/file.ts)`) in docs.

## Git & PR workflow

```
feature branch ──PR (agent opens)──▶ develop ──(owner merges)──▶ main
```

- **The agent never merges.** Not its own PR, not any PR. The agent's output is a PR; that is
  where its authority ends. If a merge is blocked, that is the gate working — report and stop.
- **All PRs target `develop`.** Feature branches never target `main`.
- **`main` receives only `develop`, only from the owner.**
- **Never open a PR from `develop` or `main`** — work always goes on a feature branch.
- Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- **Never tag or bump a version without explicit owner approval.**

## Standing rules

Mined by itqan; pruned to what applies here.

- **verify-before-claim** — never state something is true, working, or unchanged without
  running the check that would falsify it. This project's entire premise.
- **retest-after-change** — a code change invalidates earlier test results. Re-run; don't cite
  a prior pass.
- **deferred-work-goes-to-backlog** — the moment you decide "not now", write the
  `docs/BACKLOG.md` entry in the same change. Never leave it as prose in a handoff or PR body.
- **paired-docs-update-together** — a doc and the thing it describes change in one PR.
- **confirm-ambiguous-referent** — if you notice yourself picking one of two plausible
  readings, ask instead.
- **external-API-fields-are-guilty-until-verified** — never assume a field from an external
  API (or another project's document format) means what it appears to. Capture a real payload
  first. Applies directly to parsing spec `status:` lines and transcript JSONL.
- **no-op runs report as no-op** — "nothing needed changing" is a valid, honest result. Never
  manufacture a change to look productive.

## Working style / guardrails

- **Human gates:** merging, tagging, and any write into another repo. All owner-only.
- **Delegation:** the lead validates; sub-agents execute. Sub-agent output is reviewed against
  the spec before it becomes a PR.
- **Page only on BLOCKED** — not on progress.
- When a spec exists for the work, build only what it closes. If a decision surfaces mid-build,
  stop and close it in `docs/DECISIONS.md` first — that is the whole point of the gate.

## Memory

Project-level lessons live in `docs/LEARNINGS.md` (durable, dated, prunable). Personal/global
preferences live in Claude's own memory and are not duplicated here.
