# Stage 3c — build tickets

Four tickets for [`stage-3c-board-and-rail.spec.md`](stage-3c-board-and-rail.spec.md).
**They stack: T2 branches off T1, T3 off T2, T4 off T3 — never off `develop`.**

## What this stage inherits that is not in the spec

Three measured facts, carried here so a ticket brief does not have to re-derive them:

1. **`lib/tasks/model.ts` cannot be imported from a client component.** Its line 2 imports
   `gateRefusalReason` from `lib/agentos/mcp/gate.ts`, whose line 17 value-imports `../db`, whose
   line 20 imports `node:sqlite`. Verified 2026-08-21 by reading the three files. Spec §3.4.
2. **`LEGAL_TRANSITIONS` exempts `human` entirely** (`lib/agentos/db.ts:497`). There is no layer
   beneath the server action that would refuse an illegal human move. Spec §3.2.
3. **`develop` did not contain `agentos.yml` when this was written.** Spec §6.0 — an owner merge
   gates the whole stage. **Check it structurally, every time:** `git show develop:agentos.yml`
   either prints the file or exits non-zero. Do not check a PR number, and do not pin a sha here —
   branch heads live in `docs/HANDOFF.md` §Verified state and nowhere else.
4. **`resolveOwnedTask` does not honour an injected database.** `app/p/[slug]/[tab]/actions.ts:181-189`
   calls `loadProjectExecutionData(...)` with no override and then `getTask(getDb(), ...)`. So
   passing `{ db }` to a new action that reuses it reaches the **real** store, not the fixture —
   AC-13 and AC-16 would silently exercise `data/agentos.sqlite`. Threading the db through the
   helper and its loader is T3's work, and it is a prerequisite for its own checks being meaningful.

## Standing constraints — every ticket

- **Base check in every brief:** the expected sha **and** a structural tell (`ls agentos.yml
  lib/tasks/dnd.ts` as appropriate). A missing file is a faster tell than a hash comparison, and
  four sub-agents in this project have already started from the wrong base. Worktrees are created
  **by hand** from the named branch: `git worktree add -b <branch> <path> <base>`, then
  `pnpm install` inside it — never the tool's default base, which is `origin/main`.
- **Every decision that can be wrong goes in `lib/`.** No acceptance script here imports a
  component (`docs/LEARNINGS.md`, 2026-08-19).
- **Assert what you own, not what your dependency promises** (`docs/LEARNINGS.md`, 2026-08-18).
  The browser's `<dialog>` semantics and dnd-kit's pointer maths are measured by hand, not asserted.
- **Every new server action gets a hostile ownership check** — the AC-8b/AC-6b shape from
  `verify-stage3b.mts`. Reuse `resolveOwnedTask`; do not write a fourth one.
- **Guards must be proven.** For each `[G]` check, commit the sin, observe red, revert. A guard
  never seen red is decoration.
- **`package.json`: insert a `verify:*` key, never edit the `verify` key.** `verify-all.mts`
  discovers suites; a hand-maintained list is what made two branches collide over a question
  containing no disagreement.
- **In JSX, interpolate complete strings.** Never let a newline fall between literal text and an
  expression continuing the same word — this has shipped twice.

---

## T1 — decisions, the rail, and the setup routes

**Branch:** `feat/stage-3c-t1-rail` off `develop`, **only once `git show develop:agentos.yml`
succeeds** (spec §6.0).
**Closes:** AC-1..AC-8, AC-17, AC-19. Creates the suite.

**Do first, in its own commit:** write **D32–D36** into `docs/DECISIONS.md`. T2, T3 and T4 are only
permitted by D34, D33/D36 and D32 respectively; a later ticket discovering an unwritten decision is
the gate failing.

