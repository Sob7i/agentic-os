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
`data/agentos.sqlite` (checked by this surface, one level deeper). **Since Stage 3b T1 the second one is
reachable** — the *not initialized* pane carries an Initialize button; see the section below. A single session's own page lives at
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

### Initializing a project (Stage 3b T1 — spec §1.1, D30)

**The connector.** Until this landed, an `agentos.yml` on disk got a project its five tabs and
nothing else: no tool turned it into a `Project` row, so every execution surface rendered *not
initialized* and the only way to create one was a seed script. The pane that explains the problem
now carries the button that fixes it — **an explicit click, never a filesystem watcher** (D30;
option (c) was rejected on sight because a process that creates records without being asked is the
exact shape D24 refused for dispatch).

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Initializes a project that has an `agentos.yml` | One `Project` row; the Tasks page stops saying *not initialized* and shows an empty four-column board | `pnpm verify:stage3b` → AC-1 | 3b T1 |
| Reads the file's own settings | `slug` and `maxConcurrentSessions` come from `agentos.yml`; **`primaryRepoPath` never can** — it is taken from the Board's own entry (§3.2) | `pnpm verify:stage3b` → AC-1b | 3b T1 |
| Refuses a project with no `agentos.yml` | Stated reason next to the button, naming the path it looked at; no row written | `pnpm verify:stage3b` → AC-2 | 3b T1 |
| Refuses a malformed `agentos.yml` | The yaml parser's own message is carried **unchanged** — never reworded, summarised or truncated — inside a sentence naming the file. AC-2b asserts containment, so a reworded message fails it | `pnpm verify:stage3b` → AC-2b | 3b T1 |
| Refuses an `agentos.yml` it cannot read | A permission or I/O error is stated as such — **never** as *has not opted in*, which would be a fact nobody checked | `pnpm verify:stage3b` → AC-2d | 3b T1 |
| Refuses a slug another project already holds | Stated on the screen; `Project.slug` is `UNIQUE` and idempotency is keyed on the repo path, so these are two different guards | `pnpm verify:stage3b` → AC-2c | 3b T1 |
| Initializing twice is a no-op, not a duplicate | Second click reports *already initialized*; still exactly one row | `pnpm verify:stage3b` → AC-3 | 3b T1 |
| Opening a page still does not create the store | `dbIfExists()` on the page path, `getDb()` only inside the action — a click asks for the database, a page view does not | Load a tab on an uninitialized project; no `data/` appears | 3b T1 |

**The `agentos.yml` format is this project's own, defined here rather than captured.** Spec §3.3
asked that a real file be captured before parsing, on the `external-API-fields-are-guilty-until-verified`
rule — but **no watched repo has one**, so there was nothing to capture and the format is ours to
state. It is deliberately two optional keys, `slug` and `maxConcurrentSessions`, each with a
default; an empty file is a valid bare opt-in, since D18 already made the file's *presence* the
signal. The guilty-until-verified posture still applies to every field: each is validated, and a
bad value refuses rather than being coerced.

### Agents, behind configuration (Stage 3b T2 — spec §1.2, §5.2–§5.4)

