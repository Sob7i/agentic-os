# Agentic OS — Feature Map

> **What the system does *today*** — not what it is planned to do. Read this before building
> anything, to answer "does it already do X?" Write to it after building, in the same PR as the
> code. Planned behaviour lives in `docs/PRD.md`; it does not belong here until it runs.

**Status as of 2026-08-18: Stages 1, 2 and 3a run** — the reconciliation Board, and gated fix
proposals that write into a watched repo only on an explicit per-proposal click. Every row below
was verified by running it, not by reading the code. The `Verify` column is the command or action
that was actually executed.

**Run it:** `pnpm install && pnpm dev` → the Board. `pnpm verify` runs **every** acceptance suite
and no longer stops at the first red one — it did until 2026-08-18, which meant Stage 1's known
AC-2 failure had been hiding Stage 2's results in the aggregate. Counts live in
`docs/HANDOFF.md` §Verified state.

## How to read a row

| Column | Means |
|---|---|
| **Behaviour** | One user-observable capability, stated as what the system does |
| **Expected outcome** | What an observer sees when it works |
| **Verify** | The cheapest way to confirm it right now — a command, a route + action, or a test id |
| **Since** | The version or commit where this behaviour became true |

## Surfaces

### The Board (`/`)

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Lists every configured project | 6 rows, matching `projects.config.ts`; none auto-discovered | `pnpm verify` → AC-7 | Stage 1 |
| Reports verified git facts | Branch, dirty count, last-commit age match `git` in that repo | Compare a row to `git -C <repo> status` | Stage 1 |
| Reports open PR state | Open PR numbers match `gh pr list` | Compare to `gh pr list` in that repo | Stage 1 |
| Detects a stale PR claim (DC1) | nadim: claim `"PRs #1 through #22 merged"` shown beside `#23 merged; open #24` | `pnpm verify` → AC-1 | Stage 1 |
| Separates claim from fact visually | "Claimed" in quoted italic sans; "Verified" in mono with a green rule | Load `/`, read the drift card | Stage 1 |
| Shows in-sync projects as a result | A project with no findings renders `✓ in sync` with a check timestamp — **not** a blank row | `pnpm verify` → AC-2 *(currently failing — see Known gaps)* | Stage 1 |
| Distinguishes "nothing to check" from "checked and fine" | Projects with no state doc render `◌ unverifiable`, not green | Load `/`; salla-apps, fractal-code, my-personal-website | Stage 1 |
| Shows role coverage incl. full-profile alternates | salla-apps: router+queue+lessons+record filled | `pnpm verify` → AC-3 | Stage 1 |
| Names the source of every claim | Drift card shows the repo-relative doc path | `pnpm verify` → AC-4 | Stage 1 |
| Shows check confidence | `DC1 · confidence 0.95`; sub-0.9 rendered in the attention colour | Load `/`, read the card footer | Stage 1 |
| Degrades visibly when `gh` is unavailable | PR cell reads "unavailable", never "0 open"; git data still shown | `pnpm verify` → AC-5 | Stage 1 |
| Survives an unreadable repo | That row degrades; the other five render | `pnpm verify` → AC-7 | Stage 1 |
| Sorts by severity | drift → attention → unverifiable → in-sync | Load `/`, read the roster order | Stage 1 |
| States its own freshness | Header shows project count and check time | Load `/`, read the header | Stage 1 |
| Renders in light and dark | Both use validated palettes; dark is designed, not inverted | Load `/` with each OS appearance | Stage 1 |

**Checks implemented:** DC1 PR-frontier mismatch · DC2 "Next up" already done · DC3 state doc
older than last commit · DC4 uncommitted work (threshold, D14) · DC5 branch ahead/behind ·
DC6 open PR aging without review · DC7 stalled project · DC8 role-coverage gaps.

### Fix proposals — the gate (on the drift card)

