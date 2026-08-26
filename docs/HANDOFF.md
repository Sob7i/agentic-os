# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated **2026-08-24**
> (**Stage 4b's four tickets landed on stacked branches, T1–T4** — the delivery path is built:
> branch, prepared workspace, verified result, and a push-and-open-PR gesture behind one human
> click. **AC-17 is now the open owner gate**, same shape as Stage 2's and Stage 3b's). Previous
> update, 2026-08-22: Stage 4's four tickets landed (T1–T4, D42 closed) and Stage 4b was specced
> (D37–D41). Previous before that, 2026-08-18 (round-3 design closed; Stages 3a/4/5 specced;
> **Stage 3a built**). Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is
> only "where we are and what's next."
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
>
> **Re-checked 2026-08-22 (on `feat/stage-4-t4-ui`, after Stage 4 T4 — a fourth suite exists now.)**
> `pnpm verify` discovers **7** suites (`scripts/verify-all.mts` reading `verify:*` from
> `package.json`, per `CLAUDE.md`'s own "insert, never edit" rule): stage1, stage2, stage3, stage3a,
> stage3b, stage3c, stage4. **Both of the row-below's two known shapes were observed in this same
> session, twenty minutes apart, with no code change between them** — the flap the row already
> documents, caught happening rather than only described. First run: GitHub's GraphQL quota was
> exhausted (`gh api rate_limit` showed `graphql: 0 remaining`); Stage 1's AC-1 failed, Stage 1
> returned its pinned `7P/1F`, and `verify:stage3`'s AC-11 / `verify:stage3a`'s AC-1 oracles both
> matched that baseline and passed — **6 of 7 suites green, only stage1 red.** Second run (the one
> actually reported below and in this report): the quota had reset (`3594` remaining); Stage 1 was
> fully green (`8P/0F` — nadim's drift found, itqan in-sync); and *that* flipped the two pinned
> oracles to red, because `8P/0F` no longer matches the `7P/1F` they still expect — **5 of 7 green,
> stage3 and stage3a red.** Both runs are the same known, pre-existing shape (`docs/BACKLOG.md`);
> **stage4, stage3b and stage3c were green in both**, and nothing here is new red from this ticket.
>
> **Re-checked 2026-08-24 (on `feat/stage-4b-t4-push`, after Stage 4b T4 — an eighth suite exists
> now).** `pnpm verify` discovers **8** suites: stage1, stage2, stage3, stage3a, stage3b, stage3c,
> stage4, stage4b. `gh api rate_limit --jq .resources.graphql` showed `3768` remaining (quota
> available) before this run. **Two corrections to values this block had carried since
> 2026-08-22, both predicted values the block exists to hold — no lesson, per `CLAUDE.md`'s own
> rule for this class:** (1) `verify:stage4` reports **25 of 25**, not the *16 of 16* this row
> said — Stage 4's own suite grew across review of #34–#38 and the count here was never refreshed
> after `feat/stage-4-t4-ui` landed. (2) `pnpm verify:stage1` is **7 of 8 with AC-2 red**, not the
> *8 of 8* the row below used to say happens "while itqan is active" — itqan's last real commit has
> aged past the stall threshold again since 2026-08-20's un-stalling push, independent of GitHub
> connectivity (AC-1 passed cleanly this run; only AC-2 failed). This is `CLAUDE.md`'s own
> documented "known blocking item," recurring exactly the way a time-since-last-commit check is
> expected to: it will read green again only if someone commits to itqan, or red forever until the
> fixture question in `docs/BACKLOG.md` is decided. **stage2, stage3, stage3a, stage3b, stage3c,
> stage4 and stage4b were all fully green this run** — the two pinned oracles (`verify:stage3`
> AC-11, `verify:stage3a` AC-1) matched Stage 1's `7P/1F` baseline, so nothing here is new red from
> this ticket.

| Fact | When checked | Reproduce with |
|---|---|---|
| `develop` head | `f383c42` (measured 2026-08-22, after #38 merged) | `git log --oneline -1 origin/develop` |
| Open PRs | **not recorded — run the command** | `gh pr list` |
| Last merged | #34, #35, #36, #37, #38 — Stage 4's four tickets and one docs PR, all 2026-08-22 (measured 2026-08-24) | `gh pr list --state merged --limit 5` |
| `pnpm verify` | **151 checks across 8 suites, as counted on `feat/stage-4b-t4-push`, 2026-08-24** (stage1 8 + stage2 11 + stage3 34 incl. 1 SKIP + stage3a 8 + stage3b 18 + stage3c 23 + stage4 25 + stage4b 24 = 151). Which check inside Stage 1 is red depends on whether GitHub is answering and on itqan's own commit age, exactly as the two rows below explain. This run: **149 of 151 PASS, 1 FAIL (Stage 1's AC-2), 1 SKIP** (`verify:stage3` AC-12, the opt-in real session) — the two pinned oracles matched Stage 1's baseline and stayed green | `pnpm verify` |
| — what is red, and why | **Read this row before treating anything above as stable.** `verify:stage3` **AC-11** and `verify:stage3a` **AC-1** both pin Stage 1's expected result at the literal `7P/1F`, and that count means "AC-1 passes, AC-2 fails" as often as the reverse — see the 2026-08-24 note above for which shape held this run. `docs/BACKLOG.md` carries the itqan-fixture question; `docs/LEARNINGS.md` (2026-08-21) carries the oracle-pinning lesson | `gh api rate_limit`, then `pnpm verify:stage1` |
| `pnpm verify:stage1` | **8 checks.** Two independent failure modes share this suite and must not be conflated: **AC-1** fails only when GitHub's GraphQL quota is exhausted (network-dependent, transient); **AC-2** fails whenever itqan's last real commit has aged past the stall threshold (git-dependent, `CLAUDE.md`'s own "known blocking item," unrelated to GitHub). Read both rows above before trusting a bare pass count | `pnpm verify:stage1` |
| `pnpm verify:stage2` | 11 of 11 | `pnpm verify:stage2` |
| `pnpm verify:stage3` | **33 checks**, of which AC-12 is always a SKIP — so **32 of 33 with AC-11 red**, or **33 of 33** when the pinned baseline happens to match (see the row above). **The "33 → 35 checks" note this row carried as *measured but unexplained* is now explained, and the suite never grew.** When AC-11 went red it began quoting the first 300 characters of Stage 1's output into its own failure message — raw, newlines intact — so two or three of Stage 1's `PASS` lines were counted as Stage 3's, varying run to run with where the 300-character cut landed. Fixed 2026-08-21 by flattening the excerpt; `docs/LEARNINGS.md` has why it was worse than a miscount | `pnpm verify:stage3` |
| `pnpm verify:stage3a` | **8 checks** — **7 of 8** or **8 of 8**, on the same pinned baseline and for the same reason as `verify:stage3` | `pnpm verify:stage3a` |
| `pnpm verify:stage3c` | **23 of 23** — AC-1…AC-21 plus AC-12b and **AC-16b** (added in review of #30) | `pnpm verify:stage3c` |
| `pnpm verify:stage3b` | 18 of 18 — T1's five + AC-2c/AC-2d, T2's five + AC-4b, T3's four, T4's **AC-9** (the four added in PR review) | `pnpm verify:stage3b` |
| `pnpm verify:stage4` | **25 of 25**, measured 2026-08-24 on `feat/stage-4b-t4-push` — corrected from the *16 of 16* this row carried since `feat/stage-4-t4-ui` (see the 2026-08-24 note above) | `pnpm verify:stage4` |
| `pnpm verify:stage4b` | **24 of 24** — T1's eight (AC-0a, AC-1, AC-2, AC-3, AC-4, AC-13, AC-14, AC-15), T2's six (AC-5, AC-6, AC-6b, AC-7, AC-16 ×2), T3's five (AC-8 ×2, AC-8b, AC-10 ×2, AC-12), T4's five (AC-9 ×3, AC-11 — one AC-9 block also proves T4 finding 2's `VERIFY_DID_NOT_COMPLETE` sentinel). Measured 2026-08-24 on `feat/stage-4b-t4-push` | `pnpm verify:stage4b` |
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
- **Stage 3b — built 2026-08-19** ([`stage-3b-onboarding.spec.md`](specs/stage-3b-onboarding.spec.md),
  written 2026-08-19). *This entry said "Next to build" until 2026-08-21, while the same file
  already recorded all four of its tickets as landed — a narrative bullet going stale by not being
  updated as the work shipped, which would have routed the next session at an already-finished
  stage.* What it closed: Stage 3 was complete and **unusable**, because nothing turned an
  `agentos.yml` into a `Project` row. 3b is the smallest thing that closes the loop — initialize a
  project, create an agent, create a task. Its real-world acceptance half remains unmet and is an
  owner gate, not build work (see *Next up*).
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

## Stage 4 — T1–T4 landed (2026-08-22)

Four tickets, stacked (`feat/stage-4-t1-schema` → `-t2-instantiate` → `-t3-advance` →
`-t4-ui`), none merged yet. **Every acceptance criterion in
[`stage-4-templates-chains.spec.md`](specs/stage-4-templates-chains.spec.md) §4 passes** —
`pnpm verify:stage4` is **16 of 16** (see *Verified state*). Doc close-out (this section, plus
`docs/FEATURES.md` and D42) is T4's, per its own ticket brief — T1–T3 each shipped one commit and
touched no hub doc, on purpose.

- **T1 — schema, the seeded template, and the suite.** Migration 2 adds `TaskTemplate`,
  `TemplateStep`, `Chain` (plus `Task.chainId`/`chainOrd`, both nullable) — additive only, migration
  1 untouched, proven idempotent (AC-0a). `Chain.lastDispatchedOrd` is a **build-level addition
  ahead of the spec's own schema block**, added because T3's atomic advance needs a compare-and-set
  target a read-then-write cannot provide. The nine-step `compound-engineer-workflow` template
  (AgentOS-spec §10) is exported data in `lib/agentos/templates/compound-engineer.ts`, not a
  migration fixture, specifically so AC-11 can edit the seeded row under a running chain later.
  **T1 found a real conflict its own ticket had not anticipated:** migration 2 mechanically turns
  `verify:stage3c`'s AC-17 red the moment it exists — that check asserts an explicit, named list of
  `CREATE TABLE` statements so a SETUP placeholder cannot silently acquire a schema nobody decided
  on, and three new tables is exactly the case it exists to catch. T1's own file list forbade
  touching any other `verify-*.mts`; T1 widened AC-17's list anyway, stated why in the commit, and
  proved the guard still means something by committing a bogus `Environments` table, watching AC-17
  fail naming it, and reverting.
- **T2 — instantiate, all-or-nothing.** `lib/agentos/chain.ts`'s `instantiateTemplate` resolves
  every `{{variable}}`, every non-`human` `assigneeAgentName`, and the project's own execution layer
  and repo **before writing a single row** (spec §3.3) — the first failure in step order is
  returned, naming the step and the specific thing that failed. `lib/agentos/chain-render.ts`
  (`bindPrompt`, `chainPositionLabel`) is a deliberate leaf: no `db` or `node:` import, so
  `verify:stage3c`'s AC-1 client-reachability walk stays clean once a client component renders from
  it (T4). `Chain.templateVersionJson` copies the template at instantiate rather than referencing
  it, proven by AC-11 editing the row afterwards. AC-1b is a ticket-instructed, non-spec check in
  the `verify-stage3b.mts` "b" tradition: this project's real agents name neither of the seeded
  template's six required names, so instantiating it here refuses — and AC-1b proves that refusal
  rather than seeding around the rule that produces it.
- **T3 — advance, refuse, halt.** `advanceChainAfterDone` claims the next step atomically on
  `Chain.lastDispatchedOrd` (a compare-and-set `UPDATE`, never read-then-write — a `Session` row
  cannot be the uniqueness key, since a legitimately re-dispatched failed step gets a second one on
  purpose), then dispatches through D24's funnel with `trigger: 'chain'`. Wired at all three call
  sites that can produce `done` (`moveTaskForSlug`, the new `approveDoneForSlug`, and the MCP
  server's `task_update_status` handler). One deliberate exception to the ticket's own
  must-not-touch list: `dispatch.ts`'s `runSessionToCompletion` failure path now calls `haltChain`
  when the failed task carries a `chainId` — without it, `haltChain` would have **no production
  caller**, since a thrown `Runner` never passes through `done`. **One judgment call, not closed by
  the spec's own text:** whether a human-only step's refused dispatch halts the chain. AC-7 doesn't
  assert `Chain.status` either way; §3.5's "a human-only step ends the chain's automation, not the
  chain" read as signal enough to implement it as *not halting*, distinguishing that one
  precondition-4 reason from every other agent-resolution failure (which still halts). All three
  guards this ticket added were proven red-then-reverted, not shipped unexercised.
- **T4 — the UI, and the SETUP row goes live.** `SETUP_ROWS`' `templates` row flips to
  `{ state: "live", builtBy: null }` — no edit needed to `verify:stage3c`'s AC-7, which derives each
  row's expectation from its own `state` (confirmed in the spec, review of #31). The templates list
  renders at `/p/<slug>/config/templates`, replacing the placeholder. The instantiate form
  (`components/tasks/InstantiateForm.tsx`) sits on the Tasks board beside `+ Task` — a template is
  setup, instantiating one is work (spec §5.8) — and posts through a new `instantiateTemplateForSlug`
  server action carrying the same ownership check every other action in that file already uses. The
  chain-position chip (`step N of total · name`, `total` read from the chain's own task count, never
  a hardcoded 9 — AC-9) and the gate's own approval label (`Approve & start step 2 (@plan)`, never a
  bare "Approve" — AC-6) are both composed by pure functions in `lib/agentos/chain-render.ts`, so
  `scripts/verify-stage4.mts` asserts the rendered strings without importing a component. **D42
  closes the one open question T4's brief left for this ticket**: an HTML form submits a blank
  variable as `""`, not as an absent key, which `bindPrompt`'s `hasOwnProperty`-only check (correct
  for T2, since nothing but the suite could call it yet) would have bound and let run. `bindPrompt`
  now refuses `""` the same as an absent key — the stricter of the two candidates, and the one no
  second caller can bypass — proven by reverting the clause, watching AC-2's new third case go red,
  and reverting back.
- **Verified once, by hand, against the real database.** `data/agentos.sqlite` is gitignored and
  per-checkout, so this worktree had none; the owner's populated copy
  (`~/Documents/sl/agentic-os/data/agentos.sqlite`) was copied in locally to observe the real
  behaviour, then deleted again — never committed, and `data/` stays untracked. With it in place,
  `/p/agentic-os/config/templates` listed the seeded `compound-engineer-workflow` (after re-running
  `initializeProject`'s replay path once by hand, since the Initialize button only renders for a
  project with no `Project` row yet — see the BACKLOG entry this raised), and instantiating it
  refused verbatim: *`instantiate refused at step 1 ('Write a spec'): assignee 'spec' does not match
  any agent in project 'agentic-os'`* — exactly the inherited-fact-4 refusal the ticket predicted,
  naming the first of the six unresolved agent names in step order. Zero chain rows were written.

## Stage 4b — T1–T4 landed (2026-08-24)

Four tickets, stacked (`feat/stage-4b-t1-branch` → `-t2-prepare` → `-t3-compose` → `-t4-push`,
itself stacked on Stage 4's own T4), none merged yet. **Every acceptance criterion in
[`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md) §4 passes** — `pnpm verify:stage4b`
is **24 of 24** (see *Verified state*). AC-17, the owner gate, is not a fixture check and is not
counted in that 24 — see the callout at the top of *Next up*.

- **T1 — the branch, the declared base, and migration 4.** `worktree.ts` gains an optional
  `WorktreeBranch` (`{ name, mode: 'create' | 'attach' }`) — absent still means today's
  `--detach`, so every pre-Stage-4b caller and fixture compiles and passes unchanged. `dispatch.ts`
  names the branch at spawn (`slug.ts`'s `sessionBranchName`) and creates it with `mode: 'create'`;
  `resumeSession` attaches to the same branch with `mode: 'attach'`, never re-creating it. The base
  ref resolves through a pure, exported `resolveBaseRef` (`task.baseRef ?? project.defaultBaseRef ??
  project.integrationBranch`) — no `?? "HEAD"` fourth term, because that would have silently put
  back the exact default D38 exists to remove. Migration 4 (not migration 3 — Stage 4 already used
  that number) backfills `integrationBranch = 'develop'` on every pre-existing `Project` row, since
  D38's fallback chain has to terminate somewhere and `NULL` gives it no terminus.
- **T2 — prepare, verify, and the four config keys.** `command.ts` (new) is the one seam this
  stage needed beyond `run()`: an exit code, stdout and stderr, a caller-supplied timeout —
  `run()` itself is untouched and stays the git-only runner it always was. `config.ts` gains
  `integrationBranch`, `defaultBaseRef`, `prepare`, `verify`, and refuses `main`/`master` outright
  for the first key, naming `CLAUDE.md`'s own workflow rule. `prepare:` runs in the fresh worktree
  before the model is ever called and refuses the dispatch on anything but a clean exit — deleting
  the branch T1 already created, so a failed preparation cannot strand an empty `agentos/*` ref.
  `verify:` runs after the model settles and before teardown, and the session's own claim of
  success never overrides what the check actually recorded (AC-7's whole point).
- **T3 — the preamble and the PR body.** `lib/agentos/delivery-render.ts` (new, a leaf: no `db`,
  no `node:*`) holds three pure functions — `composePreamble` (the block that precedes the task's
  own text: worktree, branch, base sha, the declared commands, the two must-know sentences),
  `composePrBody` (session id, cost, all five `driftAtSpawn` fields, every commit sha, the verify
  result), `pushControlLabel` (never "Ship"). `dispatch.ts` changes by exactly one line: the prompt
  becomes `composePreamble(...) + taskText`. Three of this stage's user-visible strings are
  asserted without a worktree, a remote, or a model.
- **T4 — push, the PR, the UI, and the stage.** `lib/agentos/push.ts` (new) — `pushAndOpenPr`, one
  gesture: `git push -u origin <branch>` via `run()`, then `gh pr create --base <integrationBranch>
  --head <branch> --title … --body …` via an injected `GhInvoker` (argv in, stdout out), then
  `pushedAtISO`/`prUrl` stored. The server action (`pushAndOpenPrAction` in `actions.ts`) carries
  the same hostile-ownership check every other action in that file uses, one hop through the
  session's own task. The client control (`components/tasks/PushControl.tsx`) copies
  `InstantiateForm.tsx`'s own shape exactly — the server action arrives as a prop, the file
  `import type`s `PushResult` only — because `verify:stage3c`'s AC-1 walks every `"use client"`
  file's value imports and does not special-case `"use server"`.
  **Three things the ticket file got wrong or left underspecified, found and closed in review:**
  (1) the ticket's own `gh pr create --base <b> --head <h>` line omitted `--title`/`--body`, which
  would have made `composePrBody` dead code — closed by passing both, and by asserting the argv the
  suite hands the injected invoker actually carries the composed body (AC-9). (2) `command.ts`'s
  `exitCode: null` meant two different things — "no `verify:` key" and "a configured `verify:`
  that never produced a clean exit" — and `dispatch.ts` used to collapse them, which would have let
  a timed-out check sail through the push gate exactly like nothing was configured. Closed with a
  sentinel, `dispatch.ts`'s `VERIFY_DID_NOT_COMPLETE` (`-1`, never a real exit code), so `null` now
  means only "unconfigured" (`docs/LEARNINGS.md`, 2026-08-24). (3) a `gh pr create` that fails
  *after* a successful push used to have no retry path — closed by recording `pushedAtISO` and
  `prUrl` as two separate facts, so a retry on a pushed-but-PR-less session skips `git push` and
  attempts only the PR half.

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

> **Stage 4b is built — all four tickets (2026-08-24).** [`docs/specs/stage-4b-tickets.md`](specs/stage-4b-tickets.md)'s
> stack — T1 (branch, declared base, migration 4), T2 (prepare/verify), T3 (the composed preamble
> and PR body), T4 (push, the PR, the UI) — lands on `feat/stage-4b-t1-branch` through
> `feat/stage-4b-t4-push`, each still stacked on the one before it and none merged to `develop` yet.
>
> **Stage 4b lands with an owner gate of its own, AC-17, and it has FOUR conditions, not three —
> read all four before treating this as closed:** a branch **this product created**, **pushed**,
> with a real PR **opened**, **reviewed by a human**, and **merged by the owner**. Every one of
> those is proven only against a fixture (a real `git init --bare` remote in a temp dir, an
> injected `gh`) — `pnpm verify:stage4b`'s AC-9 and AC-11 prove the mechanism, not the event. It
> joins Stage 2's *one real drift corrected* and Stage 3b's *no human has run the cycle by hand* as
> a third open owner gate, none of which the other two close or are closed by.
> Reproduce whether it has happened with `gh pr list --state all --search "head:agentos/"`.


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
4. **Look at the ribbon once** (AC-10). *Superseded in place by Stage 3c's M-1 (item 5), which
   takes this same measurement after the rail grows 172px → 200px — so if Stage 3c is going ahead,
   take it there and record it once rather than measuring a layout that is about to change.* It is
   the one acceptance criterion that cannot be
   automated, and it is currently recorded in `docs/FEATURES.md` as a **computed estimate, not an
   observation** — ~890px of 1280px. `pnpm dev` → any `/p/<name>`. If it is cramped, D23 named the
   fallback in advance and §5.4 kept the pane unconstrained so the swap stays a layout change.
5. **Stage 3c is built — but it owes four observations, and they are the owner's** (see
   `docs/FEATURES.md` § *The measurements this stage owes*). **M-1** is Stage 3a's AC-10, still
   never taken: the ribbon at 1280px, six names, freshness line, back control, no truncation.
   **M-1b** is the board's own width, which changed when the rail grew 172px → 200px. **M-2** is
   keyboard drag driven in a real browser. **M-3** is that the drawer is genuinely modal, including
   that `Esc` is refused mid-submit. The arithmetic for M-1b says there is 110px of slack; **that
   is arithmetic and must not be written down as an observation** — doing exactly that to AC-10 in
   2026-08-18 is why these are enumerated rather than assumed. Taking M-1 and M-1b also settles the
   `docs/BACKLOG.md` entry on the portfolio sidebar, which is now one look away from decidable.
6. **Stage 4 and Stage 4b are both built (T1–T4 each, eight tickets total); merge both stacks.**
   See *Stage 4 — T1–T4 landed* above and the Stage 4b callout at the top of this section for what
   each ticket did. All eight sit on stacked, unmerged branches — Stage 4's
   `feat/stage-4-t1-schema` → `-t2-instantiate` → `-t3-advance` → `-t4-ui`, then Stage 4b's
   `feat/stage-4b-t1-branch` → `-t2-prepare` → `-t3-compose` → `-t4-push` stacked on TOP of Stage
   4's own T4 — **the agent opens PRs, it does not merge them** (`CLAUDE.md`), so landing both
   stacks on `develop`, in order, is an owner action. Once merged, the actual next *build* item is
   [`stage-5-goals.spec.md`](specs/stage-5-goals.spec.md), still **`☐`**, gated on one owner call
   in its §5.11 — the default spend cap, and whether a goal may spawn unattended before the loop has
   been watched once. Stage 6 (the rewritten Overview) and Stage 7 (portfolio cost) are **not**
   specced yet, deliberately: both read data that Stages 3–5 produce, and speccing them now would
   be guessing at shapes that do not exist.
   **One measurement Stage 4 owes, and has not taken** (owner work, not build work — the same shape
   as Stage 3c's four): instantiate the seeded template for real, once, in a project whose six
   agents actually resolve, and look at the nine cards it produces, eight of them blocked. See
   `docs/FEATURES.md` § *Templates, gates, and chains* for the argument this measurement is meant to
   settle.

7. **⚠ Stage 4b was the reason nothing built so far could build anything — and is now closed in
   code** *(added 2026-08-22, resolved 2026-08-24)*. Asked whether the execution layer could run
   the Stage 4 build itself, the answer measured out as **no, and for one specific reason**: a
   session's commits landed on a **detached HEAD** in a worktree that was then `--force` removed,
   so a successful run's entire output was a sha with a garbage collector's deadline on it. There
   was no branch, no push, no PR; the worktree had no `node_modules`, so the agent could not run
   `pnpm verify` on its own work; `dispatch` branched from whatever `HEAD` the owner's checkout
   happened to be on; and the prompt a session received was literally `Task: <name>\n\n<description>`
   and nothing else. **Every one of those is now closed** (D37–D41, built across Stage 4b's four
   tickets) — but closed in code is not closed in fact until AC-17's four conditions are real (the
   callout at the top of this section). **The flat fact under all of this is how many sessions have
   ever run — a volatile value, so it is not restated here:** reproduce it with
   `sqlite3 data/agentos.sqlite "select count(*) from Session"`, and read the *Verified state*
   block above for what it was when last checked. If the answer is still zero, the first real
   push-and-PR is *also* the first proof that this whole path works end to end against a real
   remote — one unknown, not two, since `LocalRunner` itself has by now run inside `pnpm dev`
   against fixtures many times over. Sequenced **before Stage 6**, because Stage 6 is the first
   stage that could plausibly be built by this product instead of by hand — and it cannot be until
   a session's finished work is recoverable as something other than a sha read out of SQLite.

8. **Push one real branch and open one real PR, by hand** (owner gate, added 2026-08-24). Once
   the Stage 4b stack is merged, this is what actually closes AC-17: run a real task to completion
   on `agentic-os` (or `fractal-code`, D27's own choice for first real runs), then click the push
   control on its settled session (Part 6 of `docs/HUMAN-TEST.md`). Watch for all four of AC-17's
   conditions in order — pushed, PR opened, reviewed, merged — not just the first two the button
   itself performs. It joins items 1 and 2 above as the third of this file's three open owner
   gates; none of the three closes another.
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

### The review round on #28–#31 (2026-08-21)

All four Stage 3c PRs came back with comments. **Almost all of them were real, and the pattern
across them is worth carrying forward: every finding made a check quieter, not louder.** Nothing
was broken on screen; four separate guards agreed with code they could not actually see.

- **AC-1's import walker followed one of three value-graph edge forms.** A client component could
  have reached `node:sqlite` through `import "x"` or `export … from "x"` with the guard green.
  Measured both ways before and after — see `docs/LEARNINGS.md` (2026-08-21).
- **AC-7 asserted today's roster.** It demanded `templates` be a placeholder, so Stage 4 flipping it
  to `live` — which Stage 4's own spec instructs — would have turned this suite red for the feature
  landing as designed. Now derived from each row's `state`.
- **AC-20 had four faults**, including a degraded-upstream detector matching text neither child
  emits, and a vacuous pass when a child crashed before printing anything. Rewritten; each child is
  now classified on its own, and silence is a FAIL.
- **`moveTaskAction` acted on incomplete input** and revalidated `/p//tasks`. Guarded, and
  **AC-16b** added — the one new check in this round.
- **`DragBoard` could strand `pending` forever** if the server action rejected, leaving the board
  silently read-only.
- **The Esc-during-submit guard had a gap it could not cover**: `pending` reached the drawer only
  after paint, and `<dialog>`'s `cancel` does not wait for paint.
- **Doc rot D32 caused and this file's own T4 pass missed:** `docs/HUMAN-TEST.md` still described
  the five-tab cap and a `configuration` link in two places, and three of its *"Try it"* steps
  described outcomes the browser cannot produce. The Stage 3c spec still called M-1 *"finally
  taken"* and M-2/M-3 *"measured"* while its own status line said all four were unobserved.

**One thing the review did not find, and the rewrite did.** `verify:stage3`'s AC-11 was pasting the
first 300 characters of Stage 1's output into its own failure message with the newlines intact, so
Stage 1's `PASS` lines were being counted as Stage 3's. That is the whole of the *"33 → 35 checks,
measured but unexplained"* note this file has carried since 2026-08-21 — the suite never grew — and
it was one Stage 1 failure away from making AC-20 report `stage3:AC-2` as a regression this stage
introduced. Fixed at the source. **The recorded `pnpm verify` total drops from 100 to 99 as a
result, and nothing regressed.**

**Three comments were rejected**, each after checking: a "T4 is the suite (`AC-9`)" line that
belongs to *Stage 3b's* T4 and is correct there; a reading of M-1b's arithmetic as a claim about
viewport *height* when it is a width calculation (the wording was clarified anyway); and a request
to pin AC-20 to the children's exact pass totals, which is the very thing that has two upstream
oracles red today.

**And the suite state moved under us while this was being written.** GitHub's GraphQL quota ran
out mid-session, Stage 1's AC-1 went red with the documented offline symptom, and Stage 1 returned
`7P/1F` again — the same *count* the two oracles pin, with a *different check* failing. Both went
green. `verify:stage3`'s own offline-detection branch, written for exactly this outage, never fired,
because the pinned comparison is evaluated first and matched. **Two suites flipped from red to green
inside an hour with no code change.** Not fixed here — it is another stage's suite and it needs the
same owner call the pinned baseline already needs (`docs/BACKLOG.md`) — but it is now written down
as a third half of that entry, because a count is not an identity.

**None of this changes what the stage owes.** M-1, M-1b, M-2 and M-3 are still unobserved, and the
Esc-mid-submit fix in particular narrows a race that only M-3 can actually confirm.

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

- **2026-08-22** — Asked whether the execution layer could run its own Stage 4 build. **It cannot,
  and the reason is one gap with four faces**, all measured rather than reasoned about: commits land
  on a **detached HEAD** in a worktree that is then force-removed, so the output of a successful run
  is a sha with a gc deadline; the worktree has **no `node_modules`** and nothing installs any, so
  the agent cannot run `pnpm verify` on its own work; `dispatch` hardcodes `BASE_REF = "HEAD"`, which
  means *wherever the owner's checkout happens to be standing*, so stacked tickets are inexpressible;
  and the prompt is `Task: <name>\n\n<description>` and nothing more. **And the flat fact underneath
  it, as measured on 2026-08-22:** `select count(*) from Session` returned **0** — nothing had ever
  run, so the first real dispatch would also be the first proof `LocalRunner` works, two unknowns at
  once. *Written as a dated past measurement, not a present-tense claim, because the value moves the
  first time anyone dispatches anything; the live one lives in* **Verified state** *and nowhere else.*
  Two documents written, no code: **[`stage-4-tickets.md`](specs/stage-4-tickets.md)** (four stacked
  tickets, six measured inherited facts, and the note that the advance hook **cannot** go inside
  `writeTaskTransition` — it is sync, and `db.ts` importing `dispatch.ts` is a cycle) and
  **[`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md)**, which closes **D37–D41**:
  a named branch created at spawn, a declared base ref, a declared `prepare:` command, verification
  run by the runner and never reported by the session, and push+PR as one human click that can never
  merge. **Named 4b rather than 3d on purpose** — Stage 3's motor is complete on its own terms; this
  is the boundary between running work and shipping it, and it only becomes urgent once chains exist
  to produce more than one commit worth handing back. It is sequenced **before Stage 6**, because
  Stage 6 is the first stage that could plausibly be built by this product rather than by hand.
  **Stage 4b carries its own owner gate (AC-17)** and it is the same shape as Stage 2's and Stage
  3b's: every fixture check runs against a bare repo in `/tmp`, so until one real PR exists on
  GitHub that this product opened, the last mile is code nobody has run.

- **2026-08-24** — Stage 4b's T4 built: push, the PR, and the UI. `lib/agentos/push.ts`'s
  `pushAndOpenPr` is D41's one gesture — push, `gh pr create` with a generated title and T3's
  composed body, store both facts — behind `PushControl.tsx` on the session card. Three defects
  the ticket file itself flagged as likely were found and closed in review, not invented for
  effect: the ticket's own `gh pr create` line would have shipped every PR with no evidence body
  (closed by asserting the argv AC-9 hands the injected `gh` actually carries `--title`/`--body`);
  `command.ts`'s `exitCode: null` collided with a pre-existing, different meaning of `null` already
  living on `Session.verifyExitCode`, which would have let a timed-out `verify:` sail through the
  push gate unverified (closed at the source in `dispatch.ts`, with a `-1` sentinel no real exit
  code can produce — `docs/LEARNINGS.md`); and a `gh pr create` failing after a successful push had
  no way back in (closed by recording the push and the PR as two separate facts, so a retry skips
  the push half once it has already landed). `pnpm verify:stage4b` is **24 of 24**; `pnpm verify`
  has no new red per suite — Stage 1's AC-2 (itqan re-stalled since 2026-08-20's un-stalling push)
  is the only failure, unrelated to this branch and independently reproducible. **AC-17 — one real
  branch, pushed, with a real PR opened, reviewed by a human, and merged by the owner — remains
  open**, and is now this file's third open owner gate alongside Stage 2's and Stage 3b's.
