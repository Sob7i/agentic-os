# Agentic OS — Learnings

Durable, hard-won lessons. Append with a date; prune when obsolete or **promoted** — a lesson
that has bitten twice must graduate into a standing rule or a gate in `CLAUDE.md`, not stay a
note that gets re-read and re-ignored. One line each; if it needs a paragraph, it probably
belongs in `docs/DECISIONS.md` instead.

## Docs & claims

- (2026-07-27) **The PRD claimed itqan was installed while not one role file existed.**
  `docs/PRD.md` §4 listed agentic-os with "all seven (self-installed)" and §8 asserted the
  install as fact, written 2026-07-26; the repo held only `PRD.md`, `DESIGN-BRIEF.md`,
  `wireframes.pen`, and `.gitignore`. The owner caught it by asking "did you actually install
  itqan?" — a human doing, by hand, exactly the check this product exists to automate. **A
  planned thing written in the present tense becomes a false claim the moment someone reads it.
  Write intent as intent.**
- (2026-07-27) **The round-1 wireframes invented a document to create a drift example.**
  Concept C's salla-apps card quotes `docs/STATE.md` saying "Working tree clean; ready to ship";
  no such file exists, and the same wireframe's roster row correctly shows salla-apps as
  Router-only. Plausible-looking placeholder content passes review precisely because it looks
  right. **When a brief says "use real data", every string is a claim — check the ones that are
  convenient.**
- (2026-07-27) **Our own reference table drifted within 24 hours, twice over.** `docs/PRD.md` §4
  recorded salla-apps as "Router only" — it actually has a 467-line `CLAUDE.md`, 13 specs,
  `MISTAKES.md` + `KNOWLEDGE.md`, and a 309-line `CHANGELOG.md`: a *full*-profile install missing
  only its State role. Cause: the survey checked lite-profile paths only. Separately,
  fractal-code's branch and commit age changed the next day. **Two rules from one finding:**
  role detection must check full-profile alternates, and **live facts (branch, dirty count, age)
  must never be hardcoded in a document** — compute them or omit them.
- (2026-07-27) **A superseded design frame kept the obvious name while its replacement was
  called "v2".** `design/wireframes.pen` holds both a round-1 `Fix Proposal` (a multi-line prose
  rewrite, which D15 forbids) and the correct `Fix Proposal v2 — Fixable (DC1)`. A builder
  reaching for the obvious name would implement the thing the spec prohibits. **When a design is
  superseded, rename the old one — supersession has to be visible at the point someone reaches
  for it**, not only in a rationale note beside it. (itqan's supersede ritual, applied to design
  files rather than docs.) *Resolved 2026-07-27: renamed to `SUPERSEDED (round 1) — Fix Proposal ·
  violates D15, do not build`.*
- (2026-07-27) **The wireframe cited the wrong line, and only building it found out.** `Fix
  Proposal v2` places nadim's PR claim on `docs/HANDOFF.md · line 24`; the running collector puts
  it on **line 15**, inside a 600-character bullet, not the tidy two-line snippet the mockup drew.
  The design's shape held up — full line, flagged date — but its *content* was a plausible
  reconstruction. **A wireframe built from real data is still a claim about real data.**
- (2026-08-15) **The same change that documented a red test suite left "19 passing" in the State
  doc — twice.** Running `pnpm verify` found AC-2 failing; that got written into `CLAUDE.md` and a
  blocking `BACKLOG.md` entry in the same commit, while `docs/HANDOFF.md` kept *"19 passing as of
  this commit"* in "Where things stand" **and** *"should print 19 passes"* in "How to pick up". A PR
  reviewer caught one of the two. **This is not staleness — the correct value was known and written
  down minutes earlier.** The cause is treating "update the docs" as a checklist of files rather
  than a **search for the claim**: the paired-docs rule says *which* files move together, and says
  nothing about finding every place a number was asserted. **When a fact changes, grep for the old
  value before editing anything** — `19 passing` would have found both in one second. Doubly true
  for a State doc, whose whole job is to be believed by the next session.
- (2026-08-15) **The router contradicted itself in the same file and nobody read past line 12.**
  `CLAUDE.md` opened with *"Status: pre-code… no application code exists yet"* while its own
  Commands table 80 lines below documented `pnpm verify` running 19 acceptance checks against
  shipped Stage 1 and Stage 2 code. Both statements were written by sessions that only edited
  their own section. **The status line of a router is the most-read and least-maintained line in
  a repo — it is the one place a stale claim is guaranteed to be believed.** Sessions 1–2 updated
  `HANDOFF.md` and `FEATURES.md` faithfully and left the router untouched; the session-end
  checklist named neither. Caught 19 days later by a session reading the file cold.
- (2026-08-18) **Not all staleness is the same kind, and the cheap kind should not trigger the
  expensive reaction.** This session found `docs/HANDOFF.md` still saying PR #6 was open three days
  after #6, #7 and #8 all merged. That is **predicted** staleness — the file's own "trust but
  verify" banner names merged PRs as the exact thing that goes stale silently, `gh pr list` found it
  in one second, and the fix was three bullets. It is a different animal from the *"19 passing"*
  entry above, where the doc **asserted a number that was already known to be wrong**. The first
  costs a minute; the second costs the next session's judgement. **Worth keeping separate, because
  treating every stale line as a process failure is how a real process failure stops standing out.**
