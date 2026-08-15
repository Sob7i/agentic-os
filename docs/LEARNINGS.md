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
- (2026-08-15) **The router contradicted itself in the same file and nobody read past line 12.**
  `CLAUDE.md` opened with *"Status: pre-code… no application code exists yet"* while its own
  Commands table 80 lines below documented `pnpm verify` running 19 acceptance checks against
  shipped Stage 1 and Stage 2 code. Both statements were written by sessions that only edited
  their own section. **The status line of a router is the most-read and least-maintained line in
  a repo — it is the one place a stale claim is guaranteed to be believed.** Sessions 1–2 updated
  `HANDOFF.md` and `FEATURES.md` faithfully and left the router untouched; the session-end
  checklist named neither. Caught 19 days later by a session reading the file cold.
- (2026-07-26) A doc that references a sibling section by number (`"the brief for §6.1–6.4"`)
  goes stale the moment a section is added. Prefer naming the thing over numbering it, or
  accept that the pair must be re-read on every edit.

## Code

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

## Workflow

- (2026-07-27) The first three commits landed directly on `main` before the branch model was
  decided (D13). `develop` was branched from that point so history stayed consistent — but the
  decision should have been closed *before* the first commit, not after the third.
