# Agentic OS — CLAUDE.md

> **Read this first.** It is the router: where everything lives, how we work, what is never
> violated. Then read `docs/HANDOFF.md` for where things stand — and **verify it against git
> before acting on it as fact.**

**What this project is.** Two layers, one window.

- **Portfolio layer** — a local dashboard that continuously runs itqan's session-start ritual
  across all active projects and shows where state documents disagree with git/GitHub reality
  (the **Board**), plus a portfolio view of what's in flight, ready, blocked, and shipped (the
  **Overview**). Read-only, stores nothing, no egress beyond `gh`.
- **Execution layer** *(new, 2026-08-15, D18)* — per project and opt-in: an AgentOS that runs the
  work rather than watching it. Tasks, goals, inbox, sessions, costs; agents and templates as
  configuration. It runs agents locally in ephemeral git worktrees (D20).

**Why one product and not two:** an executor can spend five hours and real money on a goal drafted
from a twelve-day-stale document and trip none of its own safety rails — they all measure the loop,
never its premise. The portfolio layer is the check that catches exactly that, and it already
works. Full rationale: `docs/PRD.md` §12.1.

**Status: Stages 1, 2, 3, 3a and 3b are built.** The reconciliation Board runs; gated fix proposals
write on an explicit click; the execution layer dispatches work, pauses on a question, resumes, and
takes a human approval; the app shell carries the portfolio ribbon and the conditional drift band;
and **Stage 3b closed the loop** — an explicit *Initialize* button turns an `agentos.yml` into a
`Project` row (D30), agents and tasks are created through the UI, and one acceptance check drives
the whole cycle end to end. **Two acceptance criteria remain unmet and both are owner gates, not
build work:** Stage 2's (**one real drift corrected** — no proposal has ever been approved) and
Stage 3b's real-world half (**no human has run the cycle by hand**, because no watched repo has an
`agentos.yml` and creating one is a write into another repo — `docs/HUMAN-TEST.md` Part 7 has the
steps). **Stage 1's AC-2 is a known blocking item** — it hardcodes itqan as the green project,
itqan stopped committing, and DC7 correctly reports it stalled; the check is right and the fixture
rotted, and the fix needs a decision (`docs/BACKLOG.md`). *For whether the suite is currently green,
read `docs/HANDOFF.md` §Verified state — this file does not carry suite results.*

**Re-scoped 2026-08-15** to two layers (D18–D22) — `docs/PRD.md` §12. **Round-3 design closed
2026-08-18** — D23 (the shell), D24 (work is dispatched, never picked up), D25 (a DoD item carries
the kind of evidence that closed it) and D26 (the app shell splits out of Stage 3 as **Stage 3a**).
**Next build step: Stage 4** (templates and chains), then Stage 5 (goals) — both specced. Stage 4
sequences parts that have now all run at least once, which is exactly why 3b was inserted before it.
Behaviour today: `docs/FEATURES.md`; in plain language, `docs/HUMAN-TEST.md`.

**Counts, PR states and branch heads are
deliberately absent here** — they live in `docs/HANDOFF.md`'s *Verified state* block, once.

---

## Session ritual

**At session start:**

1. Read this file.
2. Read `docs/HANDOFF.md`.
3. **Verify it against reality before acting on anything in it as fact:**
   - `git status` / `git log --oneline -5` — does the tree and history match what the doc says?
   - `gh pr list` — are the PR states it claims still true?
   - Run the app if it is cheap to do so (once there is one).