**The first configuration surface**, at `/p/<slug>/config`, reached from a link in the project rail
**outside the five tabs**. D23 fixed the rail at five and said the cap is load-bearing; a sixth tab
would have been a decision against it, so `EXECUTION_TABS` is untouched.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Creates an agent | Name, monogram, model, role prompt, tool grants, `canCommit`, `maxTurns`, `maxBudgetUsd` — every field read back unchanged, `canCommit` as a boolean and not `1` | `pnpm verify:stage3b` → AC-4 | 3b T2 |
| Refuses tool grants that would widen egress | `WebFetch`/`WebSearch` are stripped from `allowedToolsJson`, forced into `disallowedToolsJson`, **and the UI says which were denied** — never silently accepted | `pnpm verify:stage3b` → AC-5 | 3b T2 |
| The egress floor has exactly one definition | `lib/agentos/egress.ts`, imported by both enforcement points — write time and spawn | `pnpm verify:stage3b` → AC-5b | 3b T2 |
| Tool grants are a fixed list, not free text | An unrecognized name is dropped rather than stored; there is no field to type one into | `pnpm verify:stage3b` → AC-5 | 3b T2 |
| Refuses to edit an agent with a live session | Stated reason **naming the session**; the row is unchanged. Live means `running` or `waiting-inbox` — the same pair `dispatch` uses | `pnpm verify:stage3b` → AC-8 | 3b T2 |
| One project cannot edit another's agent | A crafted post naming a foreign agent id is refused; that agent's row is untouched | `pnpm verify:stage3b` → AC-8b | 3b T2 |

**The floor is enforced twice, from one list, and neither point is redundant.** A row written before
a floor existed still has to be stripped at spawn; a floor that ran only at spawn would leave the
stored row lying about what the agent may reach. What *was* redundant — two copies of the denied
list — is gone, and AC-5b keeps it gone. The spec's reason for testing write time at all:
*an invariant enforced only by seed data is enforced by nobody.*

**An agent is not versioned, and does not need to be** (§5.3). A session composes its SDK options
from the `Agent` row at spawn and records nothing about what that row said, so editing underneath a
live one would make the session's own record unreadable — you could not answer *"what was this
agent allowed to do when it ran?"*. Editing **between** runs is fine.

### Creating a task (Stage 3b T3 — spec §1.3, §4)

The form sits above the board on the Tasks tab: title, description, assignee, approval gate. The
assignee select offers each of the project's agents **plus an explicit human-only option**, and the
choice is bound **at creation** — `dispatch` never defaults it (§7.1).

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Creates a task with an agent | The card appears in `todo` carrying that agent's monogram, and `dispatch` on it starts a session | `pnpm verify:stage3b` → AC-6 | 3b T3 |
| One project cannot assign another's agent | A crafted post naming a foreign agent id is refused; no task is written | `pnpm verify:stage3b` → AC-6b | 3b T3 |
| Creates a human-only task | `assigneeAgentId` is null, and dispatch refuses **by precondition `agent`** specifically — naming it, not merely returning `started: false` | `pnpm verify:stage3b` → AC-7 | 3b T3 |
| A human-only card has no Run now control | **Absent, not disabled** — the card cannot imply a machine could have done the work and declined | `pnpm verify:stage3b` → AC-7b | 3b T3 |

**A null assignee is deliberately human, never unassigned.** That distinction is the whole reason
AC-7 exists: it is why the refusal names a precondition rather than just failing, and why the card
shows nothing rather than something greyed out. `createTask` does not default from
`Project.defaultAgentId`, and dispatch's precondition 4 refuses rather than choosing.

### The full cycle proven, once, end to end (Stage 3b T4 — spec §4 AC-9)

**Everything T1–T3 built now runs together, against one task, in one check.** Create an agent,
create a task, `dispatch` it, let the scripted fake ask a question, answer it, watch the fake move
the card to `review`, then approve it as the human — every one of those five transitions is asserted
**positively** (the session really did enter `waiting-inbox`, the question really was asked, the
answer really was consumed by the resumed run) rather than only by the ending, and every transition's
`TaskEvent` is checked for the **right actor**: a session id where a session moved it, `"owner"`
where the human did.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| The full cycle, asserted at every stage | `todo→doing` (session) → `waiting-inbox` (real question, real `InboxMessage`) → resumed with the human's answer (proven by the resume options the second call received) → `doing→review` (session) → `review→done` (owner) | `pnpm verify:stage3b` → AC-9 | 3b T4 |
| The card's evidence resolves to a real session, before a human's own action supersedes it | At `review`, `cardModel`/`evidenceLineFor` (`lib/tasks/model.ts`) reports the `executed` kind with a session id that `getSession` actually resolves | `pnpm verify:stage3b` → AC-9 | 3b T4 |