- (2026-08-18) **Applying a good rule one instance at a time is how you keep re-finding it.**
  *"Live facts must never be hardcoded in a document; compute them or omit them"* has been in this
  file since 2026-07-27, and since then it has been applied to the PRD's reference table, then to
  HANDOFF's board-state bullet, then to an acceptance test, then to two "19 passing" claims, then to
  a PR-state claim that survived in **three places across two files**. Every application was
  correct; every one was retail. **The rule was never given a mechanism** — a single place where
  volatile facts live, so that "update the volatile facts" is one edit and one check instead of a
  search. Fixed 2026-08-18 with `docs/HANDOFF.md`'s *Verified state* block and a `CLAUDE.md`
  convention forbidding restatement elsewhere. **A lesson that keeps recurring is not a lesson
  anyone forgot — it is a lesson with no mechanism attached.** *Postscript, same day:* the commit
  that introduced the convention **violated it three times** — a suite count in `CLAUDE.md`'s
  command table (self-caught), and a *"`pnpm verify` is RED"* status in `HANDOFF.md` plus a
  *"has one known failure"* in `CLAUDE.md` (both caught by a reviewer). **A convention is not in
  force over the change that introduces it** unless you re-read that change against it — writing the
  rule feels like compliance, and it is not.
- (2026-08-18) **I briefed a builder with a fact that was true on a branch it could not see.**
  The Stage 3 tickets told an agent that `pnpm verify` "deliberately runs every suite and sums exit
  codes" and that "Stage 3a's 8 checks must stay green". Both were true — on `feat/stage-3a-shell`,
  an **unmerged** branch. The agent worked from `develop`, where `verify` still short-circuited and
  no Stage 3a suite existed; it correctly reported the contradiction rather than trying to satisfy
  it, and independently rediscovered the same `&&` short-circuit bug already fixed on the branch it
  could not see. **Writing instructions from a working tree ahead of the reader's is the drift this
  product detects, aimed at a colleague instead of a document.** Before briefing anyone — human or
  agent — say which commit the instructions are true *at*, and check them against that commit
  rather than against your own checkout.
- (2026-08-18) **Some facts cannot be written down at all, because writing them down changes
  them.** The new *Verified state* block opened with `Open PRs | none`, which was true when
  `gh pr list` returned `[]` and false twenty minutes later — falsified **by the pull request that
  carried the block**. A PR reviewer caught it. Every future PR would do the same, so no amount of
  care fixes it: the row can only ever name its command. **This is a third category** beside the
  predicted and asserted staleness above — not a value that rots on someone else's schedule, but one
  whose own recording is the event that invalidates it. Before writing a fact into a doc that ships
  through review, ask whether shipping it is one of the things that could make it false.
- (2026-07-26) A doc that references a sibling section by number (`"the brief for §6.1–6.4"`)
  goes stale the moment a section is added. Prefer naming the thing over numbering it, or
  accept that the pair must be re-read on every edit.

## Code

- (2026-08-18) **A guard that never ran because its own inputs made it a no-op.** Stage 3's
  worktree module stored the caller's `baseRef` verbatim and read commits with
  `git log <baseRef>..HEAD`. Called the obvious way — `baseRef: "HEAD"` — that compares the
  worktree's current HEAD against itself and reports **nothing**, so a session that committed would
  have recorded no commits at all. AC-2 and AC-9 both passed throughout, because **neither of them
  commits anything**; it surfaced only when a new check made a run commit *and then crash*.
  **A symbolic ref is a question, not an answer: resolve it to a sha at the moment of capture**, or
  the record silently describes a different repository state than the one you meant.
- (2026-08-18) **An aggregate that short-circuits hides every suite after the first failure.**
  `pnpm verify` was `verify:stage1 && verify:stage2`, and Stage 1 has had a known, logged failure
  since 2026-08-15 — so **Stage 2's eleven checks had not run in the aggregate for three days**, and
  nobody noticed because `verify:stage2` was being run by hand each time. It only became visible when
  a third suite was added and also never ran. **A red test that suppresses other tests converts one
  known failure into unknown coverage.** Aggregates run everything and sum the exit codes; `&&` is
  for dependent steps, not for independent checks.

- (2026-07-27) **A safety guard took its bounds from the thing it was guarding.** Stage 2's path
  confinement computed the allowed write targets as *"the state doc named by this proposal, plus
  the project's lessons file"* — so a proposal naming `README.md` as its state doc had `README.md`
  allowed. The acceptance test still passed, because the content hash refused the write further
  down; only reading *which guard fired* exposed it. **Two rules:** a guard must derive its bounds
  independently of its input, and a test must assert which guard rejected, not merely that
  something did. Fixed by resolving both targets from the repo's own role detection.
- (2026-07-27) **The JSX-newline bug bit a second time** — `write {n} file\n{n === 1 ? "" : "s"}`
  rendered as *"2 file s"*, the same shape as Stage 1's *"contradict s reality"*. Twice is a rule,
  not a note: **promoted to `CLAUDE.md` §Conventions.** Interpolate complete strings; never let a
  line break fall between text and an expression that continues the same word.

