# Stage 4 — build tickets

Four tickets for [`stage-4-templates-chains.spec.md`](stage-4-templates-chains.spec.md).
**They stack: T2 branches off T1, T3 off T2, T4 off T3 — never off `develop`.**

**No ticket here writes a `docs/DECISIONS.md` entry**, and that is a difference from Stage 3c's T1.
Stage 4's spec closes its eight decisions **inside the spec** (§5), not as D-numbers, because none of
them changes a product invariant — they are build choices with stated reasons. If one surfaces that
*is* a D-number (it changes what the product is, not how this stage is assembled), **stop and close
it in `docs/DECISIONS.md` first**. The next free number is **D42** — D37–D41 are taken by
[`stage-4b-delivery.spec.md`](stage-4b-delivery.spec.md).

## What this stage inherits that is not in the spec

Seven measured facts, carried here so a ticket brief does not have to re-derive them. All measured
**2026-08-22** by reading the named files; fact 6 was found by building T1 rather than by reading.

1. **The advance hook cannot live inside `writeTaskTransition`.** The obvious home for §3.4's
   *"when a task with a `chainId` reaches `done`, the transition handler calls `dispatch`"* is
   [`lib/agentos/db.ts:511`](../../lib/agentos/db.ts#L511) — and it is the wrong one twice over. It
   is **synchronous** and `dispatch` is not, and `db.ts` would have to import `dispatch.ts`, which
   already imports `db.ts` — a cycle. The hook goes at the **call sites**, and there are exactly
   three that can produce `done` (item 2). T3 owns that.
2. **Three call sites produce `done`, and no fourth.** `moveTaskForSlug`
   ([`app/p/[slug]/[tab]/actions.ts:324`](../../app/p/%5Bslug%5D/%5Btab%5D/actions.ts#L324) — a drag,
   which the gate refuses on a gated task but permits on an ungated one), `approveDoneAction`
   ([:390](../../app/p/%5Bslug%5D/%5Btab%5D/actions.ts#L390)), and the MCP handler
   ([`lib/agentos/mcp/agentos-server.ts:108`](../../lib/agentos/mcp/agentos-server.ts#L108)). The
   other two `writeTaskTransition` callers — `sweep.ts:85` and `dispatch.ts:268`/`:430` — write
   `todo` and `doing` only and are **not** advance sites. Verified by
   `grep -rn writeTaskTransition lib app`.
3. **`data/agentos.sqlite` on the owner's machine is populated, not empty** — it holds a `Project`
   row for `agentic-os`, `Agent` rows, and at least one `Task`. **The exact counts are deliberately
   not written here**: they are volatile, `CLAUDE.md`'s convention keeps such values in
   `docs/HANDOFF.md`'s *Verified state* block alone, and a ticket brief that states them ages
   silently. Reproduce with `sqlite3 data/agentos.sqlite ".tables"` and a `count(*)` per table.
   What matters and does not rot: **Stage 4's migration runs against a live database with real rows
   in it**, so a migration that drops or recreates `Task` destroys the owner's data. `migrate()`
   ([`db.ts:169`](../../lib/agentos/db.ts#L169)) applies only migrations above `PRAGMA user_version`.
   **Add migration 2. Never edit migration 1.**
4. **The seeded template names six non-human agents, and *none* of them exists in this project.**
   AgentOS-spec §10's steps name `spec`, `plan`, `review-coordinator`,
   `implementation-plan-executioner`, `senior-dev`, `librarian` — six distinct names — plus the
   literal `human` at step 9. The `Agent` rows that exist here are named `ux-ui-designer` and
   `frontend developer`, and neither matches any of the six. So **instantiating the seeded template
   in `agentic-os` today refuses at §3.3's rule 2**, naming the first unresolved step. That is the
   spec working, not a defect — but T2's fixtures must seed the agents explicitly and must **not**
   relax rule 2 to make a test pass. *(An earlier draft of this line said "five", which was
   arithmetic done while writing rather than counting: it is six, and the count is the whole point
   of the fact.)*
5. **The `templates` flip is already safe.** `SETUP_ROWS`
   ([`lib/shell/model.ts:134`](../../lib/shell/model.ts#L134)) carries
   `{ key: "templates", state: "placeholder", builtBy: "Stage 4 — templates and chains" }`.
   `verify:stage3c` AC-7 derives each row's expectation from that row's own `state`, so flipping to
   `{ state: "live", builtBy: null }` passes with **no edit to that suite** — confirmed in spec §5.8,
   which also records that the first version of this paragraph was wrong about it.
6. **Adding a table turns `verify:stage3c` AC-17 red, and T1 is the ticket that fixes it.**
   AC-17 ([`scripts/verify-stage3c.mts:728`](../../scripts/verify-stage3c.mts#L728)) reads the
   `CREATE TABLE IF NOT EXISTS` names out of `db.ts` and compares them against an **explicit
   eight-name list** — it is a named set, not a bare count, which is why the fix is safe and why
   it is small. Its purpose (D32, and the `Environments`/`Repos` entry in `docs/BACKLOG.md`) is
   that **a SETUP placeholder must not quietly acquire a schema nobody decided on.** Stage 4's
   three tables are decided on — spec §3.1 defines them — so **T1 adds `Chain`, `TaskTemplate` and
   `TemplateStep` to that list and the guard keeps working unchanged**: any table not in the list
   still fails it.
   **This is a correction to this ticket, found while building it (2026-08-22).** The first version
   said *"must not touch any other `verify-*.mts`"* with no exception, which collides head-on with
   T1's own done criterion of no new red — the two could not both hold. **Do not defer this to T4.**
   Deferring means T1, T2 and T3 each ship with a red suite, and a suite that is red across three
   tickets is exactly how a real regression hides in the noise. T2 and T3 add no tables and will
   not touch AC-17 again.
7. **Nothing in this stage makes a chain's output reachable.** A completed chain leaves nine tasks
   and up to nine sessions, each with commits on a **detached HEAD in a destroyed worktree**. Step 9
   of the seeded template reads *"Human checks out the PR, reviews, merges"* — and there is no PR,
   because nothing in the product creates one. That is
   [`stage-4b-delivery.spec.md`](stage-4b-delivery.spec.md)'s whole subject. **Do not let it leak
   into this stage:** a ticket here that starts creating branches has stopped building Stage 4.

## Standing constraints — every ticket

- **Base check in every brief:** the expected sha **and** a structural tell. For this stage the
  cheap structural tells are `ls lib/agentos/chain.ts` (must be **absent** at T1, present from T2)
  and `grep -c 'CREATE TABLE' lib/agentos/db.ts` (8 at T1's base, 11 after). A missing file is a
  faster tell than a hash comparison, and sub-agents in this project have started from the wrong
  base four times. Worktrees are created **by hand** from the named branch:
  `git worktree add -b <branch> <path> <base>`, then `pnpm install` inside it — never the tool's
  default base, which is `origin/main`.
- **This stage adds no new test seam.** Spec §7 states it and §1 says why: if you need a third
  seam, either step 3's fan-out crept back in or the chain grew a scheduler. **Stop and say so**
  rather than adding one.
- **Every decision that can be wrong goes in `lib/`.** No acceptance script imports a component
  (`docs/LEARNINGS.md`, 2026-08-19). AC-6 and AC-9 assert **rendered strings produced by pure
  functions**, not rendered components.
- **Every new server action gets a hostile ownership check** — the AC-8b/AC-6b shape from
  `verify-stage3b.mts`. Reuse `resolveOwnedTask`; do not write a fifth one. Note the trap recorded
  in `stage-3c-tickets.md`: `resolveOwnedTask` now threads an injected db — keep it threaded.
- **Guards must be proven.** For each `[G]` check, commit the sin, observe red, revert. A guard
  never seen red is decoration.
- **`package.json`: insert the `verify:stage4` key, never edit the `verify` key.** `verify-all.mts`
  discovers suites; a hand-maintained list is what made two branches collide over a question
  containing no disagreement.
- **In JSX, interpolate complete strings.** `step {n} of {total}` is fine; a newline falling between
  `of` and `{total}` is the defect that has shipped twice. Spec §3.3 calls out that this stage's
  version of that bug is an unbound `{{variable}}` — same class, more expensive.
- **Nothing client-reachable may value-import `lib/agentos/db` or a `node:` builtin.**
  `verify:stage3c` AC-1 walks the graph and asserts it. `chain.ts` will import `db` and `dispatch`,
  so **anything a card renders from a chain must be a pure function in a leaf module** — the
  `lib/tasks/dnd.ts` pattern, not the `lib/tasks/model.ts` one.

---

## T1 — schema, the seeded template, and the suite

**Branch:** `feat/stage-4-t1-schema` off `develop`.
**Closes:** no spec AC (every one of AC-1…AC-11 needs `chain.ts`, which T1 does not own). Creates
the suite and adds **AC-0a…AC-0c**, three structural checks of its own, numbered outside the spec's
range so a later reader can see they are ticket-level.

**Owns:**
- `lib/agentos/db.ts` — **migration 2 only**: `TaskTemplate`, `TemplateStep`, `Chain`, plus
  `ALTER TABLE Task ADD COLUMN chainId` / `chainOrd` (both nullable, no default). Row accessors:
  `createTemplate`, `getTemplateBySlug`, `listTemplatesByProject`, `listTemplateSteps`,
  `createChain`, `getChain`, `haltChain`, `listTasksByChain`.
  **`Chain` also carries `lastDispatchedOrd` (integer, default 0)**, which is *not* in spec §3.1's
  schema block — it is a build-level addition, not a decision, and it exists solely so T3's advance
  can claim a step atomically instead of reading then writing. See T3's AC-10 note for why the
  obvious rule fails. Raised in review of #33.
- `lib/agentos/types.ts` — `TaskTemplateRow`, `TemplateStepRow`, `ChainRow`; `TaskRow` gains the two
  nullable fields.
- `lib/agentos/db.ts` — **and `CreateTaskInput` / `createTask` gain optional `chainId` and
  `chainOrd`.** Easy to miss and it blocks T2 outright: T2 is restricted to *read* accessors in
  `db.ts`, so if the existing write path cannot persist the two columns, `instantiateTemplate` has
  no permitted way to link the nine tasks it creates and T1's hand-off is unbuildable. Raised in
  review of #33.
- `lib/agentos/templates/compound-engineer.ts` (new) — the nine steps **as exported data, not as a
  migration fixture**, so AC-11 can edit the template row underneath a running chain and prove the
  chain ignores it. Slug `compound-engineer-workflow`, display name `compound-engineer` (spec §3.1's
  one-template-two-identifiers rule). Gates at steps 1 and 9; step 9's `assigneeAgentName` is the
  literal `human`. Agent names exactly as AgentOS-spec §10 lists them (see inherited fact 4).
  Step 3 is **one `review-coordinator` session instructed to produce three named reviews and a
  consolidated must-fix / should-fix list** — spec §5.4, not four spawned agents.
- `lib/agentos/templates/seed.ts` (new) — idempotent seeding of the built-in template into a
  project, keyed on `(projectId, slug)`. Called from `initializeProject`; **re-initialising an
  already-initialised project must not create a second copy.**
- `scripts/verify-stage4.mts` (new), `package.json` (the `verify:stage4` key).

**May touch:**
- `app/p/[slug]/[tab]/actions.ts` — **the seeding call inside `initializeProject`, nothing else.**
  Note it needs to fire on **both** branches, not only the row-creating one: a project initialized
  before Stage 4 shipped takes the *already initialized* path on every later click and would
  otherwise never receive a template.
- `scripts/verify-stage3c.mts` — **the `expected` array inside AC-17, and nothing else in that
  file.** Add `Chain`, `TaskTemplate` and `TemplateStep`, keep the list sorted, and update the
  check's pass message from *"eight tables"* to the new count. Inherited fact 6 has the reasoning;
  do not touch AC-20's oracle or any other check there.

**Must not touch:** migration 1; `lib/agentos/dispatch.ts`; `lib/shell/model.ts`; any component; any
other `verify-*.mts`, and nothing in `verify-stage3c.mts` outside AC-17's `expected` array.

**The three checks:**
- **AC-0a — the migration is additive and idempotent.** Open a fixture db seeded with a Project, an
  Agent and a Task at migration 1's schema; migrate; **the Task row is byte-identical** and its two
  new columns are `NULL`. Migrate twice; no error, `user_version` lands on 2.
- **AC-0b — the seeded template is what §10 describes.** Nine steps, `ord` 1–9 with no gap,
  `approvalGate` true on exactly steps 1 and 9, step 9's `assigneeAgentName === 'human'`, and every
  other step's name non-empty. **Asserted against the exported data**, so a typo in a step name
  fails here rather than three tickets later.
- **AC-0c — seeding is idempotent.** Seed twice into one project; exactly one `TaskTemplate` row.
  `[G]` — delete the `(projectId, slug)` guard, observe red, revert.

**Done criteria:** `pnpm verify:stage4` green; `pnpm verify` no new red **compared per-suite** (not
by total, which the Verified state block records as moving for reasons unrelated to any branch).

**Hand-off to T2:** the three tables exist, `Task` carries both nullable columns, the seeded
template is readable from a project by slug, and `verify-stage4.mts` runs with a fixture-db helper
T2 can extend. `chain.ts` does not exist yet — T2 creates it.

---

## T2 — instantiate, all-or-nothing

**Branch:** `feat/stage-4-t2-instantiate` off `feat/stage-4-t1-schema`.
**Closes:** AC-1, AC-2, AC-3, AC-11.

**Owns:**
- `lib/agentos/chain.ts` (new) — **the instantiate half only.** `instantiateTemplate({ db,
  projectId, templateSlug, variables })` → `{ ok: true, chainId, taskIds } | { ok: false, reason }`.
  Resolves everything before writing anything (spec §3.3): every `{{var}}` in every step prompt,
  every `assigneeAgentName` against this project's agents, and the project's execution layer and
  primary repo. **Any failure writes zero rows** and the reason names *the step and the thing that
  failed*.
- `lib/agentos/chain-render.ts` (new, **leaf — no `db` import**) — `bindPrompt(template, vars)`
  returning `{ ok, text } | { ok: false, missing: string[] }`, and `chainPositionLabel(ord, total,
  templateName)` → `step 3 of 9 · compound-engineer`. Pure, because T4 renders it from a client
  component and `verify:stage3c` AC-1 walks that graph.
- `scripts/verify-stage4.mts` — adds AC-1, AC-2, AC-3, AC-11.

**May touch:** `lib/agentos/db.ts` — read accessors only, **no schema change**.

**Must not touch:** `dispatch.ts`; anything under `app/`; `lib/shell/model.ts`.

**Three things this ticket must get right, all of which the spec argues for at length:**
1. **An unbound variable is never an empty string** (§3.3). `bindPrompt` returns the missing names;
   it never substitutes `""`. AC-2's second half asserts `SELECT count(*) FROM Task` is *unchanged*
   after the failure — a partial write is worse than no write, because the first three cards would
   run.
2. **`assigneeAgentName` resolves at instantiate, never at dispatch** (§3.1). A name that resolves
   to nothing is a refusal *here*. On the written task the field is `assigneeAgentId`: the resolved
   id, or `null` for `human` — and `null` on a task always means human-only, never unassigned.
3. **The template is copied, not referenced** (§3.1). `Chain.templateVersionJson` holds the template
   and its steps as they were at instantiate. AC-11 edits the template row afterwards and asserts
   the chain's stored prompts and step count are unchanged.

**Hand-off to T3:** nine tasks exist in `todo` with `chainId`/`chainOrd` set, steps 2–9 carry a
`blockedReason` naming their predecessor, and `Chain` rows carry `templateVersionJson`. Nothing
advances yet — T3 makes `done` move the chain.

---

## T3 — advance, refuse, halt

**Branch:** `feat/stage-4-t3-advance` off `feat/stage-4-t2-instantiate`.
**Closes:** AC-4, AC-5, AC-7, AC-8, AC-10.

**Owns:**
- `lib/agentos/chain.ts` — adds `advanceChainAfterDone(taskId, deps)`. Looks up the next `chainOrd`,
  clears its `blockedReason`, and calls **`dispatch(nextTaskId, 'chain')`** — D24's declared trigger,
  through the funnel, never around it (§3.4). A refused dispatch **halts the chain with that
  reason**; it never retries. *A chain that retries is a scheduler, and D24 declined to build one.*
- `app/p/[slug]/[tab]/actions.ts` — calls the hook from **`moveTaskForSlug` and `approveDoneAction`,
  after the transition write, only when the task carries a `chainId`**.
- `lib/agentos/mcp/agentos-server.ts` — the same call from the `task_update_status` handler's `done`
  branch. **This is the path AC-5 is about:** the gate already refuses a session's `done` on a gated
  task, and AC-5's second half asserts that step 2 therefore has **no session row** — Stage 3 proved
  the card does not move; this proves nothing downstream started.
- `scripts/verify-stage4.mts` — adds AC-4, AC-5, AC-7, AC-8, AC-10.

- `lib/agentos/dispatch.ts` — **one hook inside `runSessionToCompletion`'s failure path, and
  nothing else.** This is a deliberate exception to the "must not touch" rule below, and it exists
  because **AC-8 is otherwise unreachable.** A `Runner` that throws is handled entirely inside
  `runSessionToCompletion` ([`dispatch.ts:426-437`](../../lib/agentos/dispatch.ts#L426)), which marks
  the session `failed` and transitions the task `doing -> todo`. It never passes through `done`, so a
  hook that only fires after `done` would leave `haltChain` with **no production caller** — the
  chain would silently stall instead of halting, and AC-8 would be asserting behaviour no code path
  can produce. Raised in review of #33; the ticket previously forbade this file outright.

**Must not touch:** anything else in `lib/agentos/dispatch.ts` — not the five preconditions, not the
worktree lifecycle, not the resume path. If advancing seems to need more than the failure hook, that
is inherited fact 7 leaking in, or a precondition that should have refused. Say so and stop.

**The five that are easy to get subtly wrong:**
- **AC-4 asserts the trigger kind**, not merely that a session appeared. A second dispatch path
  would pass the weaker assertion.
- **AC-7's fixture sets `Project.defaultAgentId`.** The bug being guarded is a human review step
  silently executed by the project's default agent; a test with no default configured would pass
  while the bug was present. `dispatch` precondition 4 already refuses a null assignee — this proves
  it is not defaulted first.
- **AC-8 asserts four facts and one absence, and the first one is not a task status.**
  `TaskStatus` is `todo | doing | review | done` — [`types.ts:20`](../../lib/agentos/types.ts#L20) —
  so *"step 5 failed"* names **the `Session` row** (`SessionStatus` does have `failed`), while step
  5's own **task** is back in `todo`, which is what `runSessionToCompletion` writes. Assert both
  explicitly, plus `Chain.status = 'halted'`, `haltedAtTaskId` = step 5's task, steps 6–9 still
  blocked with a reason naming step 5, and **no session for step 6.** Raised in review of #33: the
  earlier wording would have sent someone looking for a task status that cannot exist.
- **AC-10 is asserted by count, and the guard must be *atomic*, not a read-then-write.** Re-issuing
  `done` on step 1 must not produce a second session for step 2. **The rule an earlier draft gave —
  "refuse if the next task already has any `Session` row" — is wrong**, and review of #33 caught it:
  two `done` transitions can both read "no session", both clear `dispatch`'s async preconditions, and
  both insert, because nothing serialises them and no unique constraint exists. A `Session` row also
  cannot be made unique per task — a failed step that is re-dispatched legitimately has two.
  **Use an atomic claim on the `Chain` row instead:** `Chain` carries `lastDispatchedOrd`, and
  advance does `UPDATE Chain SET lastDispatchedOrd = :ord WHERE id = :id AND lastDispatchedOrd <
  :ord`. SQLite applies that as one statement; if it affects zero rows, another caller already
  claimed the step and this one returns without dispatching. **T1 adds the column** (it is in
  `Chain`'s definition for this reason). Assert both the sequential re-issue *and* two advances
  raced against one another.
- **A human step ends the automation, not the chain** (§3.5). Nothing dispatches after step 9
  because there is no step 10. That is not a special case in the code; it is the absence of one.

**Hand-off to T4:** the whole cycle runs headless. `pnpm verify:stage4` covers AC-1…AC-11 except
AC-6 and AC-9's rendered half. T4 adds no logic.

---

## T4 — the UI, and the SETUP row goes live

**Branch:** `feat/stage-4-t4-ui` off `feat/stage-4-t3-advance`.
**Closes:** AC-6, AC-9. Ships the stage.

**Owns:**
- `lib/shell/model.ts` — **the `templates` row only**: `state: "live"`, `builtBy: null`. Inherited
  fact 5 records why this needs no edit to `verify:stage3c`. **Do not touch `EXECUTION_TABS`.**
- `app/p/[slug]/config/[section]/page.tsx` — the `templates` section renders the project's
  templates, replacing the *"Stage 4 — templates and chains"* placeholder rather than inventing a
  home (spec §5.8).
- The instantiate form — **on the Tasks board beside `+ Task`**, not in setup. A template is setup;
  instantiating one is work.
- `components/tasks/…` — the chain position chip (`step 3 of 9 · compound-engineer`, from
  `chainPositionLabel`, **never from a hardcoded 9** — AC-9) and the `blocked` chip. Stage 3 §8.2
  already specifies both; this renders them, it does not redesign them.
- The gate label — **`Approve & start step 2 (@plan)`**, never a bare "Approve" (AC-6). Composed by
  a pure function in `chain-render.ts` so the suite asserts the string without rendering a route.
  *A bare "Approve" is how an unattended five-hour spend gets authorised by accident.*
- `scripts/verify-stage4.mts` — adds AC-6 and AC-9.
- `docs/FEATURES.md`, `docs/HANDOFF.md`, `docs/BACKLOG.md` — the stage's doc close-out, **in this
  ticket's commits, never a separate docs commit.** The eleven behaviour rows in spec §2 ship into
  `FEATURES.md` verbatim-ish, each with its verify column pointing at the AC that proves it.

**May touch:** `app/globals.css` — **custom properties only; not one hex may change.**

**Must not touch:** `app/board.css`; `components/shell/PortfolioRail.tsx`; `lib/reconcile/*`.

**Done criteria** — all four: `pnpm verify:stage4` green at **fourteen** checks (AC-0a…AC-0c plus
AC-1…AC-11 — and **state the number you actually measure**, because this one is arithmetic done
before the suite existed, which is exactly the class of value `docs/HANDOFF.md`'s *Verified state*
block exists to hold); `pnpm verify` no
new red compared per-suite; the templates row renders at `/p/agentic-os/config/templates` with the
seeded template listed; and **the instantiate refusal observed by hand** — clicking instantiate in
`agentic-os` today must refuse naming an unresolved agent (inherited fact 4), and that refusal is
the stage working. Record what it actually said.

## The measurement this stage owes

One, and it is owner work rather than build work, in the shape Stage 3c established:

- **Instantiate the seeded template for real, once, in a project whose agents resolve** — and look
  at nine cards. Spec §3.2 argues that nine visible cards, eight of them blocked, is *"a forecast
  the human can read, argue with, and cancel"*, and that the alternative is a plan the system keeps
  to itself. Nobody has seen it. The failure mode is that nine blocked cards read as **nine stalled
  tasks** rather than one plan — which the `blocked` chip is supposed to prevent and which no
  fixture can measure. If it reads wrong, that is a design finding for Stage 5's board, not a bug.