4. **If you find staleness: fix the doc now**, in this session. Then decide which kind it was:
   - **Predicted** — a value the *Verified state* block exists to hold (a merged PR, a suite count,
     a branch head). Fix it and move on. **No lesson**; the mechanism already knows about this class
     and a fourth near-identical entry only dilutes `docs/LEARNINGS.md`.
   - **Asserted** — a doc claimed something that was already known to be false, or a new class of
     rot. **Add a dated line to `docs/LEARNINGS.md`.** That is the kind that costs the next session
     its judgement rather than a minute.
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
| `docs/HUMAN-TEST.md` | Walkthrough | What it does **in plain language**, with things to try by hand — for a human checking the system without reading code |
| `docs/BACKLOG.md` | — | Deferred work, with unblock conditions |
| git history | Record | What changed, when |
| `docs/PRD.md` | Product | The problem, the features, the build order |
| `docs/DESIGN-BRIEF.md` | Design | Portfolio layer (Board, Overview) — rounds 1–2 |
| `docs/DESIGN-BRIEF-EXECUTION.md` | Design | Execution layer + app shell — round 3 |
| `docs/specs/stage-3a-shell.spec.md` | Queue | The app shell — **built 2026-08-18** |
| `docs/specs/stage-3b-onboarding.spec.md` | Queue | The connector that makes Stage 3 reachable, plus agent and task creation — **built 2026-08-19 (D30)** |
| `docs/specs/stage-3b-tickets.md` | Queue | Stage 3b's four build tickets — sequencing, file ownership, hand-off contracts. **They stack; T2 branches off T1, not `develop`** |
| `docs/specs/stage-3c-board-and-rail.spec.md` | Queue | **Next to build** — drag-and-drop, the drawer, the SETUP rail group, the rail rebuilt to frame `B′2`. **`☐` — five decisions (D32–D36) and one owner merge gate it** |
| `docs/specs/stage-3c-tickets.md` | Queue | Stage 3c's four build tickets. **They stack; T2 off T1, T3 off T2, T4 off T3 — never off `develop`** |
| `docs/specs/AgentOS-spec.md` | Reference | Reconstructed source spec for the execution layer — **a reconstruction, not a contract** |
| `design/wireframes.pen` | Design | Round-1/2 wireframes (Pencil; plain JSON, readable directly) |
| `design/wireframes2.pen` | Design | **Round-3** wireframes — the shell, Tasks, Goals, Sessions, Inbox, plus six rationale notes. Shell closed as D23 |

**Paired docs** — these update in the same PR, never one without the other:
`docs/PRD.md` ⇄ `docs/DESIGN-BRIEF.md` **and** `docs/DESIGN-BRIEF-EXECUTION.md` (PRD §12 pairs
with the latter); any behaviour change ⇄ `docs/FEATURES.md`.

## Invariants (never violate)

These are the product's identity. A change that breaks one is a decision, not a refactor.

> **Scoped, not weakened (2026-08-15, D19).** Invariants 1, 4 and 5 hold **unchanged at the
> portfolio layer**. Inside a project that has opted into an execution layer (PRD §12) each is
> narrowed by a stated boundary — read D19 for the exact wording before assuming either the strict
> or the relaxed reading applies. **The layer boundary is the enforcement boundary**, and it must
> be real in code: the portfolio's data path may not read the execution layer's store.