**Done criteria** — all three, not two of three: `pnpm verify:stage3c` green; `pnpm verify` no new
red **compared per-suite**; and the duplicate `showsRunControl` import at
`scripts/verify-stage3b.mts:70` **deleted**. The deletion is mandatory. It is *not* currently
breaking anything — measured 2026-08-21, that suite passes 18 of 18 with the duplicate present,
because `tsx` tolerates a repeated binding — so do not report it as a fix to a red suite. It goes
because dead code surviving on a bundler's tolerance is a trap for whoever next changes the
toolchain.

**Owns:**
- `docs/DECISIONS.md`
- `lib/shell/model.ts` — adds `SetupRow`, `SETUP_ROWS`, `setupSectionFor`, `driftLineFor`,
  `NavRow`, `ProjectRailModel`, `projectRailModel`; extends `ProjectNav` with `setup`
- `components/shell/ProjectRail.tsx` — becomes a map over `projectRailModel`
- `components/shell/shell.module.css` — rail 172→200px via a single custom property; back row,
  identity block, dividers, `SETUP` label, spacer, footer
- `app/p/[slug]/config/[section]/page.tsx` (new) and `app/p/[slug]/config/page.tsx` (becomes a
  redirect to `/config/agents`)
- `scripts/verify-stage3c.mts` (new), `package.json` (the `verify:stage3c` key)

**May touch:** `lib/agentos/db.ts` (`countOpenInboxByProject` only — **no schema change**),
`lib/tasks/data.ts` (`openInboxCount`), `app/p/[slug]/config/actions.ts` (**the two
`revalidatePath` strings at :120 and :172, nothing else**), the four rail call sites,
`app/globals.css` (**one non-colour custom property; not one hex may change**),
`scripts/verify-stage3b.mts` (**delete the duplicate import at line 70**).

**Must not touch:** `EXECUTION_TABS`; `components/shell/PortfolioRail.tsx`; `app/board.css`;
`lib/reconcile/*`; anything under `lib/agentos/mcp/` except the D36 signature change.

**Hand-off to T2:** `app/p/[slug]/config/[section]/page.tsx` exists and renders the Agents list
exactly as `config/page.tsx` does today — list plus the inline `AgentForm` — with
`searchParams.agent` still available. T2 replaces the inline form with the drawer and touches
nothing else in that file's data path.

