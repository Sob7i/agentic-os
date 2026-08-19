# Stage 3b — build tickets

> **Subordinate to [`stage-3b-onboarding.spec.md`](stage-3b-onboarding.spec.md).** This file adds
> **sequencing, file ownership and hand-off contracts** and nothing else. Where a ticket and the
> spec disagree, **the spec wins** — and that is a bug in this file, worth fixing rather than
> working around.
>
> **It deliberately does not restate the spec.** Every ticket names the sections to read; read them.
>
> **Status:** all decisions closed. §5.1 closed 2026-08-19 as **D30** — an explicit *Initialize*
> button.

## How to work a ticket

Identical to [`stage-3-tickets.md`](stage-3-tickets.md) §*How to work a ticket* — read it there,
it is not restated. The two rules that were most often the ones broken in Stage 3:

- **Write the named acceptance checks first, and prove each structural check by making it fail.**
  Five separate Stage 3 tickets shipped a check that was green for the wrong reason and none was
  self-caught (`docs/LEARNINGS.md`, 2026-08-19). A check you have never seen red is not evidence.
- **Do not commit to a shared branch, do not merge, do not open a PR, do not push.**

## Standing constraints (all tickets)

Inherit [`stage-3-tickets.md`](stage-3-tickets.md) §*Standing constraints* unchanged — no network
or model calls in anything `pnpm verify` runs, no test may touch a watched project,
`lib/reconcile/` must never import `lib/agentos/`, no ORM and **no ninth table** (spec §3.1: *"if
this stage needs a schema change, something has been misread"*), complete strings in JSX, absolute
dates.

Two more that are specific to this stage:

- **Every server action resolves the project server-side and refuses what does not belong to it.**
  `app/p/[slug]/[tab]/actions.ts`'s `resolveOwnedTask` is the pattern and the reason is in its
  comment: T7 shipped three actions without it and review found all three. A new action that takes
  an id from a form and trusts it is the same bug again.
- **One button, one row, one stated reason when it refuses** (spec §6's closing note). Scanning for
  yaml files, offering a picker, auto-detecting agents from a config block — every one of those is
  a process that does something nobody asked for, and D30 chose the button precisely to avoid it.

---

## What this stage inherits that is not in the spec

Three facts measured on `develop` at `8643ef7` on 2026-08-19, each of which changes a ticket:

1. **No watched repo has an `agentos.yml`** — checked all six in `projects.config.ts`. Two
   consequences. (a) Spec §3.3 says *"capture a real file before parsing it"*; there is no real
   file to capture, so **this stage defines the format** rather than reverse-engineering one — T1
   defines it, minimally, and the `external-API-fields-are-guilty-until-verified` posture still
   applies to every field (all optional, each with a stated default). (b) `projectNav` gives a
   project with no `agentos.yml` **zero tabs**, so the *not initialized* pane that D30's button
   mounts on is **currently unreachable for every watched project**. The suite is unaffected —
   fixtures write their own file — but the human walkthrough is blocked until a real one exists,
   which is T4's problem and an owner gate (writing into another repo).
2. **There is no `configuration` surface.** D23 fixed the rail at five tabs and put everything else
   behind *configuration*; nothing was ever built. T2 creates it — that is inside §5.2's closure,
   not a new decision.
3. **`yaml` is not a dependency.** Node has no built-in parser. T1 adds one; see its *Traps*.

---

## T1 — The connector

**Spec:** §1.1, §3.1 (no new tables), §3.2 (the slug problem, already solved once), §3.3 (reading
`agentos.yml`), §5.1/**D30**, §6 note 1.
**Depends on:** nothing. **Everything else stacks on this branch, not on `develop`** — all four
tickets append to the same four hub docs and to `scripts/verify-stage3b.mts`, so parallel branches
collide by construction (`CLAUDE.md` §Git & PR workflow).

**May touch:** `lib/agentos/config.ts` (create), `app/p/[slug]/[tab]/actions.ts`,
`app/p/[slug]/[tab]/page.tsx`, `components/tasks/` (the button's own component + its CSS module),
`scripts/verify-stage3b.mts` (create), `package.json` (add `verify:stage3b` **and** the yaml
dependency — **append the script key, never rewrite the `verify` key**).
**Must not touch:** `lib/agentos/db.ts` (`createProject` already exists and is sufficient),
`lib/agentos/dispatch.ts`, anything under `lib/reconcile/`.

**Build.**

- **`lib/agentos/config.ts`** — a pure `parseAgentosYml(text): ParsedConfig | ParseFailure`. Every
  field optional with a stated default; a malformed file is a **refusal carrying the parser's own
  error message verbatim**, never a partially-created project. Keep the format minimal — the only
  things it can usefully carry are a display/slug name and `maxConcurrentSessions`; `primaryRepoPath`
  comes from the Board and **never from the file or a form field** (§3.2).
- **`initializeProjectAction`** — resolves the board project from the slug **server-side**, reads
  `agentos.yml` from `nav.project.path`, and calls the existing `createProject` with
  `primaryRepoPath` set to the Board's own path. Idempotent: if a row with that `primaryRepoPath`
  already exists, report *already initialized* and write nothing.
- **The button**, on the *not initialized* pane in `app/p/[slug]/[tab]/page.tsx`, next to the
  sentence that already explains the problem. Rewrite that sentence — it currently points at
  `docs/BACKLOG.md` and says connecting a project "is not built by this ticket", which stops being
  true here.

**Traps.**
- **Refusals must reach the screen.** T7's actions `console.error` their refusals because it had no
  surface for them; AC-2 requires *a stated reason*, so this ticket needs one. The smallest honest
  thing is a `useActionState` result rendered next to the button — not a toast system.
- **`getDb()` vs `dbIfExists()`.** The page path must keep using `dbIfExists()` (it must not create
  the store just because someone opened a page); the *action* is the place where creating it is
  correct, because a click asked for it.
- **The yaml dependency.** `yaml` (pure JS, no native build, no runtime network). Adding it is the
  lead's call, already made — but if it pulls transitive dependencies beyond itself, stop and
  report rather than accepting them.

**Checks:** **AC-1, AC-2, AC-3.** AC-3 asserts the **row count**, not the absence of an error.

**Done when:** `pnpm verify:stage3b` is green on three checks, `pnpm verify` shows no new red, and
a fixture project with an `agentos.yml` renders a board instead of the *not initialized* pane.

---

## T2 — Agent create and edit, behind configuration

**Spec:** §1.2, §2 (AC-4, AC-5, AC-8 rows), §4 AC-4/5/8, §5.2, §5.3, §5.4, §6 note 2.
**Depends on:** T1 (a project must exist to own an agent). **Branch off T1, not `develop`.**

**May touch:** `app/p/[slug]/config/` (create the route + its actions), `components/config/`
(create), `lib/agentos/agent-form.ts` (create — the pure part), `components/shell/ProjectRail.tsx`
(the entry point only), `scripts/verify-stage3b.mts`.
**Must not touch:** `EXECUTION_TABS` in `lib/shell/model.ts` — **a sixth tab is a decision against
D23**, and §5.2 says so in as many words. The rail gets a *configuration* link outside the five,
or the route is reached another way; it does not get a tab.

**Build.** A form for name, monogram, model, role prompt, tool grants, `canCommit`, `maxTurns`,
`maxBudgetUsd`, writing through the existing `createAgent`. Tool grants are a **fixed checkbox
list** (§5.4) — no free-text field. Editing is refused while the agent has a `running` or
`waiting-inbox` session, with a reason **naming that session** (§5.3, AC-8).

**Traps.**
- **Write AC-5's hostile fixture before the form.** It submits an agent *asking for* `WebFetch` and
  `WebSearch` and asserts they land in `disallowedToolsJson`, absent from `allowedToolsJson`, **and
  that the UI said so**. The floor already exists at spawn (`composeOptions`, `EGRESS_DENIED`) —
  that is not what AC-5 tests. An invariant enforced only by seed data is enforced by nobody.
- **The pure/dumb split holds here too.** Anything that could be *wrong* — which grants survive,
  whether an edit is refused — belongs in a pure function the suite asserts without rendering a
  route. `lib/shell/model.ts` is the precedent.
- **AC-4 round-trips *every* field, including the two JSON columns.** `canCommit` is stored 0/1 and
  converted at the accessor; a round-trip that reads back `1` instead of `true` is a failure.

**Checks:** **AC-4, AC-5, AC-8.**

---

## T3 — Task create

**Spec:** §1.3, §2 (AC-6, AC-7 rows), §4 AC-6/7, §6 note 3, and Stage 3's spec §7.1 (assignee is
bound at creation, never at dispatch).
**Depends on:** T2 (an agent must exist to assign). **Branch off T2.**

**May touch:** `components/tasks/`, `app/p/[slug]/[tab]/actions.ts`, **`app/p/[slug]/[tab]/page.tsx`**,
`lib/tasks/model.ts`, `scripts/verify-stage3b.mts`.

*Corrected 2026-08-19, during T3's own review: the list omitted `page.tsx`, which is the only mount
point a new form on the Tasks tab can have — T1 was given it for the identical reason. The agent
made the one-line change and reported the gap rather than either stopping or staying silent, which
is the right handling of a file list that is wrong. `lib/tasks/model.ts`'s "only if" qualifier is
also gone: it turned out to be where the Run-now decision belongs, not an optional convenience.*
**Must not touch:** `lib/agentos/dispatch.ts`. AC-7 is satisfied by dispatch's **existing**
precondition 4; if it appears to need a change there, that is a finding — report it.

**Build.** Title, description, assignee (each agent, plus an explicit **human-only** option), and
an approval-gate toggle, reusing the board's existing card model — **no new render path** (§6). A
human-only task shows **no Run now button at all**, not a disabled-looking one (AC-7): the card
must not imply the machine could have done it.

**Traps.**
- **Null assignee means *deliberately human*, never *unassigned*.** The select's copy has to carry
  that distinction, and AC-7 exists to keep it real.
- `createTask` does not default the assignee from `Project.defaultAgentId` and must not start.

**Checks:** **AC-6, AC-7.**

---

## T4 — AC-9, the full cycle, and the walkthrough

**Spec:** §4 AC-9 (*"the check that proves the loop"*), §4's closing note, §6 notes 4 and 5, §7.
**Depends on:** T3. **Branch off T3.**

**May touch:** `scripts/verify-stage3b.mts`, `docs/HUMAN-TEST.md`, `docs/FEATURES.md`,
`docs/HANDOFF.md`, `docs/LEARNINGS.md`, `docs/BACKLOG.md`, `docs/DECISIONS.md`.
**Must not touch:** any `lib/` or `app/` file. **If AC-9 needs a production change, that is the
finding this whole stage exists to surface** — report it, do not patch around it.

**Build.** One test: create agent → create task → `dispatch` → the scripted fake asks a question →
answer it → the fake moves the card to `review` → the human approves → `done`. Assert **every**
transition has a `TaskEvent` with the right actor, and that the final card's evidence line
resolves to a real session id.

Then `docs/HUMAN-TEST.md`: item 1 of *What is not true yet* becomes a walkthrough with real steps.

**Traps.**
- **AC-9 is written first and goes green last.** Spec §4 calls it *"the one to write first"* and §6
  orders it fourth — those are not in conflict: its shape constrains T1–T3, and it can only pass
  once they are all in.
- **The walkthrough is blocked on a real `agentos.yml`, which no watched repo has.** Per D27 the
  first target is `fractal-code`, and creating that file is **a write into another repo — an owner
  gate**. Write the walkthrough so its first step is *"the owner adds `agentos.yml` to
  `fractal-code`"*, with the exact file contents to paste. **Do not create it.**
- **`docs/HUMAN-TEST.md` must not restate a volatile fact.** Suite counts, PR states and branch
  heads live in `docs/HANDOFF.md`'s *Verified state* block, once (`CLAUDE.md` §Conventions).

**Checks:** **AC-9.**

**Done when:** `pnpm verify:stage3b` is green on nine checks, `pnpm verify` shows no new red, and
`docs/HUMAN-TEST.md` ends in a cycle a human can actually run.