1. **Local-only, no egress.** Session transcripts hold source code, keys, and business logic.
   Everything is parsed on-machine. The only network call is `gh` to GitHub's API. No
   telemetry, no cloud, ever. *(Execution layer: + the model API the runner calls, and the hosts a
   session's environment explicitly allow-lists. Nothing else — telemetry stays forbidden.)*
2. **Never assert without a check.** Every fact displayed carries what was checked and when.
   The dashboard obeys `verify-before-claim` about *itself*, not just about the projects it
   watches.
3. **Reality wins; a doc is a hypothesis.** Git/GitHub are ground truth. State docs are
   last-known claims. The UI never gives a claim the same weight as a verified fact.
4. **Read-only by default; writes are gated.** No file in another repo is modified without an
   explicit per-change approval click. No auto-fix, ever. *(Execution layer: agent sessions write
   in their granted repos; the gate moves from per-write to **per-session** — authorized once, at
   spawn, against a declared manifest of repos, paths and permissions.)*
5. **No second source of truth.** Every item shown traces to a file in a repo or to git. The
   dashboard stores no task, status, or plan of its own — that is the drift this product exists
   to prevent (D11). *(Execution layer, D19: **the portfolio stores no state; a project's execution
   layer may — and everything it stores carries a session id and a commit sha as evidence.** A
   status that cannot name the session that produced it is a claim, and must render as one.)*

## Commands

Every command below was **run**, not copied from a template. Next.js 15 + TypeScript; **no
database yet.** Two are planned and they are separate files on purpose: the execution layer's
record arrives with Stage 3 (`data/agentos.sqlite` — losing it loses evidence), and D3's transcript
cache arrives with Stage 7 (derived and disposable). *Corrected 2026-08-18: this line still said
"Stage 4's transcript index", which the D18 renumbering moved to Stage 7.*

| Command | Does |
|---|---|
| `pnpm install` | Install. |
| `pnpm dev` | The Board at `localhost:3000` (falls back to `:3001` if the port is taken). |
| `pnpm verify` | **Every** acceptance suite, via [`scripts/verify-all.mts`](scripts/verify-all.mts). Runs all of them, prints a summary, and exits non-zero if **any** failed; it does **not** stop at the first red one (`docs/LEARNINGS.md`). A flag, not a sum of exit codes — status is mod 256, so summing can land on 0 and report a false green. Counts: `HANDOFF.md` §Verified state. |
| `pnpm verify:stage1` | Stage 1 only. Runs against the **real** watched repos, read-only. |
| `pnpm verify:stage2` | Stage 2 only. Runs against **generated fixture repos in a temp dir** — never a watched project. |
| `pnpm verify:stage3` | Stage 3 (the execution layer) only. Fixture-based; **AC-12 calls a real model and is opt-in**, skipped unless `AGENTOS_REAL_SESSION=1`. |
| `pnpm verify:stage3a` | Stage 3a (the shell) only. Pure-function fixtures, plus the Stage 1/2 suites re-run as a regression oracle. |
| `pnpm verify:stage3b` | Stage 3b (initialize, agents, tasks) only. Fixture repos in a temp dir; the model is never called. |
| `pnpm type-check` | `tsc --noEmit`. |
| `pnpm build` | Production build. |

If `pnpm build` fails on a missing `pages-manifest.json`, the cause is a stale cache:
`chmod -R u+w .next && rm -rf .next`.

## Conventions

- **TypeScript**, Next.js App Router. Collectors are server-side under `lib/collectors/`;
  the write path is `lib/fix/`; the shell's logic is pure functions in `lib/shell/`.
- **Every surface reads the Board through `boardOnce`** (`lib/reconcile/cached.ts`), never
  `buildBoard` directly — one collector run per request, so the ribbon and the Board cannot
  disagree (D23). `verify:stage3a` AC-3 asserts it structurally.
- **Shell logic is pure; shell components are dumb.** Anything that could be *wrong* belongs in
  `lib/shell/model.ts` where the suite can assert it without rendering a route.
- **New surfaces use CSS Modules**; `app/board.css` stays global and untouched. Both read the
  tokens in `app/globals.css`, which is where the shared vocabulary lives.
- **In JSX, interpolate complete strings.** Never let a line break fall between literal text and
  an expression continuing the same word — JSX collapses the newline to a space, and
  `write {n} file\n{n === 1 ? "" : "s"}` renders as *"2 file s"*. This has shipped twice
  (`docs/LEARNINGS.md`); use a ternary returning whole phrases.
- **Docs are prose, not bullets-only** — these files are read by models under time pressure;
  state the reason inline so it survives out of context.
- **Volatile facts live in exactly one place: `docs/HANDOFF.md`'s *Verified state* block.** Open PR
  numbers and their states, branch heads, suite pass counts, live board severities — every one of
  these rots on someone else's schedule, and every one has already gone stale here at least once.
  **No other document may restate them**; link to the block instead. A doc that needs a fact it
  cannot link to should name the command that produces it (`gh pr list`) rather than the answer.
  This is `docs/LEARNINGS.md`'s *"compute them or omit them"* rule, promoted to a convention after
  it was applied one bullet at a time and kept missing instances.
  **One exception, and it must be marked:** a **decision record may cite what was true when the
  decision was taken** — that is evidence, and deleting it would leave the reasoning unsupportable.
  Write it as history and say when it was measured (*"last committed 2026-07-26, as measured
  2026-08-18, when this was decided"*), and name the command that recomputes it. A dated
  measurement inside a closed decision is a fact about the past and does not rot; the same string
  in a spec's present tense does.
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
- **Two branches that will both touch the hub docs should be stacked, not parallel.**
  `docs/HANDOFF.md`, `docs/LEARNINGS.md`, `docs/BACKLOG.md` and `docs/DECISIONS.md` are appended to
  at fixed anchor points, so two branches off the same base collide there **by construction** —
  and the collision is spurious every time, because the answer is always "keep both". Branch the
  second stage off the first, or expect to resolve four union conflicts per merge. **The tell that
  a conflict is spurious is that every hunk resolves to a union**; if you are choosing between two
  versions, that one is real and deserves attention.
- **Never provision a sub-agent worktree from the default base — create it by hand from
  `develop`.** Isolated worktrees branch from **`origin/main`**, and this workflow deliberately
  leaves `main` behind `develop` (only the owner merges into it). Four agents in a row therefore
  started at a commit predating the entire build. Run `git worktree add -b <branch> <path>
  origin/develop`, `pnpm install` in it, and hand the agent the path. **Give every agent brief a
  base check** — the expected sha *and* a cheap structural one (`ls lib/agentos/`), because a
  missing directory is a faster tell than a hash comparison, and the check is the only thing that
  turns a silent wrong build into a two-minute correction.
- **Never add a suite to a hand-maintained list.** `pnpm verify` discovers its suites from the
  `verify:*` keys in `package.json` ([`scripts/verify-all.mts`](scripts/verify-all.mts)) precisely
  so that adding a stage is an insert, not an edit to a line another branch also edited.

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