**A human approving a gated card changes what the card's own evidence line says.** Once the human's
`review → done` transition is the most recent `TaskEvent`, `evidenceLineFor` switches the card to
`hand-moved` — the session that did the work is no longer named on the card, only on the Sessions
tab. This was true of the model before this ticket (spec §8.3); AC-9 is the first check to run a
gated task through the whole cycle and observe it, rather than assume it from the two states in
isolation.

**No production code changed for this ticket.** T4 is the suite (`AC-9`) and the docs; AC-9 found no
gap in T1–T3's own code to report.

### Drag and drop, the drawer, and the SETUP rail (Stage 3c — D32–D36)

**The second pass over the board and the rail**, driven by the owner's first real use of the app
on 2026-08-20.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Moves a card by dragging | Status and a paired `TaskEvent` in one transaction | `pnpm verify:stage3c` → AC-14 | Stage 3c |
| Records a dragged card as hand-moved | Quoted italic naming a person — never the machine register | **AC-14** | Stage 3c |
| Refuses to close a human gate by drag | The gated `review` card rejects the drop to `done` and points at *Approve & mark done* | AC-12 | Stage 3c |
| Says it in words meant for a person | Names the Approve control; never mentions `inbox_ask`, a tool a human cannot call (D36) | **AC-12, AC-12b** | Stage 3c |
| Refuses the same drop server-side | A crafted request the browser never sends is rejected; status and event count unchanged | **AC-13** | Stage 3c |
| Refuses a destination that is not a column | `archived` is refused, not passed through to SQLite to throw | **AC-13** | Stage 3c |
| Never dispatches from a drop | `Run now` remains the only path into a session (D24) | **AC-15** | Stage 3c |
| Refuses a cross-project drag | One project cannot move another's card | **AC-16** | Stage 3c |
| Refuses an incomplete move request | A POST missing a field is refused at the form boundary; nothing is revalidated and no empty field is quoted back | **AC-16b** | Stage 3c |
| Survives a move that never reaches the server | The refusal says nothing was changed, and the board keeps accepting drags — it does not go quietly read-only | *(code; no check — client-side)* | Stage 3c |
| Drops a drag that lands mid-flight | The second gesture is refused rather than queued, so two moves cannot race and settle a card where neither put it | *(code; no check — client-side)* | Stage 3c |
| Keeps the board keyboard-operable | dnd-kit's `KeyboardSensor`; drag does not swallow `Run now` or `Approve` | M-2 (**not yet observed**) | Stage 3c |
| Opens Add task / Add agent in a drawer | Right-hand sheet on the native `<dialog>`; `Esc` closes unless a submit is pending | M-3 (**not yet observed**) | Stage 3c |
| Keeps a refusal on screen | A failed create leaves the drawer open with its reason | AC-9 | Stage 3c |
| Keeps the egress-floor note on screen | A **successful** agent create that denied `WebFetch`/`WebSearch` still leaves the drawer open | **AC-9** | Stage 3c |
| Refuses to open an edit sheet for an unknown agent | `?agent=<unknown>` opens nothing rather than an empty form | AC-11 | Stage 3c |
| Offers four setup destinations | `Agents · Templates · Environments · Repos` as rail rows, each with its own URL | AC-2, AC-7 | Stage 3c |
| Says what will build an unbuilt setup surface | Each placeholder names its stage, or states it is unspecced | AC-7 | Stage 3c |
| Refuses an unknown setup section | `/p/<slug>/config/nope` → 404 | AC-7 | Stage 3c |
| Offers no setup surfaces without an execution layer | `/p/<watched-only>/config` → 404 (**a change** — it used to render) | AC-7 | Stage 3c |
| Shows the project's severity in the rail | Glyph and word from the shared vocabulary, at every severity — no delta, no sentence (D35) | AC-5 | Stage 3c |
| Carries the Inbox count in the rail | Right-aligned monospace — the only counter in the product | AC-2, AC-3 | Stage 3c |
| Distinguishes "none" from "not counted" | An uninitialized project shows no count, never `0` | **AC-3** | Stage 3c |
| Agrees with the Inbox page about the count | Both numbers come from one rule | **AC-4** | Stage 3c |

