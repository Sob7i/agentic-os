# Agentic OS — Backlog

Deferred work lands here as an entry — not as a paragraph in `docs/HANDOFF.md`, a PR
description, or a session log. If it's worth doing later, it's worth a line here; if it isn't
worth a line here, it wasn't worth deferring — say so and drop it.

This is not the roadmap. Planned scope lives in `docs/PRD.md` §10 (build order) and, once
decision-closed, in `docs/specs/`. BACKLOG is for one-off deferred items: cleanups, follow-ups,
and things explicitly punted with a reason.

## Open

- **"Add project" from inside the interface — opting a project in without editing a file by hand**
  *(added 2026-08-20)*. Opting in currently means the owner creating an `agentos.yml` at a repo's
  root by hand, which is what `docs/HUMAN-TEST.md` Part 7 step 1 asks for and what was just done for
  this repo. That is the right *first* shape — D30 chose an explicit click over a watcher precisely
  so nothing creates records unasked, and a hand-written file is the most explicit act available —
  but it puts the product's first step outside the product, which is the same objection §5.1 raised
  against option (b), the CLI. **What this would be:** a control on the portfolio Board that writes
  `agentos.yml` into a watched repo after an explicit confirmation, then initializes it.
  **What makes it non-trivial, and why it is not a small follow-up:** it is a **write into another
  repo**, which invariant 4 makes an owner-gated per-change approval — so it needs Stage 2's
  proposal-and-approve shape (show the exact file, the exact path, approve or cancel), not a button
  that just writes. It also needs an answer for a repo not in `projects.config.ts` at all, and D9
  deliberately keeps that list explicit rather than discovered. **Unblock condition:** the cycle in
  Part 7 having been run by hand at least once — the walkthrough is what tells us whether the
  hand-written file is actually the friction, or whether the friction is somewhere else entirely.

- **The portfolio sidebar should list the projects** *(added 2026-08-20, owner request)*. Inside a
  project the rail is the five work tabs; on the portfolio home
  ([`PortfolioRail.tsx`](../components/shell/PortfolioRail.tsx)) it is `Board · Overview` and **no
  project list** — projects are entered from the Board's cards in the pane, and once inside, the
  40px horizontal ribbon carries them. The owner ran the app, looked for a *Projects* nav item with
  the projects underneath it, and did not find one. **This is a decision, not a gap** — D23 chose
  Concept B′ (the mode switch) and explicitly rejected Concept C, the persistent 268px spine that
  keeps every project visible. It is in the backlog rather than closed because **D23's own rationale
  names the condition for revisiting**: *"B′ is the right answer if the Kanban proves cramped in
  build."* We decided before building, on a prediction about the Kanban's width. The first real use
  produced evidence about the *other* half — whether the portfolio stays reachable — and it points
  the other way. **Unblock condition:** the Tasks board having been used with enough real cards to
  judge the width question D23 actually traded against, so the two halves are weighed against
  evidence rather than one against evidence and one against a prediction. Note that a nav item
  listing projects on the *home* rail is a much smaller change than Concept C, and may be all that
  is wanted — the ribbon already solves this inside a project.

- **`lib/tasks/data.ts` loads the Tasks board with N+1 queries** *(added 2026-08-19)*. Events are
  fetched per task, and tool calls, commit shas and inbox messages per session. Correct, and fine
  against the fixture-sized databases everything is currently tested on — but it grows linearly with
  a project's history, and the board is the page someone leaves open. Raised in review of #17 and
  **deliberately not fixed there**: the honest fix is a handful of grouped queries, and doing it
  before any real project has accumulated a single session would be optimising against a guess.
  **Unblock condition:** the first project with enough real tasks and sessions to measure — at which
  point measure first, then batch the three per-session loads.

- **`verify-stage3a.mts`'s AC-1 can go red because GitHub is down** *(added 2026-08-19)*. It spawns
  `verify:stage1` and **hard-asserts its exact pass/fail totals**. Stage 1 is not hermetic — its
  AC-1 depends on a live `gh` call through DC1 — so an offline or rate-limited moment drops a pass
  and the oracle reports a portfolio regression that did not happen (`docs/LEARNINGS.md`). The
  totals themselves belong in `docs/HANDOFF.md`'s *Verified state* block; reproduce with
  `pnpm verify:stage1`. T6's **AC-11** fixed this for
  itself by reporting **SKIP** on a degraded upstream rather than FAIL; AC-1 in the Stage 3a suite
  still needs the same treatment. Not done here because it edits a shipped suite's check, which is
  its own change with its own review surface. **Unblock condition:** none — this is a small,
  self-contained fix that just needs its own PR; copy AC-11's `degradedUpstream` branch.

