# Spec — Stage 3c: the board and the rail, second pass

status: ☑ **built 2026-08-21 — D32–D36 closed, 23 checks green** (AC-16b added in review of #30)**.** Four by-hand measurements
(M-1, M-1b, M-2, M-3) remain **unobserved** and are owner work; see docs/FEATURES.md.

> **Stage 3b closed the loop; this stage makes it usable.** The owner ran the app for the first
> time against a real opted-in project on 2026-08-20 and produced five pieces of frontend
> feedback. They are ordinary product iteration — but **four of the five contradict a recorded
> decision, and one names three surfaces that have no data model at all.** That is why this is a
> specced stage with its own suite rather than a polish branch.
>
> **What is actually wrong today.** The Tasks board can only be operated with buttons. The two
> forms carrying the most content sit inline on the page they belong to. Every setup surface hides
> behind a single `Configuration` footer link that reads as one page. And the project rail was
> never built to frame `B′2` — the frame D23 selected. None of these is a bug; each was a
> deliberate slice boundary. Together they make the product feel like a set of test fixtures.
>
> **Sequenced before Stage 4**, which is otherwise the next buildable slice and which needs a
> `Templates` destination that does not exist. Building it here means Stage 4 inherits a slot
> rather than inventing one — and §5.8 of Stage 4's spec, which puts templates *behind*
> `configuration`, is reallocated by D32 rather than contradicted.
>
> **What this stage is not.** Not the portfolio home rail's project list (§1 Out, and the
> `docs/BACKLOG.md` entry's unblock condition is *produced* by this stage, not met by it). Not a
> component library. Not templates, environments or repos as working surfaces — three of the four
> SETUP rows are honest placeholders, and §5.4 explains why that is the right shape rather than a
> shortfall.

---

## §1 — Scope

**In:**

1. **Drag-and-drop on the Tasks Kanban.** A card moves between columns by direct manipulation. A
   drop is recorded as a **hand-move**, in the evidence register that already exists for it. A
   gated `review` card **refuses** the drop to `done` and points at the Approve button.
2. **A sliding drawer for the two long forms.** `Add task` and `Add agent` move out of the page
   flow into a right-hand sheet built on the native `<dialog>` element.
3. **A SETUP group in the project rail.** `Agents · Templates · Environments · Repos` become four
   nav rows with their own routes, replacing the single `Configuration` footer link. Agents is
   live; the other three are placeholders that name what will build them.
4. **The project rail rebuilt to frame `B′2`** — 200px, a back row, a project identity block with
   a severity line, dividers, the five work rows with the Inbox count right-aligned, the `SETUP`
   label and rows, and a footer line.
5. **`pnpm verify:stage3c`** — fixture-based, model never called, discovered by
   [`scripts/verify-all.mts`](../../scripts/verify-all.mts) from its `package.json` key.
6. **Stage 3a's AC-10 measurement, scoped and named here — and still not taken** (§4, M-1): the
   **ribbon** carrying six names, the freshness line and the back control without truncation. This
   stage's job was to specify it precisely enough that it *can* be taken; the looking itself is
   owner work and has not happened (see the status line above). It has sat in `docs/FEATURES.md`
   since 2026-08-18 as a *computed estimate*, never an observation. The board's own width is a
   second measurement (M-1b), which this stage adds because the rail grows 172px → 200px.

**Out** — each has a home:

- **A project list on the portfolio home rail.** `docs/BACKLOG.md` (2026-08-20). Its unblock
  condition is *"the Tasks board having been used with enough real cards to judge the width
  question D23 actually traded against"* — which **this stage produces and does not consume**.
  Deciding it here would spend the evidence before it exists.
  [`PortfolioRail.tsx`](../../components/shell/PortfolioRail.tsx) is untouched.
- **Templates as a working surface.** Stage 4.
- **Environments and Repos as working surfaces.** Unspecced; two new `docs/BACKLOG.md` entries.
  The grant manifest they will hold is sketched as frame `A1` in
  [`design/wireframes2.pen`](../../design/wireframes2.pen) and is a security-boundary design, not
  frontend work.
- **A `Skills` row**, drawn in frame `B′2`'s setup line. Four rows, not five — §5.4.
- **A toast or banner system.** The forms' inline result paragraph stays what it is. The drawer
  finally gives *its two forms* a place for a refusal to land; the board's `runNowAction` gap
  (`app/p/[slug]/[tab]/actions.ts:283-287`) is not closed here.
- **Any change to `app/board.css`** or to the Board's appearance.

---

## §2 — Behaviour

The rows that land in `docs/FEATURES.md` when this ships.

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Moves a card by dragging | Card moves between columns; status and a paired `TaskEvent` are written in one transaction | AC-14 |
| Records a dragged card as hand-moved | Quoted italic naming a person — *"moved by hand · no session produced this"*, never the machine register | AC-14 |
| Refuses to close a human gate by drag | Gated `review` card rejects the drop to `done`, states why, and points at `Approve & mark done` | AC-12, AC-13 |
| Refuses the same drop server-side | A crafted request the browser would never send is rejected; status unchanged, zero events written | **AC-13** |
| Never dispatches from a drop | `todo → doing` by drag starts no session — `Run now` remains the only path (D24) | **AC-15** |
| Refuses a cross-project drag | One project cannot move another's card | **AC-16** |
| Keeps the board operable by keyboard | A card can be lifted, moved and dropped without a pointer | M-2 (**not yet observed**) |
| Opens Add task / Add agent in a drawer | Right-hand sheet, focus trapped, background inert; `Esc` closes **unless a submit is pending** | M-3 (**not yet observed**) |
| Keeps a refusal on screen | A failed create leaves the drawer open with its reason | AC-9 |
| Keeps the egress-floor note on screen | A *successful* agent create that denied `WebFetch`/`WebSearch` leaves the drawer open | **AC-9** |
| Offers four setup destinations | `Agents · Templates · Environments · Repos` as rail rows with their own URLs | AC-2, AC-7 |
| Says what will build an unbuilt setup surface | Each placeholder names its stage, or states it is unspecced | AC-7 |
| Refuses an unknown setup section | `/p/<slug>/config/nope` → 404, not an empty shell | AC-7 |
| Offers no setup surfaces without an execution layer | `/p/<watched-only>/config` → 404. **That is the row that carries the change** — it renders today. `/config/agents` also 404s, but it 404s *before* this stage too, so it proves nothing on its own | AC-7 |
| Shows the project's severity in the rail | Glyph and word from the shared vocabulary — no delta, no sentence, at **every** severity | AC-5 |
| Says so when it could not check | Degraded collectors → severity is `unverifiable`, so the line reads `◌ unverifiable` — the same two tokens, not a special sentence | AC-5 |
| Carries the Inbox count in the rail | Right-aligned, monospace — the only counter in the product | AC-2, AC-3 |
| Distinguishes "none" from "not counted" | An uninitialized project shows no count, never `0` | **AC-3** |
| Agrees with the Inbox page about the count | The rail's number and the page's number come from one rule | **AC-4** |

---

## §3 — Data & sources

### 3.1 Nothing new is stored

**No schema change. The database stays at eight tables** — `Project`, `Agent`, `Task`,
`TaskEvent`, `Session`, `ToolCall`, `InboxMessage`, `CommitSha`. A drop writes through the
existing [`writeTaskTransition`](../../lib/agentos/db.ts), which already pairs the status change
with its `TaskEvent` in one transaction. The rail's counter is one `SELECT COUNT(*)`.

**AC-17 asserts the table count**, and that is not bookkeeping: three of the four SETUP rows are
placeholders, and the cheapest way to turn a placeholder into a lie is to back it with a ninth
table nobody decided on.

### 3.2 The `human` exemption is real and load-bearing

`LEGAL_TRANSITIONS` ([`lib/agentos/db.ts:491-503`](../../lib/agentos/db.ts)) constrains `session`
and `system` actors and **returns early for `human`**. So every arrow is already legal for a
person at the data layer, and **the drop rule is a product decision with nothing underneath it**.

Two consequences, both load-bearing:

- **The refusal must live in the server action**, because there is no lower layer that would catch
  it. AC-13 exists for exactly this and is written hostile — it calls the action directly with the
  request a browser would never send.
- **Do not add a `human` row to that table.** It would break `approveDoneAction`, whose entire
  purpose is a human closing a gate.

### 3.3 One behaviour change, stated rather than discovered

[`app/p/[slug]/config/page.tsx`](../../app/p/[slug]/config/page.tsx) validates only that the
project exists — it does **not** check `nav.tabs.length`. So a watched-only project can reach
`/config` today and see a "Not initialized" pane. Under `setupSectionFor` it returns 404.

That is the correct reading of D18 and of Stage 3a's AC-6 — *no execution layer, no execution
surfaces* — and it is written here because a 404 where a page used to render is exactly the kind
of change that gets reported as a regression by whoever finds it next.

### 3.4 The import graph is a data source, and it is currently a landmine

**Verified 2026-08-21, by reading the files, not by assumption:**

```
lib/tasks/model.ts:2      import { gateRefusalReason } from "@/lib/agentos/mcp/gate"
lib/agentos/mcp/gate.ts:17  import { getTask } from "../db"        ← a VALUE import
lib/agentos/db.ts:20        import { DatabaseSync } from "node:sqlite"
```

Any client component importing anything from `lib/tasks/model.ts` therefore pulls `node:sqlite`
into the browser bundle. It is invisible today only because every consumer is a server component.
[`next.config.mjs`](../../next.config.mjs)'s `webpack.externals` guard covers
`nextRuntime === "edge"` and does not catch this; the symptom is every route 500-ing under
`pnpm dev`, which is the failure `docs/LEARNINGS.md` already records for 2026-08-19 —
*"`pnpm build` passing is not evidence that `pnpm dev` runs."*

**Therefore the drop rule lives in a new leaf file, `lib/tasks/dnd.ts`, that imports types only**,
and takes the gate's refusal string **as data** rather than importing it. *One reason, one source*
stays literally true: the string is passed, never copied. **AC-1 makes this structural** so the
next person does not have to know it.

---

## §4 — Acceptance

`scripts/verify-stage3c.mts`. Copy the idioms from
[`verify-stage3b.mts`](../../scripts/verify-stage3b.mts) exactly: the `pass`/`fail`/`failures`
trio, `TEMPS` with one unconditional sweep at the true end, `withOnlyProject` reached via
`createRequire`, the `try/catch/finally` wrapper so a check that throws **reports** rather than
vanishing, and `openDb(":memory:")` per block.

**Two classes, marked, because conflating them is how this repo keeps shipping code whose deletion
leaves the suite green.**

- **[F] feature** — fails when the feature is deleted. The deletion probe is named.
- **[G] guard** — passes trivially today; fails when a specific sin is committed. **The sin must be
  committed and observed red before the ticket ships**, or the guard is decoration.

| # | Class | Asserts | Probe |
|---|---|---|---|
| **AC-1** | **[G]** | No `"use client"` file transitively **value**-imports a `node:` builtin or `lib/agentos/db`. Type-only edges are not followed | Import `showsRunControl` into the drag wrapper; the walk reaches `node:sqlite` and goes red **before** `pnpm dev` does |
| **AC-2** | [F] | `projectRailModel` on an opted-in fixture: 5 work rows, 4 setup rows, label `SETUP`, 9 unique keys. On a watched-only fixture both arrays are empty | Remove the SETUP group → `setup.length === 0` |
| **AC-3** | [F] | The Inbox row is the **only** row with a non-null count; with `inboxOpenCount: null` every count is null | Drop the count → filter yields `[]`. **Second sin:** default it to `0` → the null case yields a count |
| **AC-4** | [F] | The rail's count and the Inbox page's count are one number: `openInboxCount(...) === inboxModel({...}).openCount` on a fixture of 2 open + 1 answered | Re-derive the rail count with its own query → 3 ≠ 2 |
| **AC-5** | [F] | For all four severities, `driftLineFor(p)` is exactly `GLYPH[p.severity]` + `WORD[p.severity]` and **contains no digit** — including the degraded case, which is `unverifiable` like any other severity and gets no special sentence (D35) | Hardcode a day count → the digit assertion, at every severity. **Second sin:** give the degraded case its own wording → it stops equalling `WORD.unverifiable` |
| **AC-6** | **[G]** | `EXECUTION_TABS` is still five, and no `SETUP_ROWS` key appears in `nav.tabs` | Push `agents` into the tabs → red here **and** in `verify:stage3a` AC-6 |
| **AC-7** | [F] | `setupSectionFor`: `agents` → live; the other three → placeholder with a non-empty `builtBy`; `skills` and `../../etc/passwd` → `null`; watched-only nav → `null` for all four | Return a default row → the unknown-section case |
| **AC-8** | [F] | `SETUP_ROWS` is the single definition of the four keys, and the route validation reads it | Add a second literal list → two sources |
| **AC-9** | [F] | `drawerOutcome` over four inputs: pending → open; `{ok:false}` → open; **`{ok:true, reason:"…egress floor…"}` → open**; `{ok:true, reason:null}` → close | Simplify to `return {close: state.ok}` → the third case. That case is not hypothetical — it is `egressFloorNote`'s value on a *successful* create (`config/actions.ts:105-110`), which Stage 3b AC-5 requires on screen |
| **AC-10** | **[G]** | Both forms still contain `useActionState(`, still render `state.reason`; the drawer calls `drawerOutcome(` and does **not** test `state.ok` itself | Close from `state.ok` in the component → the negative match |
| **AC-11** | [F] | `initialDrawerFor`: known id → edit; **unknown id → closed**; absent → closed | Return edit unconditionally → an empty edit sheet claims an agent exists |
| **AC-12** | [F] | For a gated `review` card, `dropTargets` refuses **exactly one** column and it is `done`; `todo`/`doing` accept; an **ungated** review card accepts everything. The refusal is the **human** rendering (D36) — it names the Approve button and does **not** mention `inbox_ask` | Remove the gate branch → the ungated positive control still passes while the gated case flips, so this cannot pass by refusing everything. **Second sin:** pass `gateModelFor`'s default `refusalReason` → the `inbox_ask` assertion trips |
| **AC-13** | **[F, hostile]** | Two crafted calls a browser never sends. **(a)** `moveTaskForSlug(slug, id, "done", {db})` on a gated `review` task → refused, status still `review`, event count unchanged. **(b)** an **arbitrary destination** (`"archived"`, `""`) → refused as `unknown-column` **before any write**, not surfaced as a crash | (a) Remove the server-side gate check → the task moves; §3.2, nothing underneath catches it. (b) Trust the `TaskStatus` type at a server boundary → the value reaches `writeTaskTransition`, trips SQLite's status `CHECK`, and the action throws instead of refusing. **A TypeScript signature is not a runtime allowlist** |
| **AC-14** | [F] | After a legal `todo → doing`: exactly one new `TaskEvent`, `actorType: "human"`, `actorId: "owner"`, reason from `handMoveReason`; then `evidenceLineFor` **via `cardModel`** yields `hand-moved` and `registerFor` yields `claim` | Write status without the event → none. **Second:** write `actorType:"session"` → the evidence line takes the session branch |
| **AC-15** | [F] | The move core takes an **injectable dispatch seam** and the check asserts it was **never invoked** — not merely that no session exists (D24) | Counting sessions is **not sufficient and would have shipped**: a wrong implementation that moves `todo → doing` and *then* calls `dispatch` is refused by dispatch itself, because it only accepts `todo` (`lib/agentos/dispatch.ts:185-186`). Zero sessions, green check, guard deleted. The invocation has to be observable. An import check is also worthless — `actions.ts:19` imports `dispatch` legitimately for `runNowAction` |
| **AC-16** | **[F, hostile]** | Two fixture projects; post the attacker's slug with the victim's `taskId` → refused, victim unchanged, zero events. **Reuse `resolveOwnedTask`**, do not write a fourth ownership check | Drop the ownership guard → the move succeeds |
| **AC-16b** | **[G, hostile]** | `moveTaskAction` — the **form boundary**, not its delegate — refuses a POST missing `slug`, `taskId` or `to`, without reaching `revalidatePath` and without quoting an empty field back at the reader | Added 2026-08-21 in review of #30. Remove the guard → the check goes red with `Invariant: static generation store missing in revalidatePath /p//tasks`, which is the defect itself: an empty slug revalidated a route that does not exist, and the refusal read `task  is not in project ''` |
| **AC-17** | **[G]** | Exactly eight `CREATE TABLE`s, and the name set matches §3.1 | Back a placeholder with a ninth table → red, forcing the decision into `docs/DECISIONS.md` |
| **AC-18** | **[G]** | No `*.module.css` under `components/` contains a hex literal (true today — zero matches) | Put `#fff` in the drawer's stylesheet. Enforces "tokens come from `globals.css`" without copying the palette into the suite, which would make the suite a second source of truth about it |
| **AC-19** | [F] | The `"session"` rendering of `gateRefusalReason` is **byte-identical** to today's string (D36) | Edit it → red, so the MCP contract cannot drift while the human copy is written |
| **AC-21** | **[G]** | Every literal `revalidatePath()` in `app/` names a route that exists **and is not redirect-only**. Parse each template literal, wildcard its `${…}`, match against the tree derived from `app/**/page.tsx` | Leave `config/actions.ts:120`/`:172` pointing at `/p/${slug}/config` after agents move to `/config/agents` — the path resolves, but only to a redirect, so a created agent does not appear until a manual reload. **This is the one trap in the stage that ships green without a check** |
| **AC-20** | **[G]** | Regression oracle: `verify:stage3` and `verify:stage3a` introduce **no failure outside the known set**, each child classified on its own, reporting **SKIP, never FAIL, on a degraded upstream** and **FAIL on a silent one** | `verify:stage3a` AC-1 can go red because GitHub is down — already a `docs/BACKLOG.md` entry. Importing that flakiness would teach us to ignore this suite too. **Rewritten 2026-08-21 in review of #31**, which found four faults that all made the oracle quieter: the skip printed through `pass()`; a child that crashed before printing anything was reported as unchanged; the degraded marker matched text neither child emits; and one `||` let an outage in either child hide a regression in the other. **Deliberately not asserted: the children's exact pass totals.** Pinning them is what put `stage3:AC-11` and `stage3a:AC-1` in the known set in the first place — both red today for *repairing* a known failure — and would give this oracle the same expiry date. The vacuity hole closes with a claim that does not rot: the child must have produced at least one parseable result |

**The worked example, because getting it wrong is how AC-1 gets implemented as a rubber stamp.**
[`AgentForm.tsx:5`](../../components/config/AgentForm.tsx) is `import { TOOL_GRANT_OPTIONS } from
"@/lib/agentos/agent-form"` — a **value** import, not a type-only one, and it is safe anyway.
The reason is one level down: [`agent-form.ts:11`](../../lib/agentos/agent-form.ts) imports
`CreateAgentInput` from `./db` **as a type**, so the walk stops there and never reaches
`node:sqlite`. **The rule is about the value graph, not about the first edge.** An implementation
that exempts value imports, or that stops at depth one, passes this file for the wrong reason and
would wave through the drag wrapper.

### Measurements — taken by hand, recorded either way

- **M-1 — the ribbon at 1280px. This is Stage 3a's AC-10 and it is about the ribbon, not the
  board.** AC-10's own words: *"the ribbon must carry glyph + name for all six, the freshness line,
  and the back control **without truncating a project name**."* **Record all three observations
  explicitly** — the six names as rendered, the freshness line, the back control — because a
  measurement recorded as "looked fine" is how AC-10 has stayed unobserved since 2026-08-18.
  Nothing about board width answers this. *(The first draft of this spec described only the board
  and still claimed to close AC-10, which would have let T4 mark it done while it stayed an
  estimate. Caught in review of #27.)*
- **M-1b — the board at 1280px**, a **separate** measurement this stage adds because the rail
  grows. Computed from the stylesheets: board minimum `4 × 220 + 3 × 14` = **922px**; available is
  `1280 − 200 (rail) − 48 (padding)` = **1032px** — 110px of slack, 248px per column, overflowing
  below a **1170px** viewport. The rail's `border-right: 1px` is **not** subtracted separately:
  `app/globals.css:49-51` sets `* { box-sizing: border-box }`, so a `width: 200px` rail already
  contains it. *(Counted twice in the first draft — corrected in review of #27, before it could be
  recorded as evidence.)* **That is arithmetic, not an observation, and recording it as one is the
  error being corrected.** Look at it with real cards, including the longest real agent name
  (`@implementation-plan-executioner`). **Fallback, named in advance:** drop the column floor
  220px → 200px, which buys 80px and is one line — before anyone reaches for a layout rewrite.
- **M-2 — keyboard drag.** Lift, move and drop a card without a pointer. If this does not work the
  dependency has not earned itself, and hand-rolled pointer events would have been the honest
  choice.
- **M-3 — the drawer is modal.** Focus trapped, background inert, `::backdrop` paints, and `Esc`
  closes **only when no submit is pending** — while pending it must be refused, or a refusal
  arriving 300ms later has nowhere to land (§7.2). Check both states, not just the idle one.
  **Not asserted in the suite** — these are the browser's promise, not ours (`docs/LEARNINGS.md`
  2026-08-18, *assert what you own*).

---

## §5 — Decisions

**Five. All are raised here and closed in `docs/DECISIONS.md` as D32–D36 by the first ticket,
before any component changes**, because four of them change what later tickets may build.

### 5.1 — Do the setup surfaces get rail rows, or stay behind one `configuration` link? → **D32: rows.**

D23 fixed the rail at five work tabs *plus `configuration` for everything else*, and
[`ProjectRail.tsx:5-9`](../../components/shell/ProjectRail.tsx) records the cap as load-bearing.
**But the argument it inherited belongs to Concept C**, whose rationale note reads: *"horizontal
tabs physically cap at five, which ENFORCES the work/setup split… because there is nowhere to put
them."*

**We shipped B′, whose rail is vertical. There is no physical cap, so the split was never being
enforced — it was being observed by hand.** Frame `B′2` knows this: it draws a `SETUP` label with
the four names beneath it, separated by a divider. The split is a **section boundary in B′, not a
length limit**, and D32 makes that explicit rather than leaving a comment asserting an enforcement
that is not there. The split is additionally carried **in the URL** — `/p/<slug>/<tab>` for work,
`/p/<slug>/config/<section>` for setup — so the register survives where the visual boundary does
not. Reallocates Stage 4 §5.8.

### 5.2 — What does a drop *mean*? → **D33: a hand-move; a gate refuses one.**

A drop writes `actorType: "human"` and renders in the `hand-moved` register that already exists —
so a dragged card is distinguishable from an executed one **before either is read**, the property
`docs/FEATURES.md` records as shipped. A gated `review` card refuses the drop to `done`: the gate
exists to force an explicit act, and a drag is the casual gesture it guards against. Dragging into
`doing` does **not** dispatch (D24). §3.2 is why the refusal must be server-side.

### 5.3 — shadcn/ui, or headless primitives? → **D34: headless.**

`@dnd-kit/core@6.3.1` for drag, the native `<dialog>` for the drawer. **Checked, not recalled**
(`npm view`, 2026-08-21): its peer range is `react: ">=16.8.0"`, so React 19 satisfies it — but
6.3.1 predates React 19, so React 19 is *accepted by its range, not tested against it*. It pulls
three transitive packages (`@dnd-kit/accessibility`, `@dnd-kit/utilities`, `tslib`), all pure JS.
`@dnd-kit/sortable` is **not** needed — there is no per-column ordering to persist, and adding one
would be a schema change. The newer `@dnd-kit/react` names React 19 explicitly but is at `0.5.0`;
a pre-1.0 rewrite is the larger risk. M-2 is the mitigation.

**shadcn is rejected** because it requires Tailwind — a fourth styling idiom beside `board.css`,
CSS Modules and the token layer — and because its defaults (zinc, `rounded-lg`, transitions on
everything) contradict rules already committed to here: no motion, monospace reserved for verified
machine truth, and a palette that a chroma validator rejected twice when it was chosen by eye.
Every component would be restyled on arrival: the cost of the library without the benefit.

**Consequently this stage adds no new colours.** Worth stating, because the validator
`app/globals.css:9` tells you to re-run **does not exist in this repo** — it is dataviz's, which
`docs/DESIGN-BRIEF.md:465` names correctly and `globals.css` does not. AC-18 keeps it moot; fix the
comment while in the file.

### 5.4 — Four setup rows, or only the ones that work? → **Four, with honest placeholders.**

`Templates` names Stage 4; `Environments` and `Repos` state that they are unspecced and describe
the grant manifest frame `A1` sketches. This repo already has the convention — `/overview` names
Stage 6 rather than showing a skeleton — and AC-7 makes "names what will build it" a requirement
rather than a courtesy, while AC-17 stops a placeholder acquiring a table nobody decided on.

**A deliberate divergence from the wireframe, recorded so it is not "fixed" back:** frame `B′2`
draws SETUP as *one text line* of five names including `Skills`. This builds **four nav rows and no
Skills**, because Skills has neither a spec nor a sketch.

### 5.5 — The rail's identity line: severity, or severity plus age? → **D35: severity only.**

Frame `B′2` draws `⚠ drift · 12 days`. **There is no structured age to render it from** —
`ProjectReport` has no age field, and the day count exists only as prose inside
`CheckResult.headline`. Producing it would mean parsing that sentence or computing a second one: a
second derivation of a number the drift band already quotes, which is invariant 5 and the exact
failure D23's ribbon rationale spent itself avoiding. The rail renders `GLYPH` + `WORD` from
[`lib/severity.ts`](../../lib/severity.ts) and no delta. Nothing is lost — the band sits directly
below, carrying the sentence verbatim. AC-5 also requires the line to be present at **every**
severity, not only `drift`, for the reason `Ribbon.tsx:6-15` already gives: a component that
appears only on drift makes its own absence an unchecked claim.

### 5.6 — Whose words are the gate's refusal? → **D36: one source, two audiences.**

D33 says a refused drop surfaces `gateRefusalReason(taskId)`. Read the string
([`lib/agentos/mcp/gate.ts:22-29`](../../lib/agentos/mcp/gate.ts)): *"task `<id>` has
approvalGate=true; **a session may not move it to 'done'**… or use `inbox_ask`…"*

That is right for the MCP layer and **wrong for the person who just dragged the card** — they are
not a session, and `inbox_ask` is not a tool they can call. It is also factually off:
`approveDoneAction` ([`actions.ts:301-309`](../../app/p/[slug]/[tab]/actions.ts)) has **no gate
check at all**, and says so — *"the gate exists to stop a session, never a human."* So the honest
sentence is not *"you may not do this"* but **"this gesture is not the approval — the button is,
and it records you as the approver."**

**Decision:** `gateRefusalReason(taskId, audience: "session" | "human" = "session")`. One function,
two renderings, so §8.4's *one reason, one source* stays literally true. **AC-19 pins the
`"session"` string byte-for-byte** so the MCP contract cannot drift while the human copy is written.

**A default is not a decision, and this one has to be requested explicitly.** `gateModelFor`
(`lib/tasks/model.ts:186`) calls `gateRefusalReason(task.id)` — the default — and `GateModel`
exposes a single `refusalReason`. If T3 sources the drag refusal from that model unchanged, **the
person dragging the card gets the MCP sentence about `inbox_ask`**, which is the exact defect this
decision exists to fix. So:

- `GateModel` carries **both** renderings — the `session` string stays where the card and the MCP
  layer already read it, and a `humanRefusalReason` is added beside it.
- `dropVerdict` is given the **human** one, and **AC-12 asserts the drag refusal is the human
  rendering** — mentions the Approve button, does not mention `inbox_ask` — while AC-19 keeps the
  session rendering frozen.
- **`lib/tasks/model.ts` is therefore in T3's owned files**, which the first draft of the tickets
  omitted. Caught in review of #27. Rejected: shipping the existing string verbatim — simpler,
and it puts a sentence about sessions in front of a person, in the product whose premise is that a
displayed claim must be true.

---

## §6 — Build notes

### 6.0 — The prerequisite, and it is an owner action

**`agentos.yml` must be on `develop` before any ticket is cut.** The D31 opt-in was still sitting
in an unmerged PR when this spec was written. A branch cut from a `develop` without that file has
**no opted-in project at all**: `projectNav` gives a project without it zero tabs, so
`/p/agentic-os/tasks` 404s, and every by-hand check and measurement in §4 is unrunnable.

**The check is structural, not a PR number** — `git show develop:agentos.yml` either prints the file
or exits non-zero, and it keeps answering correctly long after any particular PR has merged.
Merging is owner-only. *(This section named a specific PR and pinned a `develop` sha until
2026-08-21; both would be stale the moment the gate cleared, and `CLAUDE.md` keeps branch heads in
`docs/HANDOFF.md` §Verified state alone. Corrected in review of #27.)*

### 6.1 — Order

1. **Decisions first.** D32–D36 into `docs/DECISIONS.md` before any component changes.
2. **Pure functions and the suite before the UI**, as Stage 4 §6.3 also requires. Every decision
   that can be *wrong* goes in `lib/`, because **no acceptance script in this repo imports a
   component** — the `showsRunControl` lesson (`docs/LEARNINGS.md`, 2026-08-19).
3. Rail and routes, then the drawer, then drag, then docs and the measurements.

### 6.2 — Four tickets, stacked

They all append to `scripts/verify-stage3c.mts`; three touch `package.json`; T4 touches every hub
doc. That is the configuration `CLAUDE.md` §Git & PR workflow says collides *by construction*, and
every such conflict resolves to a union. **T2 branches off T1, T3 off T2, T4 off T3** — never off
`develop`. Details, file ownership and hand-off contracts: [`stage-3c-tickets.md`](stage-3c-tickets.md).

### 6.3 — Two pre-existing defects, fixed in passing

Both verified 2026-08-21, both in files T1 is already opening:

- [`scripts/verify-stage3b.mts:69-70`](../../scripts/verify-stage3b.mts) imports `showsRunControl`
  **twice** — a leftover from the union merge `docs/LEARNINGS.md` records for 2026-08-19. Delete
  line 70; it is a **mandatory** item in T1's done criteria, not an optional tidy.
  **It is not, however, breaking anything today, and the spec should not claim it is:** measured
  2026-08-21, `pnpm verify:stage3b` passes 18 of 18 with the duplicate present, because `tsx`
  tolerates a repeated binding and `pnpm type-check` never sees `.mts`. It is removed because dead
  code that only survives on a bundler's tolerance is a trap for whoever changes the toolchain —
  not because a suite is red. *(Review of #27 rated this critical on the grounds that the suite
  could not parse; it parses. The fix stands, the reason does not.)*
- `app/globals.css:9` points at a validator that does not exist here (§5.3).

### 6.4 — The `revalidatePath` trap

[`app/p/[slug]/config/actions.ts:120`](../../app/p/[slug]/config/actions.ts) and `:172` revalidate
`` `/p/${slug}/config` ``. Once agents render at `/config/agents`, both point at a route that only
redirects — **a created agent will not appear until a manual reload**, and the ticket ships green.
**AC-21 makes this structural** rather than a thing someone has to remember, which is the only
reason it is worth a check rather than a sentence. *(This section cited AC-16 until 2026-08-21;
AC-16 is the cross-project ownership check, so the trap it claimed was covered had no check at all.
Caught in review of #27.)*

---

## §7 — Risks

1. **The client boundary swallows the board.** §3.4. Mitigated by `lib/tasks/dnd.ts` and AC-1;
   `Board.tsx` and `Card.tsx` **stay server components**, composing client wrappers around
   server-rendered children.
2. **The drawer eats its own errors.** `showModal()` must be called from an effect, never during
   render; `<dialog open>` is *not* modal; `method="dialog"` bypasses the action entirely;
   `useActionState` state survives close/reopen unless the children are re-keyed; `Esc` during a
   pending submit must be prevented. AC-9 and AC-10 cover the decision, M-3 covers the browser.
3. **Drag listeners swallow the buttons.** A whole-card drag handle eats `Run now` and `Approve`.
   `PointerSensor` with `activationConstraint: { distance: 4 }` — and click both by hand.
4. **No optimistic update.** A card that snaps to `done` before the server accepted it is a status
   displayed without a check — invariant 2, inside the product built to catch exactly that. The
   move waits for `revalidatePath`. This is a decision, not a preference.
5. **A known-red suite hides a new one.** Stage 1's AC-2 means `pnpm verify` never exits clean.
   **Compare per-suite counts, not the aggregate** — `docs/HANDOFF.md` §Verified state.
6. **Four stacked branches is the Stage 3b cost pattern repeated.** Mitigated by confining hub-doc
   edits to T4, with only `docs/DECISIONS.md` in T1 because T2–T4 are not permitted without it.