**No component library was added.** Drag is `@dnd-kit/core`; the drawer is the browser's own
`<dialog>` with `showModal()`. D34 records why shadcn/ui was rejected — it would have made Tailwind
a fourth styling idiom, and its defaults contradict rules already validated here.

**`Board` and `Card` are still server components.** Only three small wrappers are client code, and
they receive server-rendered cards as children — so no card rendering and no model code enters the
browser bundle. **AC-1 walks every `"use client"` file transitively and asserts none reaches
`node:*` or the store**, which is D19's layer boundary made structural instead of remembered.

### The measurements this stage owes, and has not taken

**Four observations remain unmade, and are recorded as unmade rather than estimated.** This is the
correction Stage 3a's AC-10 needed: that criterion has sat in this file since 2026-08-18 as a
*computed estimate presented as a fact*, and repeating that here would be the same mistake twice.

| # | What must be looked at | Status |
|---|---|---|
| **M-1** | The **ribbon** at 1280px: six project names, the freshness line, the back control — **without truncating a name**. This *is* Stage 3a's AC-10 | **not observed** |
| **M-1b** | The **board** at 1280px with real cards, including the longest agent name (`@implementation-plan-executioner`) | **not observed** — arithmetic only |
| **M-2** | Keyboard drag driven in a real browser: lift, move, drop, with no pointer | **not observed** |
| **M-3** | The drawer is modal: focus trapped, background inert, `::backdrop` painted, and `Esc` refused **while a submit is pending** | **not observed** |

**The arithmetic for M-1b, labelled as arithmetic.** Board minimum is `4 × 220 + 3 × 14` = **922px**;
at 1280px with a 200px rail and 24px pane padding, **1032px** is available — 110px of slack, 248px
per column, so the board begins to overflow at a viewport **narrower than 1170px**. That is a
width calculation and says nothing about height. The rail's 1px border is *not* subtracted
separately, because `app/globals.css` sets `* { box-sizing: border-box }`. **None of that is an
observation.** Cards get taller with drag affordances and a drop target needs visible room that no
column-width sum accounts for. If it turns out cramped, D23 named Concept C as the fallback in
advance and §5.4 kept the pane unconstrained, so the swap stays a layout change; the cheaper first
move is dropping the column floor 220px → 200px, which buys 80px in one line.

### Templates, gates, and chains (Stage 4 — spec: `docs/specs/stage-4-templates-chains.spec.md`)

**The stage with no new machinery** (spec §1): a chain is `dispatch()`'s existing funnel plus the
existing approval gate, sequenced. Nothing here scans, polls, or schedules.