- **Fast-forward `main` to `develop`, or stop provisioning sub-agents from it** *(added
  2026-08-18)*. `origin/main` sits at `3ea05a0` — the PRD/design-brief commit, before Stage 1 —
  because the workflow says `main` receives only `develop` and only from the owner. The isolated
  worktree option branches from `origin/main`, so **every auto-provisioned sub-agent starts before
  the execution layer exists**; it happened four times, and three of those agents built against it
  before anyone noticed. The current mitigation is to create the worktree by hand from `develop`
  and hand the agent the path, which works but has to be remembered every time.
  **Unblock condition:** the owner merges `develop` into `main` (an owner-only gate, and a real
  release decision — not a housekeeping chore, which is why it is here rather than done). Until
  then, the hand-made worktree stands and `CLAUDE.md` §Git carries the rule.

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

### Blocking — found 2026-08-15

- **`pnpm verify` is red: Stage 1 AC-2 fails, and the check is right.** AC-2 asserts *"itqan is
  green"* by name ([`scripts/verify-acceptance.mts`](../scripts/verify-acceptance.mts) §AC-2), and
  itqan's last commit is 2026-07-21 — 25 days, past its `stalledAfterDays: 14`, so DC7 correctly
  reports `○ attention`. **The product is behaving exactly as designed; the test hardcoded a
  time-dependent fact about a real repo**, which is the same error `docs/LEARNINGS.md` already
  records for documents, now in a test.
  **It needs a decision, not just an edit**, because `docs/PRD.md` §10 names itqan in the Stage 1
  acceptance criterion, so changing the test amends the PRD. The two readings: *(a)* AC-2 exists to
  prove **a green row is reachable and correctly attributed** → assert that *some* project renders
  `in-sync` with a timestamp, which never rots; *(b)* AC-2 exists to pin **one known-good repo** →
  keep the name and refresh the fixture whenever it rots, accepting the maintenance. Unblocked by:
  the owner picking (a) or (b). **(a) is the recommendation** — it tests the behaviour the PRD
  actually cares about (§3.1: *a green row is worth as much as a red one*) instead of the weather.

### From the execution-layer re-scope (2026-08-15, D18–D22)

- **Local sessions have no container or network wall.** D20 chose local-first, so AgentOS-spec §5's
  least-privilege model is enforced at the MCP and tool layer only — a local process can in
  principle reach the whole filesystem, and the spec's "second wall" (§5.5: a network allow-list
  that blocks GitHub even if a prompt leak asks) does not exist. **Stated, not pretended.**
  Unblocked by: a session doing something outside its grants that the tool layer failed to catch —
  or the cloud runner, which brings the container with it.
- **Cloud runner behind the `Runner` interface** — D20 builds `provision`/`streamToolCalls`/
  `injectReply`/`destroy` with one local backend. Unblocked by: wanting to close the laptop, or
  the local machine becoming the bottleneck.
  **Re-scoped 2026-08-15 by a finding while writing the Stage 3 spec:** Anthropic's **Managed
  Agents** already provides, as platform primitives, several things `AgentOS-spec.md` describes as
  control-plane code to be written — a per-session **dollar spend cap** that pauses rather than
  terminates, **scheduled deployments** (cron → session, with per-firing run records), **webhooks**
  for session state transitions, per-session **sandboxed containers**, persistent **memory stores**,
  and **multiagent** sub-agent orchestration. That maps onto AgentOS-spec §11 rails, §15
  automations, §14 triggers, §6 containers, and §10's reviewer fan-out respectively. So the cloud
  path is materially cheaper than the spec assumes — it is *adopting* primitives, not rebuilding
  them. It is still deferred (D20: it would widen the egress carve-out and add infrastructure before
  the loop is proven), but the trade should be re-evaluated with this in hand rather than from the
  spec's own framing.

### From the Stage 3 spec (2026-08-15)

- **Every session leaves a `~/.claude/projects/<encoded-cwd>/` directory behind.** The Agent SDK
  keys transcript storage by working directory, and each session gets a fresh worktree path, so the
  tree accumulates one directory per session forever. Harmless at this size, and the same property
  gives Stage 7 a free attribution key (spec §3.6). Unblocked by: the directory count becoming
  noticeable, or Stage 7 wanting to prune.