- (2026-08-24) **A `null` sentinel meant two different things one column apart, and only one of
  them had a name.** `command.ts`'s `CommandResult.exitCode` is `null` for two unrelated reasons —
  the caller declared no such key at all, or the process was declared and never produced an exit
  code (this module's own timeout fired, or the executable could not spawn). `dispatch.ts` wrote
  that `null` straight onto `Session.verifyExitCode` for both, which collided with a THIRD, older
  meaning already living on that exact column: "no `verify:` key configured." A `verify:` that hung
  would have read identically to a project with none declared, and Stage 4b's push gate (which
  refuses only on a non-null, non-zero `verifyExitCode`) would have let unverified work through
  in exactly the case it was built to catch. Found by writing the seam's own doc comment
  (`command.ts`'s `exitCode` field) side by side with the column's doc comment
  (`types.ts`'s `SessionRow.verifyExitCode`) and noticing they used the same value for different
  claims. **Fix:** never let a lower-level "no result" propagate unchanged into a column that
  already overloads its own `null` for something else — translate it into a sentinel the column
  cannot already mean (`VERIFY_DID_NOT_COMPLETE = -1`, impossible for a real process exit code,
  which is always 0–255). **The general shape: when a value crosses a layer boundary, check
  whether the layer it lands in already has a meaning for the value it's about to receive — two
  honest "unknown"s from two different sources are not the same fact.**

## Verification

- (2026-08-18) **A spec section that boasted "verified, not assumed" was verified against the wrong
  artifact.** Stage 3 §3.1 tabulated the Agent SDK's surface and said explicitly that it was fetched
  rather than recalled. It was fetched — from the **documentation**. When an agent finally installed
  the package and read its `.d.ts`, three rows were wrong: `canUseTool`'s signature was materially
  different, `query()` returned a `Query` object rather than a bare generator, and the token fields
  named in the table **do not exist**. **Documentation is a claim about an API; the package is the
  API.** The project's own rule — `external-API-fields-are-guilty-until-verified` — was satisfied in
  form and missed in substance, because "verified" was allowed to mean "read somewhere reputable"
  instead of "checked against the artifact that will run".
- (2026-08-18) **A test that fed itself the answer.** T3's check that `WebFetch`/`WebSearch` stay out
  of an agent's tools passed an `Agent` row that already excluded them — so it asserted its fixture,
  not any behaviour, and would have kept passing if the code had simply forwarded configuration
  (which it did). This is Stage 1 AC-2's *specimen-not-behaviour* failure in a new costume, found
  in review rather than by the suite. **Two fixes, and the second matters more:** the check now
  feeds a *hostile* row that asks for both denied tools, and the exclusion became a floor in code.
  **An invariant enforced only by seed data is enforced by nobody.**
- (2026-08-18) **A structural check that only knew one spelling of the thing it forbade.** Stage
  3a's AC-3 asserts nothing imports `buildBoard` except the cached accessor, and matched module
  specifiers containing `reconcile/board`. A file *inside* `lib/reconcile/` writing
  `import { buildBoard } from "./board"` would have passed — the one directory where that spelling
  is the natural one. Caught by review, and confirmed by writing the violating file and watching
  the check stay green. **A guard is only as wide as the syntax it recognises; prove it by
  committing the sin and watching it fail.**

- (2026-08-18) **A structural guard that read the git index instead of the disk.** Stage 3a's AC-3
  asserts nothing imports `buildBoard` directly, and enumerated files with `git ls-files` — which
  lists only **tracked** files. A newly written module doing exactly the forbidden thing would have
  passed until someone committed it, meaning the check was weakest at the moment it mattered most:
  while the mistake was being made. Noticed only because the reported file count jumped from 13 to
  27 after a commit, and the number looked wrong. **A guard over source must walk the source, not
  an index of it** — and a check that prints what it scanned is how you find out it was scanning
  the wrong thing.

- (2026-08-18) **A test asserted a framework's behaviour outside the runtime that provides it.**
  Stage 3a's AC-3 checked that the ribbon and the Board share one collector run by calling React's
  `cache()` three times in a plain Node script and asserting one execution. It saw three: `cache`
  dedupes within a React render pass, and a script has none. **The test failed while the app was
  correct** — the failure mode that teaches people to delete checks. Rewritten to assert the import
  graph instead (nothing imports `buildBoard` except the cached accessor; no module calls it twice),
  which is a property of *our* code rather than of React's. **The same correction had been forced on
  Stage 3's AC-14 by a reviewer an hour earlier**, and I made the identical mistake anyway — which
  says the lesson is not "grep is brittle" but **assert what you own, not what your dependency
  promises.**

- (2026-08-15) **An acceptance test hardcoded the weather and failed 19 days later.** Stage 1's
  AC-2 asserts *"itqan is green"* by name; itqan simply stopped committing, DC7 correctly fired at
  25 days, and `pnpm verify` went red with **nothing wrong**. We already knew this rule — *"live
  facts (branch, dirty count, age) must never be hardcoded in a document"* is three entries above,
  learned from the PRD's own reference table — **and did not think to apply it to a test.** A test
  asserting a fact about a live external repo is a document making a claim about reality, subject
  to exactly the same rot, and it fails *closed*: a red suite trains you to ignore the suite.
  **Assert the behaviour (a green row is reachable), not the specimen (itqan is that row).**
- (2026-07-26) **The dataviz palette validator contradicted a reasonable-looking inheritance.**
  itqan's accent trio was adopted for status colours by eye; the validator then failed it twice
  — light teal `#0f766e` sits below the chroma floor (0.086 < 0.10, reads gray to some viewers)
  and all three dark values fall outside the dark lightness band. **A palette that looks fine is
  not a validated palette. Run the script.**
- (2026-07-26) The `dataviz` validator only auto-runs in a browser (it reads `data-palette` off
  `<body>`); from Node it must be imported and `validate()` called directly, and it needs an
  `.mjs` extension or an ESM package. Its report rows are `[name, state, detail]` where `state`
  is `true`/`false`/`"pass"`/`"floor"`/`"fail"` — not a plain string.

- (2026-08-18) **A tool name that satisfies MCP's registration is not the same claim as satisfying
  the model API's charset — and only one of those two boundaries the suite can reach.** The Stage 3
  spec named its MCP tools `task.read`, `inbox.ask` and so on. Dots register fine at the MCP layer
  (verified: the server keeps them verbatim), but the Messages API's tool-name field is
  `^[a-zA-Z0-9_-]{1,64}$`. The trap is the *reason it stayed invisible*: §3.3 deliberately has the
  acceptance checks call the handler and `canUseTool` **directly**, because that is the only way to
  prove the handler refuses independently — with the consequence that **no check in the suite
  crosses the model API boundary at all**, so the one place the constraint is enforced is the one
  place nothing looks. It would have surfaced at the first real dispatch. **When a test seam is
  chosen to bypass a boundary, write down what that boundary was still validating** — and assert it
  structurally instead (`AC-5b`). Closed as D29.

- (2026-08-18) **Four sub-agent waves, four acceptance checks that passed for the wrong reason —
  and not once did the agent that wrote the check catch it.** T1/T2: `withWorktree` recorded no
  commits while AC-2 and AC-9 stayed green, because neither commits. T3: the WebFetch check was fed
  a fixture that already excluded the tools it was checking for. T4: `canUseTool` would have matched
  a bare tool name and never fired, with AC-5 still passing because the second layer refuses on its
  own. T5: AC-14 matched named imports only, so a namespace import bypassed the very funnel it
  exists to protect. **The agents are reliably good at finding contradictions between a document and
  the code, and reliably weak at a test that is green for the wrong reason** — the two are not the
  same skill, and only the first is something reading carefully can catch. **Consequences, both
  now standard practice here:** specify the *shape of each assertion* in the ticket brief rather
  than naming the criterion, and **require every new structural check to be proved by making it
  fail** — write the bypass, watch it go red, delete it, and report the failure message. A check
  demonstrated only in the passing direction has demonstrated nothing.

- (2026-08-19) **Briefing an agent with *how the last two tickets failed* worked where briefing it
  with the criterion had not.** Five Stage 3 tickets and then Stage 3b's T1 and T2 each shipped at
  least one check that was green for the wrong reason, and none was self-caught — through briefs
  that already said "prove every check by making it fail." T3's brief instead named the two
  specific misses (*T1's parser could be deleted whole with three checks still green; T2's
  ownership guard could be deleted with three checks still green*) and asked for two concrete
  probes by name: delete every value you write, delete every guard you wrote. T3 ran them, found
  that its own cross-project assignee check had no coverage, and **added the missing check itself**
  — the first time an agent here closed this class before review did. **The generalisation: a
  quality bar stated as a principle is advice; the same bar stated as two failures and two probes
  is a procedure.** Keep briefs carrying the previous two concrete misses rather than the rule they
  generalise to.

- (2026-08-19) **"No test can reach it" is a claim about where the code is, not about what can be
  tested.** T3 built AC-7's *"Run now is absent, not disabled-looking"* correctly, as a ternary in
  `components/tasks/Board.tsx`, and then reported the behaviour as untestable — verifying first,
  correctly, that no acceptance script in this repo imports a component. Both halves were true and
  the conclusion was still wrong: `lib/tasks/model.ts` was already in the ticket's own file list,
  and CLAUDE.md already says a decision that can be wrong belongs in the pure model rather than a
  dumb component. **When a behaviour looks untestable, the first question is whether it is in the
  wrong file, not whether the harness needs extending.** The move cost four lines. → `showsRunControl`,
  asserted by **AC-7b** — which also checks that the component *delegates* to it, because a pure
  function that is correct, asserted and unused is the T7-2 failure exactly.

- (2026-08-19) **A correctly-written authorization guard with no adversarial fixture is
  indistinguishable, to the suite, from no guard at all.** Stage 3b T2 wrote its cross-project
  ownership check exactly right — `agent.projectId !== owned.project.id`, refusing a crafted post
  that names another project's agent. Review deleted it and **all three of the ticket's checks
  stayed green**, because AC-4, AC-5 and AC-8 each operate on an agent that legitimately belongs to
  the project in the form. The guard is the only thing between a form post and rewriting another
  project's agent — its tool grants and `canCommit` included. This is the *third* appearance of the
  same shape in this codebase and the first where the code was already right: T7 shipped **three**
  server actions missing the check entirely and review found all three; the Stage 3 spec had warned
  about it in advance; T2 then wrote it and nothing exercised it. **The rule: a guard is not covered
  by a check that never violates it.** Every authorization boundary needs a fixture that is
  *hostile by construction* — a second project, a foreign id, a value outside the offered set — and
  the check must assert both the refusal **and that the protected row is unchanged**, because a
  refusal that still writes is the worse bug. Same reasoning the spec already applies to the egress
  floor (*"an invariant enforced only by seed data is enforced by nobody"*), applied to
  authorization. → **AC-8b**.

- (2026-08-19) **"Two independent lists that must agree" is a second source of truth wearing a
  justification.** T2 needed the egress-denied tool list at write time; the existing copy at spawn
  time (`runner/local.ts`) was private to a function and its file was outside the ticket's blast
  radius, so the ticket declared a second `EGRESS_DENIED_TOOLS` and wrote a careful comment calling
  the duplication *"the accepted cost of a floor that holds at both write time and spawn time."*
  The reasoning about **two enforcement points** was right and both are still there. The error was
  concluding that two enforcement points need two lists. **Divergence here is silent and the
  boundary is a security one** — invariant 1's carve-out is the model API, not the internet.
  **The tell:** a comment that argues for a duplication is a duplication that needed arguing for.
  When a ticket's file list is what forces the copy, that is a finding to report, not a constraint
  to design around — the lead can widen a file list, and did. → `lib/agentos/egress.ts`, one
  definition imported by both, asserted by **AC-5b**.

- (2026-08-19) **A cleanup step awaited before the write that records the outcome can strand the
  record it was supposed to complete.** `dispatch` did `await removeWorktree(wt)` and *then*
  `updateSession({status, endedAtISO, failureReason})`. `removeWorktree` throws when `git worktree
  remove` and `git worktree prune` both fail — so a teardown failure left a `Session` row saying
  `running` with no end time and no reason: **exactly the stored-claim-contradicted-by-reality this
  product exists to catch, occurring inside it**, and invisible until the next restart. AC-2 and
  AC-9 both passed throughout, because both assert the *successful* teardown path. **The rule:
  cleanup is best-effort; the record of what happened is not.** Write the outcome first or catch
  around the cleanup, and when cleanup fails keep the handle to whatever was not cleaned up —
  nulling `worktreePath` would have discarded the only pointer to the directory left behind.
  Found by review on #14, not by the suite.

- (2026-08-19) **Stage 1's suite is not hermetic, and two other suites hard-assert its exact pass
  count.** Stage 1's AC-1 asserts nadim carries `drift`; that verdict comes from **DC1, which needs
  a live `gh` call**. With GitHub unreachable or rate-limited, DC1 cannot produce the finding, nadim
  degrades to `attention`, and the suite returns **6P/2F** — for reasons with nothing to do with the
  branch under test. Reproduced deliberately by putting a failing `gh` on `PATH`: the failure is
  exactly `AC-1 — nadim severity is attention, expected drift`, the message T6's agent had seen
  twice and could not explain. **The consequence is not the flake; it is what a flake teaches.** A
  check that cannot distinguish *"the thing I test broke"* from *"the network was down"* gets
  ignored — which is precisely what already happened to Stage 1's own AC-2, and the reason a red
  suite here no longer alarms anyone. **So an oracle over a non-hermetic suite reports SKIP on a
  degraded upstream, never FAIL**: silence is honest, a false red is not. Done for `AC-11`;
  `verify-stage3a.mts`'s AC-1 has the identical exposure and is logged in `docs/BACKLOG.md`.

- (2026-08-19) **Never `JSON.stringify` a `RunParams` in a failure message.** It carries live SDK and
  MCP server objects with circular references, so the stringify **throws instead of printing** — and
  it throws on the failure path, meaning the suite crashes at exactly the moment it was trying to
  tell you what went wrong. Stringify the two or three fields the assertion is about. Found by T6's
  agent while proving AC-6 by breaking it — the failure path was only exercised *because* the
  prove-by-breaking rule forced it, which is a small argument for that rule on its own.

- (2026-08-19) **Next compiles `instrumentation.ts` for an edge target even with no edge routes, and
  `export const runtime = "nodejs"` does not stop it.** On Next 15.5 in `next dev` — *not* `next
  build`, which already tree-shakes the dead branch — the edge compiler walks that file's whole
  import graph and fails on every `node:`-prefixed builtin it finds (`UnhandledSchemeError`), one at
  a time, turning **every route into a 500**. The `NEXT_RUNTIME` guard inside `register()` gates
  *execution*, not compilation, so it is correct and insufficient. Fixed with a `webpack.externals`
  rule in `next.config.mjs` externalizing **all** Node builtins for the edge target — all of them
  rather than a hand-kept list, because the failures surfaced one per rebuild as the import graph
  grew. **The point worth keeping: `pnpm build` passing is not evidence that `pnpm dev` runs.** This
  was only ever going to be found by starting the server, which is why T7's brief asked for the page
  to actually be loaded.

- (2026-08-19) **Booting the portfolio was creating the execution layer's database.**
  `instrumentation.ts`'s boot sweep called `getDb()`, and `openDb` does `mkdirSync` + `migrate` — so
  merely opening the Board on a machine with **no** project opted in materialized a 110KB
  `data/agentos.sqlite`. Not an invariant-5 violation (the file has no rows, so nothing is
  *stored*), but D19 asks for the layer boundary to be **real in code**, and one layer starting up
  should not conjure the other's store. With no store there are no sessions, so the sweep is a
  guaranteed no-op — the fix is to skip when the file does not exist, which costs nothing.
  **A side effect that only shows up on a clean machine will not show up in review**; this was found
  by deleting `data/` and booting, not by reading the diff.

- (2026-08-19) **`git merge-file --union` silently eats a shared closing delimiter, and the result
  type-checks.** Merging four stacked Stage 3b branches that each append checks to one suite file
  produced the spurious conflicts the stacking rule predicts — every hunk resolved to "keep both".
  Union is the correct driver for that, and it got the content right twice; both times it also
  dropped one `}`, because the two sides ended with the identical `}` + blank line at the same
  offset and a line-based union cannot tell a **shared closing delimiter** from duplicated content.
  **The failure is quiet in the worst way:** `pnpm type-check` passed — `tsc` reads `.ts`, the
  suite is `.mts` and only tsx transforms it — so the first symptom was a runtime
  `Unexpected end of file` with *zero* checks run and *zero* reported. Two hand-resolutions before
  reaching for the union driver each produced the same shape from a different mistake.
  **Two rules.** After any union merge of a file built from repeated same-shaped blocks, **count
  braces** (`sum of "{" minus "}"` must be 0) and **count the checks that actually ran** against
  what the branches contributed — a suite that reports 0 PASS and 0 FAIL has not passed, and the
  summary line is what says so. And: **`pnpm type-check` does not cover `scripts/*.mts`**, which is
  worth knowing on its own.

- (2026-08-19) **A scripted edit that slices between two anchors deleted 50 of 61 backlog entries,
  and nothing caught it for two commits.** Moving one item in `docs/BACKLOG.md`, the edit took
  `s[:start] + s[end:]` where `start` was the entry to move and `end` was the next entry it
  expected to follow. The two were **323 lines apart**, with the `## Done / superseded` heading and
  fifty unrelated entries between them. The file still looked structurally fine — one heading, a
  list of entries — so a glance at the result showed nothing wrong, and it survived a commit, a
  push, and a merge into another branch. It surfaced only because a reviewer asked why a resolved
  item sat under *Open*: **the heading was gone, so everything was under Open.**
  **The rule: a text edit that removes a range must assert what it is removing.** Count the items
  before and after and refuse if the count moved by more than intended, or bound the slice to the
  entry (*"refuse to cut more than N lines"*). Both are one line. Anchoring on `s.index(next_thing)`
  is only safe when the two anchors are known to be adjacent, which is exactly the thing the code
  does not check. Same class as `verify-before-claim`, applied to an edit rather than a claim: the
  edit asserted "these two anchors are adjacent" and never ran the check that would falsify it.

- (2026-08-19) **`git merge-file --union` silently eats a shared closing delimiter, and the result
  type-checks.** Merging four stacked Stage 3b branches that each append checks to one suite file
  produced the spurious conflicts the stacking rule predicts — every hunk resolved to "keep both".
  Union is the right driver for that, and it got the content right both times; both times it also
  dropped one `}`, because the two sides ended with the identical `}` + blank line at the same
  offset and a line-based union cannot tell a **shared closing delimiter** from duplicated content.
  **The failure is quiet in the worst way:** `pnpm type-check` passed — `tsc` reads `.ts`, the suite
  is `.mts` and only tsx transforms it — so the first symptom was a runtime `Unexpected end of file`
  with *zero* checks run and *zero* reported. Two hand-resolutions attempted before reaching for the
  union driver each produced the same shape from a different mistake.
  **Two rules.** After any union merge of a file built from repeated same-shaped blocks, **count
  braces** (`"{"` minus `"}"` must be 0) and **count the checks that actually ran** against what the
  branches contributed — a suite reporting 0 PASS and 0 FAIL has not passed, and the summary line is
  what says so. And separately, worth knowing on its own: **`pnpm type-check` does not cover
  `scripts/*.mts`.**

- (2026-08-19) **A ticket's own file-scope restriction is enforced by the harness, not just the
  brief — plan probes accordingly.** Stage 3b T4's brief forbade touching any `lib/` or `app/` file
  and asked for a delete-a-guard probe in the same shape T2's review had used: edit the production
  file, watch the check redden, revert. The Edit tool refused the very first attempt, against
  `lib/agentos/mcp/agentos-server.ts`, with a permission denial naming the scope. Earlier tickets'
  probes (T1's parser, T2's ownership guard, T3's assignee check) were run during **review**, which
  carries no such restriction — T4 is the first ticket where the probing itself had to happen inside
  the restriction. The fix was a throwaway harness (deleted before finishing, never committed) that
  imports the same production functions **unmodified** and substitutes the one broken step directly
  — reproducing byte-for-byte the database state a real regression would leave, without editing the
  file the regression would have been in. **The generalisation:** when a ticket both forbids editing
  a file and needs to prove a check would catch a defect in it, the probe has to construct the
  broken *output* through injection at a seam, not by breaking the *source* — the same substitution
  principle `Runner`/`FakeRunner` already use for the SDK, one level down.

## Tooling

- (2026-07-27) **`.pen` files (Pencil) are plain UTF-8 JSON** — readable directly with any JSON
  parser, no MCP server and no authentication required. Structure: `{version, children[],
  themes, variables, fileToken}`; text lives on `content`, colours reference theme variables as
  `$name`. A failing Pencil MCP connection does not block reading or auditing a design file.

- (2026-08-18) **A good general-purpose skill can still be wrong for a project, and the reason was
  in its last step.** `/to-spec` (a personal skill) produces a solid template — problem, solution,
  user stories, implementation and testing decisions — and **publishes it to an issue tracker with a
  `ready-for-agent` label**. Adopting it wholesale would have put the queue in a tracker while
  `docs/specs/` also held it: **invariant 5, violated by the tool meant to help.** The useful half
  was its step 2 — *sketch the seams you will test at; prefer existing seams; the ideal number is
  one* — which our spec template has no slot for even though Stage 3 does it implicitly (the
  injectable `Runner`). **Evaluate a skill by what it does at the end, not by its template.**

- (2026-08-18) **Every sub-agent worktree was provisioned onto a base predating the entire build,
  and the cause was structural, not luck.** Four agents in a row started at `3ea05a0`. The isolated
  worktree option branches from **`origin/main`**, and this project's workflow says `main` receives
  only `develop`, only from the owner — so while `main` lags, *every* auto-provisioned agent starts
  before Stage 1 exists. Three earlier agents built against it anyway; the fourth stopped because
  its brief told it to check the sha first. **Fix: create the worktree by hand from `develop` and
  hand the agent the path**, and give the brief a second, cheaper base check than a sha comparison
  (`ls lib/agentos/` — a missing directory is a faster tell than a matching hash). A base check in
  the brief is worth more than it looks: it is the only thing that turned a silent wrong build into
  a two-minute correction.

- (2026-08-18) **`tsx` runs `.mts` and `.ts` through two different module registries, so shared
  module-level state silently duplicates.** This repo has no `"type": "module"`, so an `.mts`
  acceptance script loads as native ESM while every plain `.ts` it imports resolves through tsx's
  CommonJS-compat path. A top-level `import { PROJECTS } from "../projects.config"` in the script
  and the same array as reached from `lib/`'s own import chain are **two different array objects** —
  confirmed by identity check, and by splicing one and observing the other unchanged. A fixture that
  swaps the project list to isolate a test therefore mutates a copy nothing under test can see, and
  the test passes or fails for reasons unrelated to its subject. **Fix:** reach shared state from an
  `.mts` script via `createRequire(import.meta.url)("../module")`, which puts it on the same
  registry as `lib/`. Found while building T5's AC-17 drift fixture.

## Workflow

- (2026-08-18) **Two branches off the same base both had to edit the same four files, and every one
  of them conflicted.** Merging #11 (Stage 3a) then #12 (Stage 3) produced conflicts in
  `package.json`, `HANDOFF.md`, `LEARNINGS.md` and `BACKLOG.md` — **and not one of them was a real
  disagreement.** Both branches wanted their suite registered; both appended a lesson; both added
  backlog entries; both updated the state table. Git could not tell that "keep both" was always the
  answer, because each edit landed at the same anchor point.
  **Two distinct causes, and they need different fixes.**
  *(a) A hand-maintained list two branches must both edit is a conflict waiting for a second
  branch.* `package.json`'s `verify` chain named its suites; adding one meant editing a shared
  line. **Fixed structurally** — `scripts/verify-all.mts` now *discovers* suites from the
  `verify:*` script keys, so a new stage adds one entry and never touches the aggregate again.
  *(b) The hub documents are append-at-a-fixed-anchor by design*, so parallel branches collide
  there by construction. That one has no clean structural fix — the mitigation is sequencing:
  **branch stages off each other rather than off `develop` when both will touch the hub docs**, or
  accept the conflict and resolve it with "keep both", which is what it always is.
  **The tell that a conflict is spurious: every hunk resolves to a union.** If you find yourself
  choosing, look harder — that one is real.

- (2026-07-27) The first three commits landed directly on `main` before the branch model was
  decided (D13). `develop` was branched from that point so history stayed consistent — but the
  decision should have been closed *before* the first commit, not after the third.

- (2026-08-21) **Two regression oracles went red because a known failure got fixed — and we caused
  the fix from another repo.** Stage 1's AC-2 asserts *"itqan is green"*; itqan's last commit was
  2026-07-19, so DC7 correctly reported it stalled and AC-2 had been failing for weeks. On
  2026-08-20 we pushed a rules change **to itqan**, which un-stalled it, so AC-2 started passing and
  Stage 1 went `7P/1F → 8P/0F`. Both `verify:stage3` **AC-11** and `verify:stage3a` **AC-1** pin
  Stage 1's expected result as the literal `7P/1F`, so **both failed on the improvement.**
  Three things are worth separating here. **An oracle that pins an expected *failure* count treats
  every change to that count as a regression, including a repair** — it should assert *no new
  failures*, or compare against a baseline that is updated deliberately, not a literal. **A test
  that depends on another repo's commit recency depends on the weather**, and it now rots in both
  directions: the fixture went stale by neglect and then un-stale by unrelated work, and the second
  is harder to notice because the suite that breaks is not the suite that changed. And **the blast
  radius crossed a repo boundary** — nothing in this repo's history explains the failure, which is
  the specific reason it is written down rather than fixed silently. `docs/BACKLOG.md` carries the
  fix; it needs the same owner decision AC-2 already needed, which is why this is a lesson and not
  a patch.

- (2026-08-21) **A single NUL byte made an acceptance suite unreviewable, and nothing complained.**
  `scripts/verify-stage3c.mts` was written with a `0x00` inside a sentinel constant. Behaviour was
  unaffected — the constant is only ever compared to itself, and the suite passed 11/11 — but git
  classifies a file containing a NUL as **binary**, so its diff renders as `Bin 22469 -> 26797
  bytes`. **PR #28 therefore shipped its acceptance suite invisibly**: the one file a reviewer most
  needs to read was the one file they could not. `type-check`, `build` and the suite itself were
  all green throughout, because none of them is a check about *reviewability*. Found by a
  sub-agent working in the file, not by any tooling. **The lesson is not "avoid NUL bytes" — it is
  that a diff rendering as `Bin` for a text file is a defect, not a curiosity**, and the moment to
  notice is while reading your own PR.

- (2026-08-21) **Three checks in one ticket passed and could not have failed — each for a different
  reason, and only the deletion probe found them.** T3 shipped six checks green; committing each
  sin turned three of them red only after they were fixed:
  *(a) **the wrong guard was being exercised.*** AC-16 seeded the two projects in **separate**
  databases, so the attacker's repo path found no `Project` row and the refusal came from the data
  lookup — the `task.projectId !== data.project.id` comparison this guard was meant to exercise was
  never reached, and deleting that line left it green. Fixed by putting both projects in one store.
  *(b) **the pure function was right and the wiring was not checked.*** AC-12 asserted
  `dropTargets` against a hand-built gate object, so the board feeding it the *session* refusal
  string instead of the human one passed cleanly. This is the T7-2 failure again (2026-08-19) in a
  new costume, and the fix is the same: assert the call site too.
  *(c) **the guard ran after the thing it guards against had already killed the process.*** AC-15's
  structural scan sat below its behavioural half, and a wrong implementation that really dispatches
  spawns a runner and takes the run down before the scan is reached — so it reported only when the
  code was already correct. Fixed by scanning first. **Ordering is part of whether a check works.**
  *(d) **the probe only exercised the form the probe was written in.*** Added 2026-08-21 after the
  review of #28 found it: AC-1's import walker followed `import … from "x"` and nothing else, so a
  client component could reach the store through a bare `import "x"` or an `export … from "x"` with
  the guard reporting PASS — and `app/layout.tsx` and `lib/tasks/model.ts` each contain one of those
  forms today, so this was not a hypothetical grammar. The deletion probe that shipped with AC-1 was
  real and it passed, because it was written as a named import. **A deletion probe proves the guard
  catches the sin you thought of.** When a check parses a *language* rather than a value, enumerate
  the forms of the thing before probing one of them.

- (2026-08-21) **A detector was written for a signal neither of the things it watches has ever
  printed.** AC-20 spawns `verify:stage3` and `verify:stage3a` and was supposed to report SKIP when
  one of them was degraded by a GitHub outage. It looked for `gh: `, `ENOTFOUND` and `rate limit` in
  the child's output — text **neither child emits**. `verify-stage3.mts` catches the offline case
  itself and prints `SKIP AC-11`; `verify-stage3a.mts` cannot distinguish it at all and prints an
  aggregate `FAIL AC-1`. So the one case the branch existed for was the one case it could not
  detect, and a real outage would have been reported as "upstream unchanged". Found in review of
  #31, never by running it — the branch is only reached when GitHub is down.
  **`external-API-fields-are-guilty-until-verified` applies to our own subprocesses.** The standing
  rule was written about GitHub's API and another project's document format; a sibling script's
  stdout is the same kind of contract and deserves the same treatment — *read the line the producer
  actually prints* before matching on it. Two smaller faults travelled with it and are the same
  shape: the skip was emitted through `pass()`, so a degraded upstream read as `PASS AC-20`; and a
  child that crashed before printing anything yielded no FAIL ids, which the "no unexpected
  failures" branch reported as green. **When a check consumes another program's output, that
  program's silence must be a failure, not an absence of failures.**

- (2026-08-21) **A failure message that quotes another program's output makes that output
  indistinguishable from your own.** `verify-stage3.mts`'s AC-11 spawns `pnpm verify:stage1` and,
  when the result is not the expected `7P/1F`, pastes `out1.slice(0, 300)` into its own failure
  message — raw, newlines intact. Stage 1's lines are formatted exactly like Stage 3's, so from that
  moment on **`verify:stage3`'s output contained `  PASS  AC-1 …` lines that belong to Stage 1.**
  - **It had already corrupted a recorded fact.** `docs/HANDOFF.md` carried *"recorded `33 of 33`
    before 2026-08-21 and the suite now reports 35 checks — the delta was measured, not
    explained"* for days. There was no delta. AC-11 went red, started quoting, and two or three of
    Stage 1's passes got counted as Stage 3's — *two or three*, varying run to run, because the
    300-character cut lands mid-line at a different place depending on the timestamp Stage 1 prints.
    A number that changes between identical runs should have been the tell.
  - **The miscount was the harmless half.** Stage 1's `FAIL` lines are in that excerpt too. Stage
    3c's AC-20 parses `verify:stage3`'s output for unexpected `FAIL` ids — so the next time Stage 1
    goes red, `FAIL AC-2` would have been read as *Stage 3* failing AC-2 and reported as a new
    regression this stage introduced. A false red, generated by an oracle, in the case the oracle
    exists for.
  - **The rule:** when a check embeds another process's output in its own, **flatten it** —
    `JSON.stringify` it, prefix every line, anything that makes it one unparseable blob. Your
    stdout is an interface; a quoted excerpt is a forged entry in it. Found while rewriting AC-20,
    not by any check — nothing in this repo asserts that a suite's output means what it appears to.
  The general rule, now three times learned: **a check passing is not evidence that it can fail.
  The probe is the evidence, and it must be run per check, not per ticket.**

- (2026-08-21) **`git checkout -- <file>` destroyed uncommitted work while reverting a test sin.**
  Proving a guard means mutating a file, running the suite, and putting it back. Reverting with
  `git checkout --` puts it back to **HEAD**, not to what was there a second ago — and the Stage 3c
  T1 changes were not yet committed, so `SETUP_ROWS`, `projectRailModel`, `countOpenInboxByProject`
  and a `revalidatePath` fix were silently deleted across three files. Nothing errored; the suite
  simply started crashing with an export that no longer existed. **Second instance of this class**
  (the first destroyed 50 `docs/BACKLOG.md` entries and survived a commit, a push and a merge), so
  it is a rule rather than a note: **commit before proving guards, and revert from a copy — `cp`
  the file aside, mutate, `cp` it back. Never `git checkout --` on a tree with work in it.**