**This is the only part of the system that writes outside this repo.** It writes one line into
one document, unstaged, after one click, and never marks its own work done.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Proposes a correction for DC1 drift | nadim's card offers `#22` → `#23` in `docs/HANDOFF.md` | `pnpm verify:stage2` → AC-1 | Stage 2 |
| Shows the change in its **full line** | The whole line renders, old token struck in drift red, new in sync green | Load `/`, read the drift card | Stage 2 |
| Flags a date the edit cannot see | Amber: `"2026-07-13" now sits next to a fact re-verified today` | `pnpm verify:stage2` → AC-2 | Stage 2 |
| Writes nothing until approved | Building and rendering a proposal leaves the fixture byte-identical | `pnpm verify:stage2` → **AC-3** | Stage 2 |
| Writes exactly what it previewed | The file on disk equals the previewed content byte for byte | `pnpm verify:stage2` → AC-4 | Stage 2 |
| Appends a paired lesson in the same approval | One dated line in `LEARNINGS.md`, under an existing heading when one matches | `pnpm verify:stage2` → AC-5 | Stage 2 |
| Skips the lesson honestly | A project with no lessons file is told so; the file is never created | `pnpm verify:stage2` → AC-5 | Stage 2 |
| Refuses a stale proposal | File changed since the proposal was built → refused, both files untouched | `pnpm verify:stage2` → AC-6 | Stage 2 |
| Refuses all-or-nothing | A refusal on either file writes neither | `pnpm verify:stage2` → AC-6 | Stage 2 |
| Leaves the write unstaged | `git status --porcelain` shows the worktree-modified marker, nothing staged, HEAD unmoved | `pnpm verify:stage2` → AC-7 | Stage 2 |
| Confines writes to two files | Outside paths and traversal refused by confinement; in-project non-targets by the allow-list | `pnpm verify:stage2` → AC-10 | Stage 2 |
| Explains when there is no fix | DC2–DC8 show *why* — never a disabled button | `pnpm verify:stage2` → AC-8 | Stage 2 |
| Never marks the drift resolved | After writing: `⚠ drift → ✎ written → ⟳ re-check pending → ?` | Load `/?written=<hash>&project=<name>` | Stage 2 |
| Shows git's own porcelain after a write | The unstaged file list comes from `git status`, not from our record of what we did | Load `/` after approving | Stage 2 |
| Acknowledges a drift locally | "Leave as is" mutes the card; survives reload; expires when the claim changes | `pnpm verify:stage2` → AC-9 | Stage 2 |
| Reports a refusal in the UI | Banner: **Nothing was written.** + the verbatim reason | Load `/?error=…` | Stage 2 |

### The app shell (Stage 3a — D23)

**The mode switch.** The portfolio home is the Board with a rail; entering a project replaces that
rail and puts a **persistent portfolio ribbon** across the top.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Routes a project | `/p/<name>` renders that project in the shell | Load `/p/nadim` | Stage 3a |
| Keeps the portfolio visible inside a project | Ribbon carries all 6 projects as glyph + name, plus the Board's freshness | `pnpm verify:stage3a` → AC-2 | Stage 3a |
| Reads one collector run per request | Every surface goes through `boardOnce`; nothing imports `buildBoard` directly | **AC-3** | Stage 3a |
| Refuses to guess when collectors fail | Ribbon shows **no** severities and says why — never 6 glyphs it cannot vouch for | **AC-4** | Stage 3a |
| Shows drift only where it is | Band renders on `/p/nadim`, absent on the other five; ribbon still carries their severity | **AC-5** | Stage 3a |
| Quotes the Board rather than re-deriving | Band shows the claim and counter-fact verbatim, and links back | Load `/p/nadim` | Stage 3a |
| Gives a watched-only project a full screen | Its findings, git/PR facts, and one sentence on how to opt in | AC-6 | Stage 3a |
| Offers no work surfaces without an execution layer | No Tasks/Goals/Inbox/Sessions/Costs; the rail says so | **AC-6** | Stage 3a |
| Detects opt-in from disk | `agentos.yml` at a project root → 5 tabs appear (D18) | AC-6 | Stage 3a |
| Refuses an unknown project | `/p/does-not-exist` → 404, not an empty shell | AC-8 | Stage 3a |
| Returns to the Board from anywhere | `← All projects` link and `⌘1` | Load `/p/nadim`, press ⌘1 | Stage 3a |
| Says the Overview is not built | One sentence naming Stage 6 and why; no skeleton | Load `/overview` | Stage 3a |
| Says a project tab is not built | `/p/<slug>/<tab>` names the spec that will build it | Load with an opted-in project | Stage 3a |