- **Per-session cost has two sources that will disagree.** The SDK reports `total_cost_usd`; Stage 7
  computes the same figure from the transcript. Spec §3.6 says show both rather than reconcile them
  silently (D7). Unblocked by: Stage 7, which is when the second number first exists.
*(The AgentOS-spec glyph item that was listed here is folded into the re-scope entry above, which
was rewritten after PR review — it is partly resolved, not merely deferred.)*
- **R2-style filesystem MCP + secret manager** — deferred by D20: the spec's persistence design
  exists because *its* containers are ephemeral **and remote**; a local worktree has a local disk.
  Unblocked by: the cloud runner above.
- **Triggers (webhooks) and cron automations** — AgentOS-spec §14–§15. Real capability, not
  required for the MVP loop (PRD §12.4). Unblocked by: a repeating job actually being run by hand
  twice.
- **YAML-as-code round-trip and the `agentos` CLI** — AgentOS-spec §17. Unblocked by: agent
  configuration becoming tedious enough in the UI to be worth a file, or wanting to version it.
- **PWA + web push for the inbox** — AgentOS-spec §12. Unblocked by: the inbox being worth being
  paged about, which requires sessions long enough to walk away from.
- **`docs/specs/AgentOS-spec.md` should move out of `docs/specs/` entirely.** *Partly resolved
  2026-08-15* after PR review: the file now opens with a REFERENCE header stating it is not a queue
  item, carries no glyph deliberately, and names the source-of-truth order that supersedes its own
  *"build exactly this system"* framing. **That fixes the hazard, not the category error** — a
  reference document still sits in the directory that holds the *queue* role, which the Stage 6
  Overview parses across every watched repo. The clean endgame is `docs/reference/`. Unblocked by:
  Stage 6, which must in any case decide whether the queue parser skips glyph-less files; moving it
  then costs one directory and ~6 link updates, and removes the edge case instead of handling it.

### From the Tasks spec and round-3 design (2026-08-18)

- **A `pnpm dev` restart kills every running session.** D24 puts the run in the Next.js Node
  process, unawaited, so nothing survives a restart; spec §7.7's boot sweep marks the orphaned rows
  `interrupted` rather than leaving them claiming to run. **The honest behaviour, not the desired
  one.** Surviving a restart needs a supervisor process, which is what the cloud runner brings.
  Unblocked by: sessions long enough that losing one to a hot reload actually hurts — or the cloud
  runner (D20).
- **Nothing runs unattended until cron exists.** D24's funnel has four trigger kinds and only
  `manual` is built, so the executor cannot start work while nobody is watching. That is deliberate
  for the MVP and it is also the biggest functional gap against the source reference. Unblocked by:
  a task being run by hand on a schedule twice — same trigger as the existing cron entry above,
  which this one now depends on for its motive rather than its mechanism.