| Behaviour | Expected outcome | Verify | Since |
|---|---|---|---|
| Lists the templates a project has | `compound-engineer-workflow` appears, seeded | Load `/p/<slug>/config/templates` | Stage 4 |
| Instantiates a template as a chain | Nine cards appear in `todo`, in order, each naming its agent | `pnpm verify:stage4` → AC-1 | Stage 4 |
| Binds template variables | Every `{{var}}` in every step prompt is replaced before any card is written | AC-2 | Stage 4 |
| Refuses an unbound variable | Instantiate fails, names the variable and the step; no cards are created — an explicit `""` refuses exactly like an omitted key (T4 closed this: `bindPrompt` treats an empty string the same as a missing one) | **AC-2** | Stage 4 |
| Blocks a step behind its predecessor | Steps 2–9 carry a `blocked` chip naming **its own immediate predecessor** — see the correction below | AC-3, AC-8 | Stage 4 |
| Starts the next step when one is marked done | Step 1 `done` → step 2 dispatches with `trigger: 'chain'` | **AC-4** | Stage 4 |
| Will not start step 2 from a session token | The gated `done` on step 1 is refused; step 2 never dispatches | **AC-5** | Stage 4 |
| Says what approving will start | The gate reads *"Approve & start step 2 (@plan)"* — never a bare "Approve" | AC-6 | Stage 4 |
| Leaves a human step for a human, and keeps the chain running | A step with no agent cannot be dispatched; the refusal names the reason — see the second correction below | **AC-7** | Stage 4 |
| Halts the chain on an automated step's failure | A failed step stops the chain, attributed to that step | **AC-8** | Stage 4 |
| Records the chain on every card | Each card shows `step N of 9 · compound-engineer`, `N` and the total read from the chain's own data, never a hardcoded 9 | **AC-9** | Stage 4 |
| Never re-dispatches a step | A step already run cannot be started twice by the chain, even raced | **AC-10** | Stage 4 |
| A running chain ignores template edits | Editing the seeded template after instantiate leaves the chain's stored prompts and step count unchanged | AC-11 | Stage 4 |

**Two corrections, because what is built is not quite what the spec's own prose says:**

- **§2 and AC-8 both read "later steps say which step stopped them."** What is built gives each
  blocked step a `blockedReason` naming **its own immediate predecessor**, not the step that
  actually halted the chain — behind a failure at step 5, step 6 reads "waiting on step 5" (correct
  either way), but step 7 reads "waiting on step 6," not "waiting on step 5." Followed one hop at a
  time the chain of reasons still reaches step 5; read in isolation, step 7's own reason does not
  name it.
- **§3.4 states flatly that a refused dispatch halts the chain.** There is one deliberate
  exception, and it is easy to miss because it lives only in code and a check: a refusal on a
  **human-only** step (`assigneeAgentId === null`) leaves `Chain.status` at `running` rather than
  `halted` (spec §3.5, asserted by AC-7) — a human-only step ends the chain's *automation*, not the
  chain itself, and attributing that to a halt would misreport a design choice as a fault. Every
  *other* refused dispatch still halts, attributed (AC-8).

**Where the controls live (spec §5.8):** the template list is setup, at
`/p/<slug>/config/templates`. Instantiating one is work — the form is on the Tasks board, beside
`+ Task`.

**Reused unchanged, per spec §7's "no new test seam":** `dispatch()` and its five preconditions,
the approval gate, the `Runner` fixture. `verify:stage4` never calls a model.

**One measurement this stage owes, and has not taken** (owner work, not build work): instantiating
the seeded template for real, once, in a project whose six named agents actually resolve, and
looking at the nine resulting cards — eight of them blocked. Nobody has seen whether that reads as
"one plan" or as "eight stalled tasks." `docs/specs/stage-4-tickets.md`'s own closing section has
the argument in full.

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
- **One watched project has an `agentos.yml`: this one** *(2026-08-20, **D31**)*. Until then none of
  the six did, which meant `projectNav` gave every one of them zero tabs and the execution surfaces
  rendered nowhere at all — Stage 3b was merged and unreachable. agentic-os now carries the file, so
  the five tabs and the *Initialize* button exist on a real project. **The other five still do not**,
  and opting one in means writing into another repo, which stays an owner gate. D27's separate
  question — where the first real *runs* target — is still `fractal-code`, unchanged by this.
- **No agent has been run on a real repo.** AC-9 proves the whole cycle against fixtures with a
  scripted stand-in for the model; `pnpm verify:stage3` AC-12 is the only check that spawns a
  genuine session and it stays opt-in behind `AGENTOS_REAL_SESSION=1`. The walkthrough is
  `docs/HUMAN-TEST.md` Part 7.