**The Board is unchanged.** `app/page.tsx` was decomposed into `components/board/` and the
severity vocabulary moved to `lib/severity.ts` so the ribbon uses the *same* mapping rather than a
copy. `pnpm verify` returns the same result as before the slice — that is AC-1, and it is asserted
by running the Stage 1 and Stage 2 suites unmodified as a regression oracle.

### The Tasks board, the session view, and the Inbox (T7 — spec §8, §2)

**The first surface behind an execution layer that renders real content rather than a
placeholder.** Reachable at `/p/<slug>/tasks` and `/p/<slug>/inbox` once a project both has an
`agentos.yml` on disk (D18, checked by the shell) *and* a matching `Project` row in
`data/agentos.sqlite` (checked by this surface, one level deeper — see *Known gaps* below: no
watched project has the second one yet). A single session's own page lives at
`/p/<slug>/sessions/<id>`, linked from a task card's evidence line or an Inbox item; there is no
session *list* in this slice.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Lists a project's tasks on a four-column board | Cards appear under `todo`/`doing`/`review`/`done` | Load `/p/<project>/tasks` on a project with a `Project` row | T7 |
| A `todo` card shows no evidence line | Nothing renders — not an empty line, not a placeholder | `pnpm verify:stage3` → T7-1 | T7 |
| A running session's card carries no motion | A static 3px rail is the entire treatment | Load `/p/<project>/tasks` while a session is `running` | T7 |
| Executed and hand-moved cards are distinguishable before either is read | `▶` + mono + session id + sha vs. quoted italic naming a person | `pnpm verify:stage3` → T7-2 | T7 |
| A session id opens the session view; a sha is a real, verifiable value | Session id links to `/p/<slug>/sessions/<id>` | Click a card's evidence line | T7 |
| A gated `review` card's refusal reason is the API's own string | One source, imported not retyped | `pnpm verify:stage3` → T7-3 | T7 |
| Column counts are plain numbers | No pill, no colour, no badge field on the model | `pnpm verify:stage3` → T7-4 | T7 |
| Creates a task and runs it now | `Run now` on a `todo` card calls `dispatch()`; card moves to `doing` | Click `Run now` on a project with a `Project` row | T7 |
| Accepts a human's approval on a gated card | `Approve & mark done` moves `review → done`, recorded as hand-moved | Click the gate's approve button | T7 |
| Answering an Inbox question resumes the session | `Answer and resume` calls `resumeSession()` with the reply | Answer an open question in `/p/<slug>/inbox` | T7 |
| The session view shows the evidence, not a live feed | Duration, cost, commits, and the full tool-call log, oldest first, no auto-scroll | Load `/p/<slug>/sessions/<id>` | T7 |
| The Inbox's open count is the one legitimate counter | Every other count in this layer is a plain number (§8.5) | Load `/p/<slug>/inbox` | T7 |
| Keeps the portfolio visible inside a project | Ribbon and (where applicable) drift band still render on Tasks/Inbox/session pages | Load `/p/<project>/tasks` | T7 |