**Traps:**
- **Fix the two `revalidatePath` strings in the same commit as the route move**, or a created agent
  stops appearing until a manual reload — and **AC-21** is what stops that shipping green. *(These
  tickets cited AC-16 until 2026-08-21; AC-16 is the cross-project ownership check, so the trap had
  no check at all. Caught in review of #27.)*
- **`0` is a fact; `null` is "not counted".** Rendering `0` for an uninitialized project asserts
  "no open questions" about a store never opened. Invariant 2, in the rail.
- **Use one `SELECT COUNT(*)`, not `loadProjectExecutionData`** — that is the N+1 loader already in
  `docs/BACKLOG.md`, and the rail renders on four routes.
- **The wireframe divergence is deliberate** (spec §5.4). Four rows, no `Skills`. Put the reason in
  the spec or the next reader restores the drawing.
- **The rail footer is prose, not a number.** No volatile fact may be restated outside
  `docs/HANDOFF.md` §Verified state.

---

## T2 — the drawer

**Branch:** `feat/stage-3c-t2-drawer` off **T1**. **Closes:** AC-9, AC-10, AC-11. **Measures:** M-3.

**Owns:** `lib/shell/drawer.ts` (new — `drawerOutcome`, `initialDrawerFor`),
`components/shell/Drawer.tsx` (new, `"use client"`), `components/shell/drawer.module.css` (new).

**May touch:** `components/tasks/TaskForm.tsx`, `components/config/AgentForm.tsx` (**the
`useActionState` wiring is preserved verbatim — only the wrapper changes**),
`app/p/[slug]/[tab]/page.tsx` (the inline `<TaskForm>` becomes a `+ Task` trigger),
`app/p/[slug]/config/[section]/page.tsx`, the two module stylesheets, the suite, `docs/FEATURES.md`.

**Must not touch:** either `actions.ts`. **If the drawer appears to need a server-action change,
that is a finding — report it, do not make it.**

**Build.** One `Drawer`: a `<dialog>` opened with `showModal()`, closed with `close()`, styled as a
right-hand sheet with `::backdrop`. **Drop frame `B′2`'s second header button, `configuration`** —
the SETUP rows are the entry point now, and two entry points to one place is the duplication D22
refused.

**The contract, because "takes `children` and a `DrawerOutcome`" is not implementable and the first
draft of this ticket said exactly that** (caught in review of #27). `useActionState` lives *inside*
`TaskForm`/`AgentForm`, so a `Drawer` receiving an opaque `children` node cannot observe the state
that decides whether it closes. Resolve it before writing code, and prefer the first:

- **`Drawer` is presentational and controlled.** Props: `open: boolean`, `onClose: () => void`,
  `title`, `children`. It owns no form state and makes no close decision.
- **Each form owns its own state and calls `drawerOutcome`**, then invokes `onClose()` when the
  verdict says `close: true`. The forms keep their `useActionState` wiring verbatim — that is the
  hand-off contract from T1 and the thing AC-10 checks.
- **The trigger's `open` state lives in a small client wrapper per surface** (`+ Task` on the tasks
  tab; the agents list on `/config/agents`), seeded server-side from `initialDrawerFor` for the
  `?agent=<id>` edit case.

This keeps the wrong-able part — *when does it close* — in `lib/shell/drawer.ts` where AC-9 can
reach it, and leaves `Drawer.tsx` dumb, per CLAUDE.md §Conventions.

**Traps:**
- **`ok: true` is not sufficient to close.** `createAgentForSlug` returns
  `{ok: true, reason: "…denied by the egress floor…"}` on a *successful* create
  (`config/actions.ts:105-110`); closing destroys the note Stage 3b AC-5 requires on screen. This
  is AC-9's third case and its deletion probe.
- **`<dialog open>` is not `showModal()`** — the attribute gives a non-modal dialog with no
  backdrop, no focus trap and no inert background: none of the properties this approach was chosen
  for. The server-rendered `?agent=<id>` case must be an effect.
- **Never `method="dialog"`** — it closes on submit and bypasses the action path.
- **`useActionState` state survives close/reopen.** Re-key the children on an open counter or a
  reopened drawer shows the last result.
- **`Esc` during a pending submit** throws away a refusal that arrives 300ms later —
  `onCancel` must `preventDefault()` while pending.

---

## T3 — drag and drop

**Branch:** `feat/stage-3c-t3-drag` off **T2**. **Closes:** AC-12..AC-16. **Measures:** M-2.

**Owns:** `lib/tasks/dnd.ts` (**new leaf file — the drop rule; inherited fact 1**),
`lib/tasks/model.ts` (**adds `humanRefusalReason` to `GateModel` per D36 — the first draft of this
ticket omitted this file and then required the human wording, which was not buildable**),
`components/tasks/DragBoard.tsx`, `DroppableColumn.tsx`, `DraggableCard.tsx` (new, all
`"use client"`).

**Do first, before the drag work:** thread an optional `db` through `resolveOwnedTask` and
`loadProjectExecutionData` (inherited fact 4). Until that lands, `moveTaskForSlug(..., { db })`
reads the real store and AC-13/AC-16 are testing the wrong database — a hostile check that never
touches the crafted fixture is worse than no check, because it reports green.

**May touch:** `components/tasks/Board.tsx` (**stays a server component**),
`components/tasks/tasks.module.css`, `app/p/[slug]/[tab]/actions.ts` (adds `moveTaskForSlug` +
`moveTaskAction`, **split exactly as `createTaskForSlug`/`createTaskAction` are** so the suite can
inject a `db`), `package.json` (`@dnd-kit/core` only), the suite, `docs/FEATURES.md`.

**Must not touch:** `components/tasks/Card.tsx` — it stays server-rendered and dumb;
`LEGAL_TRANSITIONS` — the `human` exemption is deliberate and adding a row would break
`approveDoneAction`; `lib/agentos/dispatch.ts`.

**Build.** `Board.tsx` (server) wraps its columns in `<DragBoard>` and each card in
`<DraggableCard verdicts={dropTargets(...)}>`, passing **server-rendered children as slots** so no
model code enters the client graph. `onDragEnd` runs `dropVerdict` client-side to refuse instantly,
then calls `moveTaskAction`, which runs the same rule again and is never trusted to have been run.

**Traps:**
- **The refusal string is passed as data** — produced server-side, never imported into the client,
  never retyped. That is how *one reason, one source* survives contact with the bundler.
- **Pass the `human` rendering, not `gateModelFor`'s default.** `gateModelFor` calls
  `gateRefusalReason(task.id)` with the default `"session"` audience, whose text says *"a session
  may not move it to 'done'"* and points at `inbox_ask`. Handing that to `dropVerdict` shows a
  sentence about sessions, and a tool they cannot call, to the person who just dragged the card —
  the exact defect D36 exists to fix. AC-12 asserts the human wording; AC-19 keeps the session
  wording frozen for MCP.
- **The move action must not call `dispatch()`.** Assert behaviourally (AC-15) — an import check is
  worthless because `actions.ts:19` imports `dispatch` legitimately for `runNowAction`.
- **`PointerSensor` with `activationConstraint: { distance: 4 }`**, or a whole-card drag handle eats
  the `Run now` and `Approve` clicks. Click both by hand before claiming it works.
- **No motion on the drop** (spec §8.6) — disable dnd-kit's default drop animation.
- **No optimistic update.** Spec §7.4.
- **`min-width: 0` on the column and card rules, ellipsis on `.agentName`.** A grid child defaults
  to `min-width: auto`, which turns the longest agent name into page-wide horizontal overflow
  rather than a truncation.
- **React 19 StrictMode double-invokes in dev.** `dropVerdict`'s `same-column` case is what makes a
  duplicated `onDragEnd` a no-op — keep it a named case, not an early return.

---

## T4 — docs, and the measurements

**Branch:** `feat/stage-3c-t4-docs` off **T3**. **Closes:** AC-18, AC-20, AC-21.
**Takes:** M-1 (the ribbon — Stage 3a's AC-10), M-1b (the board), M-2, M-3.

**May touch:** the suite, `docs/FEATURES.md`, `docs/HUMAN-TEST.md` (Part 3 gains drag and the
drawer as by-hand steps), `docs/HANDOFF.md`, `docs/LEARNINGS.md`, `docs/BACKLOG.md` (the
`Environments` and `Repos` entries), `docs/specs/stage-4-templates-chains.spec.md` §5.8
(reallocated by D32), `CLAUDE.md` (the doc map and the commands table only).

**Must not touch:** any `lib/` or `app/` file. **If a check needs a production change, that is the
finding.**

**The measurements are the point of this ticket.** Record each in `docs/FEATURES.md` **with its
date and the viewport it was taken at** — Stage 3a's AC-10 is sitting in that file as a computed
estimate presented as a fact, and this ticket exists so that does not happen twice.

**M-1 is the ribbon, and it is the one that closes AC-10.** Write down all three of its parts as
observed: the six project names as rendered (untruncated or not), the freshness line, the back
control. *"Looked fine"* is how it stayed unobserved for three days. **M-1b is the board** and is a
different measurement that this stage adds because the rail grows — do not let one stand in for the
other, which is what the first draft of the spec did.

**Then answer the question M-1b unblocks.** `docs/BACKLOG.md`'s *"The portfolio sidebar should list
the projects"* has as its unblock condition *"the Tasks board having been used with enough real
cards to judge the width question D23 actually traded against."* M-1 is that evidence. Either close
the entry or restate its condition — **do not leave it saying it is waiting for something that has
now happened.**

**Done when** `pnpm verify:stage3c` is green, `pnpm verify` shows no new red **compared per-suite**,
and all three measurements are written down.
