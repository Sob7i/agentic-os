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

**Status: Stages 1 and 2 are built** — the reconciliation Board runs and gated fix proposals write
on an explicit click. Stage 2's acceptance criterion (**one real drift corrected**) is still unmet:
no proposal has ever been approved, and that is an owner gate. **Stage 1's AC-2 is a known blocking
item** — it hardcodes itqan as the green project, itqan stopped committing, and DC7 correctly
reports it stalled; the check is right and the fixture rotted, and the fix needs a decision
(`docs/BACKLOG.md`). *For whether the suite is currently green, read `docs/HANDOFF.md` §Verified
state — this file does not carry suite results.* **Re-scoped 2026-08-15** to two layers (D18–D22) — `docs/PRD.md` §12.
**Round-3 design closed 2026-08-18** — D23 (the shell), D24 (work is dispatched, never picked up),
D25 (a DoD item carries the kind of evidence that closed it) and D26 (the app shell splits out of
Stage 3 as **Stage 3a** and is built first). Next build step: **Stage 3a, the shell** — ungated and
buildable now, because it is portfolio-layer work against Stage 1 data. Stage 3, the execution MVP,
follows and is gated on two owner decisions in its spec's §5.11 and §5.12; Stages 4 and 5 are
specced behind that. Behaviour today: `docs/FEATURES.md`. **Counts, PR states and branch heads are
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
| `docs/BACKLOG.md` | — | Deferred work, with unblock conditions |
| git history | Record | What changed, when |
| `docs/PRD.md` | Product | The problem, the features, the build order |
| `docs/DESIGN-BRIEF.md` | Design | Portfolio layer (Board, Overview) — rounds 1–2 |
| `docs/DESIGN-BRIEF-EXECUTION.md` | Design | Execution layer + app shell — round 3 |
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
| `pnpm verify` | **Both** acceptance suites, Stage 1 then Stage 2. Non-zero exit on any failure. Counts: `HANDOFF.md` §Verified state. |
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