**All nine card states — `todo`, `running`, `executed`, `failed`, `hand-moved`, a gated `review`
card, an ungated `review` card, `done`, and an empty column — were rendered against a seeded
fixture project and a live `pnpm dev` server**, not just asserted by the pure-function suite above;
the wireframe's own evidence-line text (`running · 12m · 41 tool calls · $2.10 so far`) came back
verbatim. The seed script and its `projects.config.ts` entry were both reverted before this landed
— per invariant 5, the portfolio's watched set stays exactly six real projects.

**The boot sweep now has a call site (§7.7).** `instrumentation.ts` calls `runBootSweep` once per
server process, passing `dispatch.ts`'s own `PROCESS_BOOT_ID` so the two can never disagree. Built
by T5, wired by T7 — until this landed, restarting `pnpm dev` left `running` rows with no process
behind them, permanently. Verified against a real boot, not only a fixture: with a stale `running`
session seeded, starting the server logs `[agentos] boot sweep: interrupted 1 session(s) left
'running' by a previous process` and the row reads `interrupted` afterwards.

**Booting the portfolio does not create the execution layer's store.** `data/agentos.sqlite` is
opened only if it already exists — with no execution layer initialized there are no sessions, so the
sweep is a guaranteed no-op, and running the Board on a machine that has never opted in leaves no
`data/` directory behind. D19 asks for the layer boundary to be real in code, and the portfolio
starting up should not conjure the execution layer's database as a side effect.

### The Overview

*Not built.* Planned: PRD §6.8, **Stage 6** (re-scoped by D22 to read two sources). `/overview`
renders one honest sentence saying so.

### Usage & cost

*Not built.* Planned: PRD §6.3, **Stage 7**.

## Invariants in force

Stated in full in `CLAUDE.md` §Invariants.

1. Local-only, no egress (except `gh` to GitHub).
2. Never assert without a check — every displayed fact carries what was checked, and when.
3. Reality wins; a document is a hypothesis.
4. Read-only toward watched repos — **verified by AC-6**, which diffs every watched repo's
   working tree across a full reconciliation.
5. No second source of truth.

## Deliberately not supported

- **Unapproved writes of any kind.** Every write is one click on one proposal; there is no
  "fix all", no auto-apply, and no background write path.
- **Committing, staging, branching, or pushing in a watched repo.** The change lands as an
  unstaged working-tree edit and stops there. Undo is `git checkout -- <file>` — stated in the UI.
- **Model-generated corrections.** Deterministic string edits only (D15); the egress invariant
  forbids the alternative.
- **An in-app undo.** Tracking prior state would be a second source of truth (D11); git already
  has one.
- **A "reject" button.** The gate's second action acknowledges instead (D17).
- **Fixes for DC2–DC8.** None of them is a wrong string; each says so with a reason.
- **Task creation, assignment, due dates, status toggles** — D11.
- **Sprints, burndowns, velocity** — the watched system is gate-driven (PRD §6.8.3).
- **Auto-discovery of projects** — the watched set is explicit (D9).
- **Auto-refresh** — on load plus a manual refresh only (D8).
- **Proximity-matched claim extraction** — prohibited; it inverted meaning in testing
  (spec §3.2).
- Cloud sync, telemetry, accounts, multi-user views.

## Known gaps in this map

- **Restarting the dev server kills every running session, and the system reports that rather than
  hiding it (§7.7).** `instrumentation.ts`'s boot sweep marks every `running`/`waiting-inbox`
  session whose `bootId` doesn't match the current process as `interrupted`, with the reason
  recorded and its worktree removed — so the loss is visible on the card (`failed`-register
  evidence, mono, naming the reason) rather than a `running` row lying forever. Surviving a restart
  needs a supervisor process, which is the cloud runner's problem (D20) → `docs/BACKLOG.md`.
