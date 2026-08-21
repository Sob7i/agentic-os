# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated **2026-08-18**
> (round-3 design closed; Stages 3a/4/5 specced; **Stage 3a built**).
> Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is only "where we
> are and what's next."
>
> **Trust but verify:** this file can go stale between sessions — merged PRs, pushed commits, or
> a changed remote don't announce themselves here. Cross-check `git status`, `git log`, and
> `gh pr list` before acting on anything below as fact. *This project exists because that
> failure is real; do not be its next example.* **You can now also just run the app** — it
> checks this project too.

## Verified state

> **The volatile facts live only here, and every one of them rots.** Each row names the command
> that reproduces it, so nothing below has to be believed. **Nothing else in this file, in
> `CLAUDE.md`, or in any spec may restate these values** — link to this block instead. That rule
> exists because "PR #6 is open" survived in three places across two files for three days after #6
> merged; one place to update is one place to check.
>
> **Two rows deliberately hold no value.** *Live board severities* was the original instance of the
> compute-or-omit rule. *Open PRs* joined it after a reviewer pointed out that **this file ships
> inside a pull request** — so any value it states is falsified by the act of stating it, and
> "none" was already wrong by the time the PR recording it existed. A fact that its own recording
> changes cannot be recorded; it can only be reproduced.
>
> **Checked 2026-08-19 (on `feat/stage-3b-t4-cycle`, after Stage 3b T4).** The suite counts
> below were measured on that branch, not on `develop` — it is the branch this file ships in, and a
> count measured somewhere else would be a claim about code nobody ran. If today is much later than
> that, this table is a hypothesis. **Correction while landing T4:** the previous check-in of this
> block read `pnpm verify:stage3b` as *13 of 13* and `pnpm verify` as *72 of 73* — both were already
> wrong the day they were written. T3 had actually landed **fourteen** stage3b checks (T1's five,
> T2's five, T3's four — AC-6, AC-6b, AC-7, AC-7b — is four, not three), so the true prior total was
> *74 of 75*. A predicted value the *Verified state* block exists to hold, fixed here in passing —
> not a lesson, the mechanism already knows about this class (`CLAUDE.md`'s session ritual).

| Fact | When checked | Reproduce with |
|---|---|---|
| `develop` head | `8643ef7` | `git log --oneline -1 origin/develop` |
| Open PRs | **not recorded — run the command** | `gh pr list` |
| Last merged | #16, #17 (2026-08-19), #18 (2026-08-19) | `gh pr list --state merged --limit 5` |
| `pnpm verify` | **77 of 78** — measured 2026-08-19 on the T4 branch, after the #19–#24 review fixes | `pnpm verify` |
| — the one failure | Stage 1 **AC-2** | see "Where things stand" for why it is not a bug |
| `pnpm verify:stage1` | 7 of 8 | `pnpm verify:stage1` |
| `pnpm verify:stage2` | 11 of 11 | `pnpm verify:stage2` |
| `pnpm verify:stage3` | 33 of 33 — AC-1…AC-19 plus T7-1…T7-4; AC-12 opt-in (skipped by default) | `pnpm verify:stage3` |
| `pnpm verify:stage3a` | 8 of 8 | `pnpm verify:stage3a` |
| `pnpm verify:stage3b` | 18 of 18 — T1's five + AC-2c/AC-2d, T2's five + AC-4b, T3's four, T4's **AC-9** (the four added in PR review) | `pnpm verify:stage3b` |
| runner smoke | 4 of 4, **not in `verify`** | `pnpm tsx lib/agentos/runner/runner.smoke.mts` |
| nadim's drift | **uncorrected** (AC-1 still passes) | `pnpm verify:stage1` |
| Live board severities | **not recorded, by rule** | `pnpm dev` |

## Where things stand

- **⚠ The product was re-scoped on 2026-08-15 — read `docs/PRD.md` §12 before planning anything.**
  Agentic OS is now **two layers**: the portfolio (Board + Overview, read-only, what exists today)
  and a new per-project, opt-in **execution layer** adapted from
  [`docs/specs/AgentOS-spec.md`](specs/AgentOS-spec.md) — tasks, goals, inbox, sessions, costs,
  with agents and templates as configuration. Decisions D18–D22 are closed; the build order in
  PRD §10 was renumbered and old Stage 3 (Overview) moved to Stage 6. *(This said "Nothing of it is
  built" until 2026-08-18 — an asserted staleness, corrected while landing T4: Stage 3a ships and
  Stage 3's tickets T1–T4 are in.)*
- **Stage 2 is merged; its acceptance criterion is still unmet.** The code and the re-scope docs
  are in. But Stage 2's own criterion — *one real drift corrected through the dashboard* — **has
  never been met**: nadim's HANDOFF still claims *"PRs #1 through #22 merged"* and no proposal has
  ever been approved. That is an owner gate, and merging the PR did not clear it. (State: the
  Verified state block above.)
- **Round-3 design is delivered and the shell is closed.** [`design/wireframes2.pen`](../design/wireframes2.pen)
  holds 19 frames and six rationale notes. **D23** picks **Concept B′** (mode switch + a persistent
  portfolio ribbon + a drift band that appears only when *this* project has drifted) over the design
  agent's own recommendation of Concept C, and says why. **D24** closes the execution motor: work is
  **dispatched, never picked up**. The Stage 3 spec gained **§7 (the motor)** and **§8 (the Tasks
  surface)**, plus AC-14…AC-19 and decisions 13–18.
- **⚠ Stage 1's AC-2 is a known blocking item, and the code is right.** It asserts *"itqan is
  green"* **by name**; itqan stopped committing, so DC7 correctly reports it stalled and the check
  fails. The test hardcoded a time-dependent fact about a live repo. **Fixing it amends a PRD
  acceptance criterion**, so it is logged in `docs/BACKLOG.md` with two readings and a
  recommendation rather than edited silently. It will keep failing until that decision is made —
  **the current suite result is in the Verified state block, not here.**
- **Stage 2 ships: the gate is live.** The Board now offers a correction on DC1 drift and writes
  it only on an explicit click. `pnpm verify` runs **both** suites. Stage 2's tests run entirely
  against generated fixture repos in a temp dir; no watched project is written to by a test.
- **The write path, in order:** `lib/fix/propose.ts` (pure, reads only) → `lib/fix/apply.ts`
  (four guards, all-or-nothing) → `app/actions.ts` (rebuilds the proposal server-side from the
  claim hash — the browser never names a path or supplies bytes) → the card UI in `app/page.tsx`.
- **Nothing has actually been approved yet.** All four UI states were rendered against live data,
  but no watched repo has been corrected through the button — that is an owner gate. nadim's
  `#22` → `#23` proposal is sitting on the Board waiting. **Re-verified 2026-08-18**: still true.
- **Stage 1 still ships: the reconciliation Board runs.** `pnpm install && pnpm dev` → the Board
  at `localhost:3000` (`:3001` if the port is busy).
- **It found the drift it was built to find, unaided.** nadim's HANDOFF claims *"PRs #1 through
  #22 merged"*; the Board reports `#23 is merged (1 past the claim); unclaimed open: #24`, and
  cites `docs/HANDOFF.md` as the source.
- **Live board state is not recorded here — run the app.** This bullet used to list all six
  severities as of 2026-07-27, and by 2026-08-15 at least one had moved (itqan `✓ in sync` →
  `○ attention`, which is the whole AC-2 story). **`docs/LEARNINGS.md` already forbids exactly
  this** — *live facts must never be hardcoded in a document; compute them or omit them.* Omitted
  rather than refreshed, because refreshing only resets the clock. **This bullet is the precedent
  the Verified state block generalises**: the rule was right and applying it one bullet at a time
  was the mistake.
- **Built:** collectors (`git`, `github`, `itqan-docs`), checks DC1–DC8, the Board UI per
  Concept C, degraded states, and `scripts/verify-acceptance.mts`.
- **D14 closed mid-build** — DC4 (uncommitted work) needed a threshold. Without one every
  project was permanently non-green and `✓ in sync` could never render, failing AC-2. Default 5,
  configurable per project.
- **Building it found something the wireframe got wrong.** `Fix Proposal v2` draws nadim's claim
  on `line 24` as a tidy snippet; it is really on **line 15**, inside a ~600-character bullet, so
  the live diff wraps to a paragraph. The design's *structure* held — full line, amber-flagged
  date — but its content was a reconstruction → `docs/BACKLOG.md`, `docs/LEARNINGS.md`.
- **The superseded `Fix Proposal` frame is renamed** to `SUPERSEDED (round 1) — … do not build`,
  closing the round-2 review's one blocking item.
- **Round-2 designs delivered, reviewed, and now partly consumed.** Overview direction is closed
  as **D16** (Concept A, tabbed/by-band, plus Concept B's "blocked on you" spotlight band).
- **All product decisions closed** — `docs/DECISIONS.md` **D1–D26**. D26 splits the app shell out
  of Stage 3 as **Stage 3a** and builds it first: it is portfolio-layer work against Stage 1 data,
  so it is not gated by Stage 3's two owner decisions, and it is the cheapest available test of
  D23's one known weakness (whether six project names actually fit in a 40px ribbon).
- **Stage 3a is built — the shell runs.** `/` is the Board inside a portfolio rail, `/p/<name>` is
  a project with the always-present ribbon and a conditional drift band, `/p/<slug>/<tab>` is the
  mount point Stage 3 will fill, and `/overview` says honestly that it is Stage 6. All six watched
  projects render the watched-only view, because none has an `agentos.yml` yet — that is the
  correct output, not a placeholder. **`pnpm verify` now runs every suite instead of stopping at
  the first red one**, which it had been doing since Stage 2, silently hiding Stage 2's results
  whenever Stage 1's AC-2 failed.
- **The shell's logic is pure functions in `lib/shell/model.ts`.** The components are deliberately
  dumb, so `verify:stage3a` asserts the things that could be *wrong* without rendering a route.
- **~~There is no app shell today~~** *(resolved 2026-08-18)* — the inventory that motivated it: Inventoried 2026-08-18: one route, a
  15-line root layout, a **448-line `app/page.tsx`** holding the Board, the fix UI and the roster
  together, over 539 lines of global CSS. The design tokens are the exception — `app/globals.css`
  already carries the validated palette in both schemes, so Stage 3a inherits it.
- **Older decisions** — `docs/DECISIONS.md` D1–D25. The newest are D23 (the
  shell), D24 (dispatch, never pull) and **D25** (a DoD item carries the *kind* of evidence that
  closed it — which supersedes what frame `G1` drew); D18–D22 are the re-scope.

## Stage 3 — T1–T5 landed (2026-08-18)

- **T1 (schema) and T2 (worktree) are built**, by two Sonnet agents in isolated worktrees, reviewed
  against the spec before integration. `lib/agentos/{db,types,worktree}.ts` and
  `scripts/verify-stage3.mts` (AC-2, AC-9, **AC-8a**).
- **The agents found three things in my own documents**, which is what they were for: the spec said
  *"nine tables"* while its schema block has always had **eight** (the agent refused to invent a
  ninth); the spec named every session *failure* state and no success state (now `completed`); and
  the ticket brief asserted `verify` behaviour that was only true on an unmerged branch.
- **Review found one real bug the agents' own tests could not.** `withWorktree` read commit shas
  only on the success path, and stored `baseRef` verbatim — so `baseRef: "HEAD"` made
  `git log HEAD..HEAD` empty and a committing session would have recorded **no commits at all**.
  AC-2 and AC-9 passed throughout because neither commits anything. **AC-8a** was added to catch
  it: a run that commits and then crashes must still report its sha before teardown, because
  `--force` removal leaves those commits unreferenced and the sha is the only way back.
- **T3 (runner + scripted fake) is built** — `lib/agentos/runner/{runner,local,fake}.ts` plus a
  hand-run smoke script. `@anthropic-ai/claude-agent-sdk@0.3.233` is now a dependency.
- **T3's agent read the installed package and found the spec's SDK table wrong in three places** —
  the section that claimed to be *"verified, not assumed"* had been verified against documentation
  rather than against the `.d.ts`. `canUseTool`'s signature is materially different, `query()`
  returns `Query`, and the token fields named in the table do not exist. §3.1 is corrected and
  carries the correction notice. **The real `canUseTool` is better for us**: a denial *must* carry
  a `message`, so the SDK enforces the reason §3.4 asked for.
- **Review found a test asserting its own fixture.** The check that `WebFetch`/`WebSearch` stay out
  of an agent's tools was fed a row that already excluded them, and `composeOptions` simply
  forwarded configuration. Now a floor in code, checked against a **hostile** row that asks for
  both. *An invariant enforced only by seed data is enforced by nobody.*
- **Merging #11 then #12 conflicted in four files, none of them a real disagreement** — see
  `docs/LEARNINGS.md`. `package.json`'s suite list is now *discovered* rather than written down, so
  that half cannot recur; the hub-doc half is a sequencing rule now in `CLAUDE.md` §Git.
- **T4 (the two MCP servers + the gate) is built** — `lib/agentos/mcp/{names,context,gate,agentos-server,inbox-server}.ts`
  plus AC-4, AC-5 and AC-5b. `zod` is now a direct dependency: it is a *peer* of the Agent SDK and
  was present in the pnpm store but **not resolvable from the project root**, so `createSdkMcpServer`
  could not have been called without it. Declared as `^4.4.3` — which is a floor, not a pin, and
  the wording here said "pinned" until a reviewer caught it. What actually prevents the failure
  mode is that our range and the SDK's peer range (`^4.0.0`) intersect, so pnpm resolves **one**
  instance; two would break `instanceof` inside the MCP server and would look like a schema bug
  rather than a resolution one.
- **The gate's first layer was one string away from being dead on arrival.** `canUseTool` is handed
  the *fully-qualified* name (`mcp__agentos__task_update_status`), not the bare one — and a callback
  matching the bare name would never fire while **AC-5 still passed**, because layer 2 refuses on its
  own. `qualify()` in `names.ts` is now the single source both the gate and its test import.
- **T4's agent found a defect in my own spec that no check in the suite could reach — D29.** The
  spec named the tools with dots (`task.read`); the Messages API's tool-name field is
  `^[a-zA-Z0-9_-]{1,64}$`. Dots register fine at the MCP layer, so it would have surfaced at the
  first *real* dispatch (AC-12) and nowhere earlier — because §3.3 deliberately routes AC-4/AC-5
  around the SDK. Renamed to underscores; **AC-5b** asserts the charset structurally, and was
  proved by reverting one name and watching it fail.
- **The sub-agent base problem was structural, and is now understood.** Four agents in a row were
  provisioned onto `3ea05a0` because isolated worktrees branch from **`origin/main`**, which this
  workflow leaves behind `develop` by design. The fourth stopped instead of building, because its
  brief made it check first. Worktrees are now created by hand from `develop` — `docs/LEARNINGS.md`.
- **T5 (`dispatch()` + the boot sweep) is built** — `lib/agentos/{dispatch,sweep}.ts`, plus
  AC-14…AC-19 (13 sub-assertions). `pnpm verify:stage3` is **19 of 19**. The five preconditions each
  refuse by name, the cap is proved per project rather than global, the drift snapshot records an
  explicit `in-sync` severity for a clean project (**not `null`** — an absent record and a clean
  project must not look alike), and the sweep keys on *no live owner* so a `waiting-inbox` session
  is swept too.
- **The state machine landed in `db.ts`, not `dispatch.ts`, and the reason is worth keeping.** T1's
  own docstring deferred "is this move even in the table" to T5 and predicted it would live in
  `dispatch.ts`. It cannot: the real illegal-write path is T4's MCP tool handler, which calls
  `writeTaskTransition` directly. That function is the only thing anything writes `Task.status`
  through, so it is the only place a check holds for **every** caller at once — which is also the
  plain reading of AC-19's own *"rejected at the data layer"*. **Which ticket owns a check and which
  file the check must live in are not always the same answer.**
- **Review found the one hole again, and it was in AC-14** — the check the funnel's whole guarantee
  rests on. It matched named imports only, so `import * as db from "./db"` followed by
  `db.createSession(...)` bypassed the funnel with AC-14 still green. Now also flagged as a bypass,
  and proved by writing that exact file and watching it go red. **Four waves, four checks that
  passed for the wrong reason, none caught by the agent that wrote it** — see the review note in
  `docs/LEARNINGS.md`.
- **The #13/#14 review found two real defects, both on paths no check reached.** (i) The gate's
  refusal text told the model to *"use inbox.ask"* — a tool D29 had renamed out of existence, in a
  string returned to the agent on every denial. (ii) `removeWorktree` was awaited *before* the
  terminal `updateSession`, so a teardown failure left the session saying `running` forever with no
  `endedAtISO` and no reason — **§7.7's own subject matter, reintroduced by an error path**, and one
  the boot sweep would only notice after a restart. Teardown is now best-effort, the terminal write
  always happens, and a failure keeps `worktreePath` because it is the only pointer to a directory
  that may still exist. **AC-9a** covers it, driven through a new `DispatchDeps.removeWorktree` seam
  because the real function throws only when `git worktree remove` *and* `prune` both fail.
- **The second review round found two more, both on paths the first fix opened.** T5 made
  `writeTaskTransition` throw on an illegal arrow, and T4's MCP handler called it **uncaught** — so
  an agent making an ordinary mistake (`review -> todo`) would have taken the whole session down.
  It returns a tool error now (**AC-19c**), matching how both of the handler's other refusals
  already behave. And the teardown fix's own decision to keep `worktreePath` created a collision on
  resume, since `createWorktree` derives the same path from the same session id; `resumeSession`
  clears it first and otherwise fails with an error naming the path. **That resume path has no test
  yet — it is AC-6, which is T6's** (`docs/BACKLOG.md`).
- **T6 is built: Stage 3's acceptance suite is complete.** AC-1…AC-19 all present and passing —
  *the count lives in the Verified state block above, not here* — plus **AC-12** — the one real session — written, documented, and deliberately outside
  `pnpm verify`: it sits behind `AGENTOS_REAL_SESSION=1` under a `stage3:real-session` script, which
  the `verify:*` discovery cannot pick up, so the default run can never spend money. **It has never
  been run for real** — that is an owner decision, and §4 calls it *"the only proof the other
  eighteen are testing something real"*.
- **The suite found a fragility in itself.** Stage 1 is **not hermetic** — its AC-1 needs a live
  `gh` call through DC1 — and both AC-11 and Stage 3a's AC-1 hard-assert its exact pass count. AC-11
  reports **SKIP** on a degraded upstream now rather than a false regression; Stage 3a's AC-1 has
  the identical exposure and is logged in `docs/BACKLOG.md`. Confirmed by putting a failing `gh` on
  `PATH` and reproducing the exact message T6's agent had seen and could not explain.
- **T7 is built — Stage 3 is complete.** The Tasks board, the session view and the Inbox, with
  every §8 rule that could be *wrong* in pure functions under `lib/tasks/` (`evidenceLineFor`,
  `registerFor`, `gateModelFor`, `columnsFor`) and dumb components that switch only on a decided
  discriminant. T7-1…T7-4 assert the four rules most likely to be "improved": a `todo` card's
  evidence is an **absence, not an empty string**; executed and hand-moved get **different
  registers**; the gate's refusal text is `gateRefusalReason()` itself rather than a copy; and the
  column model exposes no badge-shaped field. Drag-and-drop was dropped, which §8.4 explicitly
  permits.
- **`runBootSweep` finally has a call site, and it was proved against a real boot.** With a stale
  `running` session seeded, starting the server logs `[agentos] boot sweep: interrupted 1
  session(s) …` and the row reads `interrupted` afterwards — the first time §7.7's mechanism has
  been shown working outside a fixture.
- **Two things review caught that `pnpm build` never would.** Next compiles `instrumentation.ts`
  for an **edge** target even with no edge routes, and `runtime = "nodejs"` gates execution rather
  than compilation — in `dev` only, every route 500s until Node builtins are externalized for that
  target. And the boot hook was **creating** `data/agentos.sqlite` on a machine with no execution
  layer at all; it now opens the store only if it already exists. Both in `docs/LEARNINGS.md`;
  neither is visible without starting the server.
- **Stage 3 is complete and still unreachable on a real project.** Nothing connects an
  `agentos.yml` on disk to a `Project` row — the pages render an honest *"not initialized"* pane
  rather than inventing rows. That connector needs a decision about what creates the row, and it is
  the next thing standing between this build and a first real run (`docs/BACKLOG.md`, and D27 which
  already chose `fractal-code` as the target repo).
- **Next to build: Stage 3b** ([`stage-3b-onboarding.spec.md`](specs/stage-3b-onboarding.spec.md),
  written 2026-08-19). Stage 3 is complete and **cannot be used** — nothing turns an `agentos.yml`
  into a `Project` row, so the only way to create an agent or a task is a seed script. 3b is the
  smallest thing that closes the loop: initialize a project, create an agent, create a task. It is
  sequenced **before Stage 4** because Stage 4's own spec says it introduces no new machinery — it
  sequences parts that have already run, and right now none of them have run once. **Its one open
  decision is closed** — §5.1 became **D30** on 2026-08-19: an explicit *Initialize* button on the
  pane that already says *not initialized*. A filesystem watcher was rejected on sight and the
  rejection recorded, because it is the kind of convenience that comes back. **T1 is built** — see below. **The spec is `☑` and
  buildable, and the four T-tickets are written**
  ([`stage-3b-tickets.md`](specs/stage-3b-tickets.md), 2026-08-19): T1 the connector, T2 agent
  create/edit behind *configuration*, T3 task create, T4 the full cycle plus the walkthrough. They
  **stack** — each branches off the one before, because all four append to the same hub docs and to
  `scripts/verify-stage3b.mts`. Three facts measured on `8643ef7` shape them and are recorded in
  the tickets' own preamble: **no watched repo has an `agentos.yml`** (so this stage defines the
  format rather than capturing one, and the *not initialized* pane is unreachable today because a
  project without the file gets zero tabs), **there is no `configuration` surface yet**, and
  **`yaml` is not a dependency**.
- **Stage 3b T1 — the connector — is built** (`feat/stage-3b-t1-connector`, 2026-08-19). An
  explicit *Initialize* button on the *not initialized* pane turns an `agentos.yml` into a
  `Project` row: `primaryRepoPath` from the Board's own entry, never from the file or a form field;
  `slug` and `maxConcurrentSessions` from the file; idempotent on a second click; a stated reason
  on the screen when it refuses. Five checks, not the three the spec numbered — **lead review found
  the parser was dead weight**: with only AC-1/2/3 in place, both parsed values could be deleted
  from `createProject` and all three stayed green, and §3.3's malformed-file refusal had no check
  at all. **AC-1b** and **AC-2b** close both, and each was proved by making it fail. That is the
  T7-2 failure recurring one ticket later (`docs/LEARNINGS.md`, 2026-08-19), which is the reason
  the practice is now standing rather than advisory.
- **Stage 3b T2 — agents, behind configuration — is built** (`feat/stage-3b-t2-agents`,
  2026-08-19). `/p/<slug>/config`, reached from a rail link **outside the five tabs** —
  `EXECUTION_TABS` is untouched, because a sixth tab would be a decision against D23. Create and
  edit an agent; a fixed checkbox list for grants; the egress floor applied and **stated** at write
  time; editing refused while a session is live, naming it. Five checks, not the three the spec
  numbered. **Lead review found the cross-project ownership guard had no coverage** — deleting
  `agent.projectId !== owned.project.id` outright left AC-4/5/8 all green, and that guard is the
  only thing between a crafted post and editing another project's agent, grants and `canCommit`
  included. **AC-8b** closes it. **AC-5b** closes a second: T2 shipped a second copy of the denied
  tool list with a comment accepting "two independent lists that must agree" — a security boundary
  with two definitions is a silent second source of truth, so review extracted
  [`lib/agentos/egress.ts`](../lib/agentos/egress.ts) and AC-5b asserts nothing redefines it. Also
  moved in review: T2's inline `UPDATE Agent` left schema knowledge in a route file; it is
  `updateAgent` in `db.ts` now.
- **Stage 3b T3 — task create — is built** (`feat/stage-3b-t3-tasks`, 2026-08-19). Title,
  description, assignee (each agent plus an explicit human-only option), approval gate — bound at
  creation, never defaulted at dispatch. **The first ticket whose agent caught its own gap**: told
  in the brief exactly how T1 and T2 had failed, it ran the delete-a-guard probe unprompted, found
  that its cross-project assignee check had no coverage, and added **AC-6b** itself. Describing the
  last two misses worked where describing the criterion had not.
  Review added one check. T3 built *"Run now is absent, not disabled-looking"* correctly but as a
  ternary inside `components/tasks/Board.tsx`, then recorded it as untestable because no acceptance
  script imports a component. The premise was true and the conclusion wrong — **a decision that can
  be wrong does not belong in a dumb component**, and `lib/tasks/model.ts` was already in the
  ticket's file list. It is `showsRunControl` now, with **AC-7b** asserting all four cases *and*
  that `Board.tsx` delegates rather than repeating the decision — the second half guards the T7-2
  shape, where a pure function was correct, asserted, and dead for rendering.
- **Stage 3b T4 — AC-9, the full cycle, and the walkthrough — is built** (`feat/stage-3b-t4-cycle`,
  2026-08-19). One check runs the whole loop for real, against fixtures: create agent → create task
  → `dispatch` → the scripted fake asks a question → answer it → the fake itself moves the card to
  `review` → the human approves → `done`. Every transition is asserted **positively** (the session
  really entered `waiting-inbox`, one real open `InboxMessage` with the real question text; the
  resumed run's options carried the real answer and the right `sdkSessionId`; the session itself,
  not the test, moved `doing → review`) rather than only by the ending — the brief's own warning
  that *"a cycle test that would still pass if the pause never happened is testing very little"*
  is exactly what a `skip-pause` probe (below) exists to rule out. The evidence line at `review`
  is read through `cardModel`/`evidenceLineFor` (`lib/tasks/model.ts`), never re-derived, and
  asserted to resolve to a real session via `getSession` — checked at `review` specifically, because
  once the human's own `review → done` transition is the latest `TaskEvent`, `evidenceLineFor`
  deliberately switches the card to `hand-moved` (spec §8.3) and no longer names a session at all.
  **No production code changed.** AC-9 found no gap in T1–T3's own code to report — T4's Edit tool
  itself refused an attempted temporary edit to `lib/agentos/mcp/agentos-server.ts` under the
  ticket's own scope rule, which is the harness enforcing the same boundary the brief stated in
  words. Proved by four independent probes, run against a throwaway harness that reuses the same
  production functions unmodified rather than editing them: an actor recorded wrongly (a human
  recorded where the session itself moved the card) reddened on the missing `session`-actored
  `TaskEvent`; a transition that changes `Task.status` via a raw `UPDATE` instead of
  `writeTaskTransition` (so no `TaskEvent` at all) reddened the same way; a corrupted evidence-line
  session id reddened on `getSession` resolving to nothing; and skipping the inbox pause entirely
  reddened by timing out waiting for `waiting-inbox`, never reaching the fake success case the
  original risk named. `docs/HUMAN-TEST.md` gained **Part 7**, a seven-step walkthrough whose first
  step is the one thing this ticket cannot do itself: the owner adding `agentos.yml` to
  `fractal-code` (D27), with the exact two-line file to paste.
  **Lead review closed the one gap the ticket's own scope left open.** T4's four probes ran against
  a harness that reuses the production functions unmodified — sound, and the right adaptation to a
  file-scope rule, but it proves the *check* fires on bad data rather than proving it fires on a
  real regression. Review is not scope-limited, so the same probes were re-run by editing the
  production code in place: forcing `writeTaskTransition` to record every actor as `human` reddens
  AC-9 with *"no TaskEvent recorded dispatch's own todo->doing move with actor session …"*, and
  making `resumeSession` pass `"continue"` instead of the human's answer reddens it with *"the
  resume did not carry the human's answer into the run"*. Both reverted. That is the assertion
  worth having: **AC-9 catches a defect in the code, not merely a defect in a fixture.**
- **The execution surfaces are reachable for the first time** (2026-08-20, **D31**). Stage 3b
  merged and the owner found nothing in the UI — correctly, because no watched repo had an
  `agentos.yml`, so `projectNav` gave all six zero tabs and every execution surface rendered
  nowhere. `agentos.yml` is now at this repo's root. Verified against a running server, not
  asserted: `/p/agentic-os/tasks` renders the five tabs, the *Configuration* link and the
  *Initialize* button; `/p/nadim/tasks` 404s and the project page says why. **Note for anyone
  pulling this:** `pnpm install` first — `yaml` arrived with T1 and a checkout that skipped it fails
  at the parser, not at anything obvious.
- **Then:** the owner gates. **Nobody has run Part 7 by hand yet** — that is Stage 3b's own stated
  acceptance criterion (§4: *"Stage 3b's value is only realised once a human runs the cycle by
  hand"*), unmet the same way Stage 2's drift-correction click still is. AC-12 (one real session,
  `AGENTOS_REAL_SESSION=1`) has never been run; nadim's fix proposal has never been approved.

## How to pick up

1. `git status && git log --oneline -5 && gh pr list` — verify this file against reality.
2. `pnpm install && pnpm verify` — compare against the **Verified state** block, and expect Stage
   1's **AC-2 to fail** for the reason above. That is a known, logged, blocking item — not a regression you introduced, and not
   something to "fix" by editing the check before reading `docs/BACKLOG.md`. If **AC-1** also fails,
   that is **good news**: it means nadim's HANDOFF was corrected. Update the acceptance fixture
   rather than the check.
3. `pnpm dev` → read the Board. It includes itself, and nadim's card carries a live proposal.
4. `pnpm type-check` and `pnpm build` both clean as of this commit.

## Next up

> **Corrected while landing T4:** items 2, 5 and 6 below (both Stage 3 spec gates already cleared
> by D27, "build Stage 3" with Stage 3/3a/3b all already built, and committing `wireframes2.pen`
> which is already tracked) were stale — asserting work as pending that the rest of this same file
> already recorded as done. Removed rather than left to mislead the next session; no
> `docs/LEARNINGS.md` entry, since this is a narrative list going stale by not being updated as
> work landed, the ordinary way these rot, not a new class of mistake.

1. **Run `docs/HUMAN-TEST.md` Part 7, by hand** (owner gate). This is the actual next thing: the
   connector, the forms, and the whole dispatch → pause → resume → review → approve cycle are built
   and proven against fixtures (AC-9). **Nobody has run it on a real project with a real agent** —
   that is Stage 3b's own stated acceptance criterion — and it starts with adding `agentos.yml` to
   `fractal-code` (D27), which only the owner can do; Part 7 gives the exact file contents.
2. **Approve nadim's proposal once, by hand** (owner gate). With Stage 2 merged this is the
   *only* thing separating "eleven fixture tests pass" from "this has corrected a real document."
   Afterwards the card should read `✎ written · awaiting re-check` with git's own porcelain
   beneath it, and the next reload should decide for itself whether the drift is gone. Undo is
   `git checkout -- docs/HANDOFF.md docs/LEARNINGS.md` in nadim.
3. **Run AC-12 for real** (owner gate, `AGENTOS_REAL_SESSION=1 pnpm tsx scripts/verify-stage3.mts`)
   — the one check in the whole build that spawns a real session against the real Agent SDK. Costs
   money and needs the network, which is exactly why it stays outside `pnpm verify`; it has never
   been run.
4. **Look at the ribbon once** (AC-10). It is the one acceptance criterion that cannot be
   automated, and it is currently recorded in `docs/FEATURES.md` as a **computed estimate, not an
   observation** — ~890px of 1280px. `pnpm dev` → any `/p/<name>`. If it is cramped, D23 named the
   fallback in advance and §5.4 kept the pane unconstrained so the swap stays a layout change.
5. **Specs for Stages 4 and 5 are written** —
   [`stage-4-templates-chains.spec.md`](specs/stage-4-templates-chains.spec.md) is **`☑`
   buildable** (no owner gate; it is sequenced behind Stage 3b, which is now built), and
   [`stage-5-goals.spec.md`](specs/stage-5-goals.spec.md) is **`☐`**, gated on one owner call in
   its §5.11 — the default spend cap, and whether a goal may spawn unattended before the loop has
   been watched once. Stage 6 (the rewritten Overview) and Stage 7 (portfolio cost) are **not**
   specced yet, deliberately: both read data that Stages 3–5 produce, and speccing them now would
   be guessing at shapes that do not exist.

- **2026-08-18** — Round-3 wireframes reviewed and the shell closed as **D23**: Concept B′ over
  the design agent's own recommendation of C, because the Kanban is the surface this product will be
  used in for hours and C spends 268px of it permanently on five projects you are not working on.
  **One amendment to the owner's instruction, stated rather than applied silently:** the drift band
  is conditional as asked, but the *ribbon* stays always-present — a ribbon that appears only on
  drift makes its own absence an unsourced claim, which is invariant 2 and the exact distinction
  Stage 1 already ships (*"nothing to check" vs "checked and fine"*). **D24** closed the motor:
  work is dispatched through one funnel, never picked up by a scanner — the largest deliberate
  divergence from AgentOS-spec §9.4, on the grounds that a process which finds work and starts it is
  PRD §12.1's failure mode automated. **Found stale on arrival:** this file still said PR #6 was
  open; all three PRs had merged three days earlier. Also evaluated `/to-spec` and declined it —
  `docs/LEARNINGS.md`.

- **2026-08-18 (later)** — Stage 4 and Stage 5 specced. Stage 5 surfaced **D25**, which changes
  what the design drew: frame `G1` renders a met Definition-of-Done item with `▶ s_… · sha`, the
  glyph D22 reserves for *"a session produced this and here is the commit that proves it"* — but the
  session produced the **work**, while the judgement that the work satisfies the item is a model
  reading a log. That is the claim-as-fact collapse this product exists to prevent, on the one
  screen that decides whether to keep spending. Split into `command` / `judged` / `human`, which
  also makes writing a DoD an exercise in *"how would I know?"*. **Also restructured `HANDOFF.md`**
  so volatile facts live in one *Verified state* block — see below.

- **2026-08-18 (later still)** — Asked whether the dashboard skeleton had been planned, and it had
  not: the shell was sitting inside Stage 3's build-note item 7, **behind two owner gates that have
  nothing to do with navigation**. Inventoried what exists (one route, a 15-line layout, a 448-line
  page, no components directory) and split the shell out as **Stage 3a** — D26. Two things fell out
  of the inventory: the validated palette is already in `globals.css`, so tokens are not a gap; and
  `buildBoard()` is already a single entry point, so *"the ribbon and the Board cannot disagree"* is
  a matter of not adding a second call rather than of building a sharing mechanism.

- **2026-08-18 (build)** — **Stage 3a shipped.** Built in the spec's order, and step 1 earned its
  place: extracting the components with the Board still at `/`, then running `pnpm verify` before
  any routing existed, meant AC-1 had exactly one possible cause. It passed first time.
  **Two findings changed the code.** `pnpm verify` chained its suites with `&&`, so a red Stage 1
  meant Stage 2 and the new Stage 3a suite never ran in the aggregate — that had been true since
  Stage 2 shipped and was only visible once a third suite existed. Now every suite runs and the
  exit code aggregates. And AC-3's first draft asserted React's `cache()` dedupes by calling it
  three times in a plain Node script; it does not, because there is no render pass — **the test
  failed while the app was correct.** Rewritten as an import-graph assertion, which is the same
  correction the Copilot review had just forced on Stage 3's AC-14, arrived at independently one
  hour later. **A check that fails while the invariant holds is the kind people learn to delete.**

**Deliberately not next:** the Overview as previously specced (cancelled by D22 — it must read the
execution layer's tasks and goals, which do not exist yet), and everything in PRD §12.7.

**One thing to keep honest.** PRD §11.3 contains a standing instruction written before enthusiasm:
*if the Board is not opened daily within two weeks of Stage 2, the premise was wrong — record it
and stop.* Stage 2 is not merged and that clock has not meaningfully started. The re-scope does
not void that instruction; it makes it easier to forget.

## Blockers

None.

## Session log

- **2026-07-26** — PRD written; design brief written; round-1 wireframes delivered, Concept C
  chosen. Three commits direct to `main` (before D13).
- **2026-07-27** — Owner closed the open decisions (→ D5–D12). itqan installed (lite +
  `docs/specs/`), PR #1 merged. Stage 1 spec written and decision-closed, PR #2 merged. Stage 1
  built: all acceptance criteria pass, the Board runs in both colour schemes, and D14 was closed
  mid-build when DC4's threshold surfaced. Stage 2 spec written (PR #4), round-2 designs reviewed
  and D15/D16 recorded (PR #5).
- **2026-07-27 (later)** — Stage 2 built: propose → apply → 11 fixture-based acceptance checks →
  UI, in that order. Two defects were caught by *running* it rather than by review — a
  path-confinement guard that derived its bounds from its own input, and the JSX-newline bug
  recurring as "2 file s". The second one had already bitten once, so it was promoted from a
  lesson to a rule in `CLAUDE.md`.
- **2026-08-15 (later)** — Stage 3 spec written against **verified** SDK documentation rather than
  recall. Two findings changed the design: the Agent SDK is a *different package* from the tool
  runner the bundled API reference covers, and `strictMcpConfig` turns out to be the whole of
  "default deny" — omit it and an agent silently inherits the owner's own authenticated MCP servers.
  The inbox model was the real decision (§3.5): blocking inside the tool handler is less code and
  was rejected, because a paused run must survive a `pnpm dev` restart to mean anything.
- **2026-08-15** — Nineteen days idle; PR #6 never merged. `docs/specs/AgentOS-spec.md` arrived as
  the target for where the product should go. Evaluated against the shipped code, and the finding
  that shaped everything: the two systems point in **opposite directions** and the source spec
  breaks three of the five invariants — so the integration was written as **narrowing ADRs rather
  than deletions** (D19), which turned out to produce a better rule than the one it replaced.
  Phase A shipped this session: D18–D22, PRD §12 + a renumbered §10, the round-3 design brief, and
  the invariants scoped in `CLAUDE.md`. **Also found stale:** `CLAUDE.md` still read *"Status:
  pre-code"* while its own Commands table documented 19 passing acceptance checks — fixed, with a
  lesson (`docs/LEARNINGS.md`). **No code was written and no behaviour changed**, so
  `docs/FEATURES.md` is deliberately untouched.
