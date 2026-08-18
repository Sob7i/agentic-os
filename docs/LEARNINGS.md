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

## Verification

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

## Workflow

- (2026-07-27) The first three commits landed directly on `main` before the branch model was
  decided (D13). `develop` was branched from that point so history stayed consistent — but the
  decision should have been closed *before* the first commit, not after the third.