- **No watched project has a `Project` row in `data/agentos.sqlite`.** `agentos.yml` on disk is
  necessary but not sufficient — the shell (D18) checks the file and shows the tabs; the Tasks/Inbox
  pages check one level deeper and render an honest "not initialized" pane rather than inventing
  rows or crashing. Nothing yet creates that row from a yaml file appearing on disk — connecting the
  two is not built by any ticket through T7 → `docs/BACKLOG.md`.
- **`instrumentation.ts` needed a webpack config change, not just the file itself.** Next.js 15.5
  compiles `instrumentation.ts` for an edge-runtime target in `next dev` (not `next build`, which
  already tree-shakes the dead branch) even though this app declares no edge routes, and that edge
  compile fails on any `node:`-prefixed builtin reachable from the file — `dispatch.ts`'s own import
  graph reaches several. `next.config.mjs` externalizes every Node builtin for that one target.
  Found by actually running `pnpm dev` against a seeded fixture project, which is also how every row
  in the Tasks-board table above was verified — not assumed from the pure-function suite alone.
- **⚠ AC-10 (does the ribbon fit?) is measured but not *observed*.** Stage 3a's one manual
  acceptance asks whether six real project names survive a 40px ribbon at 1280px. The rendered
  ribbon is **116 characters** — `← All projects ⌘1 · ⚠ nadim · ○ agentic-os · ○ itqan ·
  ◌ fractal-code · ◌ my-personal-website · ◌ salla-apps · verified 1:18:47 PM` — which computes to
  roughly **890px of the 1280px available**. That is comfortable, and it is an **estimate from
  character counts, not a browser measurement**; nobody has looked at it yet. The failure mode is
  bounded either way: the ribbon is `overflow-x: auto`, so if it does not fit it **scrolls rather
  than truncating a project name** — it degrades instead of lying. **The owner should look once**,
  and if it is cramped, D23 named the fallback in advance (Concept C, a persistent spine).

- **⚠ AC-2 currently fails, and the code is right.** The check asserts *"itqan renders `✓ in sync`"*
  **by name**; itqan has not committed since 2026-07-21, so DC7 correctly reports it stalled and the
  row is `○ attention`. The *behaviour* in the table above is intact — a finding-free project does
  render green — but the row's original wording named a live repo as its example, which made a
  behaviour claim rot when the world moved. **Reworded 2026-08-15** to state the behaviour and stop
  naming the specimen. Fixing the check itself amends a PRD acceptance criterion, so it is a
  decision, logged as blocking in `docs/BACKLOG.md`.

- **A corrected line can carry a stale date.** The substitution changes one integer inside the
  matched claim and cannot read the prose beside it, so `(verified 2026-07-13)` survives next to
  a fact re-verified today. **Accepted deliberately** (D15): the diff shows the full line and the
  UI flags the date in amber. This is the limitation the approval gate exists to catch, not a bug
  to be fixed by editing more.
- **Only DC1 has a fix, and only when the doc is *behind*.** A claim that is correct about merged
  PRs but silent about an open one produces no proposal — the missing sentence is authorship. The
  card says so.
- **The approval flow has not been exercised end-to-end on a real repo.** AC-1…AC-11 prove it on
  fixture repos, and the UI's four states were each rendered against live data, but no watched
  project has actually been corrected through the button. Writing into another repo is an owner
  gate → `docs/BACKLOG.md`.
- **Acknowledgements are keyed per claim, not per project.** Acknowledging one drift says nothing
  about the next; there is no "mute this project", by design.
- **DC2 has never fired on real data.** No watched project currently has a "Next up" line naming
  a merged PR, so its 0.6-confidence rendering is unexercised. Verified only by construction.
- **DC5 (ahead/behind) is unexercised** — no watched branch currently diverges from its upstream.
- **AC-5 degrades both collectors, not just `gh`.** The test strips `PATH`, which disables `git`
  too. It proves failures surface with readable reasons and no silent zeros, but does not isolate
  a `gh`-only outage. A narrower fixture belongs with Stage 2 → `docs/BACKLOG.md`.