- **`design/wireframes2.pen` arrived untracked, and `pencil-new.pen` (1 MB) is at the repo root.**
  The second is the same Pencil autosave pattern this backlog already recorded once (*"stray
  `untitled.pen`"*, resolved by the file vanishing rather than by a gitignore rule). It vanished
  last time and came back under a new name, which is the argument for the rule. Unblocked by:
  deciding whether `*.pen` outside `design/` should be gitignored — one line, and it stops
  recurring.
- **The `blocked` chip has no lifecycle.** Spec §7.6 makes `blocked` a label with a
  `Task.blockedReason`, but nothing clears it: the reason is set by hand and stays until a human
  edits it. Fine for one project and a handful of cards. Unblocked by: a card whose blocker is
  resolved and whose chip lies about it — which is this product's own subject matter appearing on
  its own board, so it should be caught early.

### From the staleness fix (2026-08-18)

- **`pnpm verify:docs` — make a stale claim fail the suite.** The *Verified state* block
  (`docs/HANDOFF.md`) reduces the surface to one place; it does not detect when that one place is
  wrong. A small `scripts/verify-docs.mts` in `pnpm verify` would close it with two rules, both
  cheap and both precise: **(1)** every `#N` a doc describes as *open* is open per `gh pr view`;
  **(2)** every `N of M` suite claim matches what the suites actually report. **It must check, never
  rewrite** — a script that silently refreshes a doc is an auto-fix, and invariant 4 forbids those
  even when the target is our own repo. One caveat found while scoping it: **CI cannot run Stage 1's
  suite**, which reads the real watched repos and would find none; a hook or a local `verify` is the
  only place this can run. Unblocked by: the *Verified state* block itself going stale once — at
  which point the block was necessary but insufficient, and this is the missing half.
- **DC9 — a state document asserts a PR state that GitHub contradicts.** The real fix, and it is
  product scope rather than housekeeping. DC1 already checks the *frontier* claim (*"PRs #1 through
  #22 merged"*); DC9 would check **individual** PR-state claims (*"PR #6 is still open"*, *"not yet
  merged"*), which is the exact drift that bit this repo — and it generalises to every watched
  project rather than only to us. Same collector, same card, same confidence rendering; DC1's
  extraction guards (negation traps, `unmerged`) apply and would need extending. **Eating our own
  dog food is the argument**: the Board would have caught this on its own, on the surface the owner
  already opens. Unblocked by: Stage 3 shipping — DC9 is small, but adding a check now competes with
  the execution layer for the same attention, and the *Verified state* block holds the line meanwhile.

### From the shell inventory (2026-08-18)

- **`app/board.css` and CSS Modules will coexist indefinitely.** Stage 3a §5.2 leaves the Board's
  539-line global stylesheet alone and gives new surfaces CSS Modules, because rewriting working,
  dark-mode-verified CSS to prove a convention risks AC-1 for no behavioural gain. The cost is two
  styling idioms in one app, sharing tokens from `globals.css`. Unblocked by: the Board needing a
  real visual change anyway — convert it then, when the risk is already being taken.
- **`app/page.tsx` keeps its data-fetching shape after the component extraction.** Stage 3a moves
  `Row`, `FixSection` and `AckForm` out but deliberately does not touch the server action or the
  fix path (§5.3), so the page still both fetches and composes. Fine at one route. Unblocked by: a
  second surface needing the same data with a different composition — which is when the split earns
  itself rather than being asserted.

### From the Stage 3 build — wave 1 (2026-08-18)

- **`node:sqlite` is experimental and will print a warning in suite output.** D28 accepts it for a
  local-only tool with a declared engine floor, and confines it to `lib/agentos/db.ts`. The warning
  has not appeared yet only because no suite imports that file. Unblocked by: T5/T6 importing it —
  suppress narrowly at that point, never with a blanket `--no-warnings`. **Swap condition:** if the
  experimental API moves under us twice, or a second machine on older Node needs to run this,
  `better-sqlite3` behind the same accessors is a contained change.
- **`writeTaskTransition()` does not judge whether a transition is legal.** T1 built it to pair a
  status update with its `TaskEvent` atomically — which is what makes AC-10 mechanical — but §7.6's
  legality table and the `approvalGate` carve-out are enforced elsewhere (§3.4 puts the gate in the
  MCP handler). AC-19 says "rejected at the data layer", which could mean this function or
  `dispatch.ts`. Unblocked by: T5, where the ambiguity actually has to be resolved — the agent was
  right to flag it rather than guess.
- **Agent worktrees were provisioned from a stale commit.** Both wave-1 agents started on a branch
  pointing at `3ea05a0` — a pre-Stage-1 snapshot off `main` — rather than the branch they were
  spawned from. Both detected it, reset to the correct base, and reported it. Cost: nothing this
  time, because they checked. Unblocked by: it happening again — worth re-verifying the base commit
  at the start of any future agent brief.

### From the Stage 3 build — T3 (2026-08-18)

- **`@anthropic-ai/sdk` is a declared devDependency only because the Agent SDK's types need it.**
  `claude-agent-sdk`'s own `sdk.d.ts` imports `BetaMessage`/`BetaUsage` from it, so anything
  constructing a full `SDKAssistantMessage` — the scripted fake — needs it declared rather than
  transitively hoisted. It is **not** a second runtime SDK and must not become one; D-decisions
  §5.2 chose one package deliberately. Unblocked by: the Agent SDK inlining those types, at which
  point the dependency can go.
- **Stage 7's cost work will not find the token fields the spec named.** There are no
  `total_input_tokens` / `total_output_tokens` on the result message; the real shape is
  `usage: NonNullableUsage` plus a per-model `modelUsage` breakdown. §3.1 is corrected, but Stage 7
  is where it bites. Unblocked by: Stage 7.
- **The runner's smoke checks are not in `pnpm verify`.** `lib/agentos/runner/runner.smoke.mts`
  proves four properties and is run by hand. That is correct for now — T6 owns folding runner
  coverage into `verify:stage3` — but until then a regression in `composeOptions` would be silent.
  Unblocked by: T6.
### From the Stage 3a build (2026-08-18)

- **`pnpm verify` runs the Stage 1 and Stage 2 suites twice.** Stage 3a's AC-1 spawns them as a
  regression oracle — that is the point of it, and it is why they are *not* extended — but the
  aggregate `verify` also runs them directly, so a full run executes them once each on its own and
  once more inside AC-1. Costs a few seconds and no correctness. Unblocked by: the suites becoming
  slow enough to notice, at which point AC-1 can read a machine-readable result instead of
  spawning.
- **The `⌘1` shortcut is unverified by the suite.** It is a five-line client component and AC-7 is
  satisfied by loading a page and pressing the key. Automating it needs a browser driver, which is
  a dependency this repo does not have for one binding. Unblocked by: a second keyboard shortcut,
  or any other reason to add a browser test.
- **`/p/<slug>` uses the project's display name as its slug.** `slugFor` is identity today, which
  works because every watched name is already URL-safe. A project named with a space or a slash
  would break the route. Unblocked by: adding such a project — or D21's multi-repo work, which is
  the natural moment to give `ProjectConfig` an explicit slug.

### From the review of Stage 3a (2026-08-18)

- **`⌘1` collides with every browser's "switch to tab 1".** The shortcut comes from the round-3
  design (frame `B′2`) and is implemented as drawn, now with editable elements excluded so it cannot
  fire while someone is typing. But Chrome, Safari and Firefox all bind `⌘1`/`Ctrl+1` to the first
  tab, and this page calls `preventDefault()` on it. Many web apps do override it; it is still a
  real cost the design may not have weighed. Unblocked by: the first time you reach for tab 1 and
  land on the Board instead — at which point `g b` or `⌘⇧B` are the obvious alternatives, and it is
  a one-line change plus a wireframe note.

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

- **`verify:stage3a` AC-3 counts `boardOnce(` in raw source text, comments included** — found
  2026-08-19 while building Stage 3b T1. The check is
  `(src.match(/\bboardOnce\(/g) ?? []).length` ([`scripts/verify-stage3a.mts:128`](../scripts/verify-stage3a.mts#L128)),
  so a **doc comment** that names the function counts as a call site. T1 hit this from both sides
  at once: it genuinely added a second call, and its own explanatory comments tripped the check as
  well — and the passing fix was partly *rewording prose*. A check whose green can be bought by
  editing a comment is not asserting what it claims to. The constraint itself (D23 — one collector
  run per request, so the ribbon and the Board cannot disagree) is right and worth keeping; the
  measurement is what is wrong. Strip comments and string literals before counting, or parse.
  **Unblocked by:** nothing — it is a contained change to one suite, deliberately not made inside a
  ticket forbidden from touching that file.

## Done / superseded

<!-- Move items here when resolved (with the resolution) or dropped (with why), rather than
     deleting them. -->

- **`CLAUDE.md`'s top status paragraph was stale** — reported by T4, which correctly could not fix
  it (`CLAUDE.md` was outside its file scope), and **resolved 2026-08-19 by lead review**, which was
  not. It had claimed *"Next build step: Stage 3"* with Stage 3, 3a and 3b all built, and cited two
  owner gates cleared on 2026-08-18 as D27. Rewritten against `docs/HANDOFF.md`'s own "Where things
  stand", with the two genuinely-unmet acceptance criteria named as the owner gates they are.

- **Nothing connects an `agentos.yml` on disk to a `Project` row in `data/agentos.sqlite`** —
  resolved 2026-08-19 by Stage 3b T1–T4. T1 built the connector (an explicit *Initialize* button,
  D30); T2/T3 built agent and task creation behind it; T4's **AC-9** proves the whole cycle —
  dispatch → pause → resume → review → approve — runs end to end against fixtures. Still open:
  **no human has run it on a real project** (`docs/HUMAN-TEST.md` Part 7, added by T4) — that
  remains an owner gate, not a code gap, and is tracked in `docs/HANDOFF.md`'s *Next up* rather
  than here.
- **`runBootSweep` has no call site** — resolved 2026-08-19 by T7. `instrumentation.ts` calls it
  once per server process, passing `dispatch.ts`'s own `PROCESS_BOOT_ID`. Verified against a real
  boot rather than a fixture: with a stale `running` session seeded, starting the server logs
  `[agentos] boot sweep: interrupted 1 session(s) …` and the row reads `interrupted` afterwards.
- **T6's AC-6 must cover resuming a session whose teardown failed** — resolved 2026-08-19 by T6.
  AC-6 drives both the clean pause and the case where `worktreePath` is non-null, proving
  `resumeSession` clears the stale worktree before `createWorktree` reuses the same
  session-id-derived path.

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
