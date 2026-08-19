# Spec — Stage 3b: make it reachable

status: ☐ **one owner decision open** — §5.1 (what creates a `Project` row). Everything else is
closed. Sequenced **between Stage 3 and Stage 4**, and the reason is in the box below.

> **Stage 3 is complete and cannot be used.** Every mechanism works and is covered by 33 checks —
> `dispatch`, the two-layer gate, the inbox pause and resume, the boot sweep, the Tasks board. But
> **nothing turns an `agentos.yml` on disk into a `Project` row**, so no watched repo has an
> execution layer to dispatch into, and the only way to create an agent or a task is to write a
> seed script. The owner has never run the cycle end to end.
>
> **Why this comes before Stage 4 rather than inside it.** Stage 4 composes chains out of
> dispatch + gates, and its own spec opens by saying it introduces no new machinery — it is
> sequencing over parts that *have already run*. Building it now would sequence parts that have
> never run once. That is this product's own thesis pointed at itself (PRD §12.1): work built on a
> premise nobody checked. **Closing the loop is cheaper than debugging a chain whose every step is
> unproven.**
>
> **What this stage is not.** It is not the Agents view as a product surface, not templates, not
> goals, and not multi-user identity. It is the smallest thing that lets a human create an agent,
> assign it a task, run it, answer it, and approve it — using surfaces that already exist.

---

## §1 — Scope

**In:**

1. **Initialize a project** — turn an `agentos.yml` on disk into a `Project` row, on an explicit
   click, with the repo path read from the Board rather than typed.
2. **Create and edit an agent** — name, monogram, model, role prompt, tool grants, `canCommit`,
   `maxTurns`, `maxBudgetUsd`. Lives behind **configuration** (D23 §8.1), not in the five-tab rail.
3. **Create a task** — title, description, assignee (an agent or **human-only**), approval gate on
   or off. The assignee is set **at creation** and never at dispatch (§7.1 of the Stage 3 spec).
4. **`pnpm verify:stage3b`** — fixture-based, model never called.
5. **A `docs/HUMAN-TEST.md` walkthrough that now ends in a real cycle**, replacing its current
   "what is not true yet" item 1.

**Out** — each is a later stage or already has a home:

- **Templates, chains, goals, the orchestrator.** Stages 4 and 5, unchanged by this.
- **Editing an agent mid-session.** A session composed its options at spawn; changing the row
  underneath it would make the session's own record unreadable. Refuse while a session is running.
- **Deleting a project, agent, or task.** Deletion touches evidence — a `Session` names an
  `Agent`, a `TaskEvent` names a `Task`. What deletion should mean when a row is cited by history
  is a real decision and it is not this stage's. → `docs/BACKLOG.md`.
- **Multi-user identity.** `actorId: "owner"` stays the single human identity (T7's convention).
- **Discovering projects.** The watched set is `projects.config.ts` and stays that way; this stage
  only connects a project the Board already shows.

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Initializes a project that has an `agentos.yml` | The Tasks page stops saying *not initialized* and shows an empty four-column board | AC-1 |
| Refuses to initialize a project with no `agentos.yml` | Stated reason; no row written | AC-2 |
| Initializing twice is a no-op, not a duplicate | Second click reports *already initialized*; still exactly one row | AC-3 |
| Creates an agent | It appears as an assignee option, with its monogram | AC-4 |
| Refuses an agent whose tool grants would widen egress | `WebFetch`/`WebSearch` are stripped and stated, not silently accepted | AC-5 |
| Creates a task with an agent | The card appears in `todo`, carrying that agent's monogram | AC-6 |
| Creates a human-only task | `assigneeAgentId` is null; **Run now** is absent, not disabled-looking | AC-7 |
| Refuses to edit an agent with a live session | Stated reason naming the session | AC-8 |
| The whole cycle runs | Create agent → task → run → inbox → answer → review → approve → `done`, with evidence on every transition | AC-9 |

## §3 — Data & sources

### 3.1 No new tables

`Project`, `Agent` and `Task` already exist with every column this stage writes (Stage 3 §3.7).
**If this stage needs a schema change, something has been misread** — the same warning Stage 4's
spec opens with, for the same reason.

The one thing that does not exist is the *connector*: a `Project` row's `primaryRepoPath` is what
`lib/tasks/data.ts` resolves against, and nothing writes it.

### 3.2 The slug problem, already solved once

The Board's slug (`lib/shell/model.ts`'s `slugFor`) and `Project.slug` are two independently-typed
strings with no shared source of truth. T7 already refused to match them: it resolves by
**`primaryRepoPath`**, the one fact both records derive from the same place. Initialization must
write that path from the Board's own project entry — **never from a form field** — so the two
cannot diverge at creation either.

### 3.3 Reading `agentos.yml`

D18 made the file's *presence* the opt-in signal, and `hasExecutionLayer` already checks exactly
that. This stage reads its *contents* for the first time, which makes it an external format:
**`external-API-fields-are-guilty-until-verified` applies.** Capture a real file before parsing it,
and treat every field as optional with a stated default rather than assuming a shape. A malformed
yaml is a refusal with the parse error shown verbatim, never a partially-created project.

## §4 — Acceptance

**Fixture repos in a temp dir; the model is never called.** Same harness as Stage 3 — reuse
`makeDispatchFixtureRepo` and friends rather than starting a parallel family.

- **AC-1 — initialize writes exactly one row**, with `primaryRepoPath` equal to the Board's own
  path for that project, and the Tasks page stops rendering *not initialized*.
- **AC-2 — no `agentos.yml`, no project.** Refused with a stated reason; **zero** new rows.
- **AC-3 — initializing twice is idempotent.** Second call reports already-initialized and the row
  count is still one. Assert the count, not the absence of an error.
- **AC-4 — an agent round-trips.** Every field written is read back unchanged, including the JSON
  tool columns.
- **AC-5 — the egress floor holds at creation.** Submit an agent **asking for** `WebFetch` and
  `WebSearch`; assert they are absent from `allowedToolsJson` and present in `disallowedToolsJson`,
  and that the UI said so rather than silently dropping them. *Hostile fixture, per the lesson from
  T3: an invariant enforced only by seed data is enforced by nobody.*
- **AC-6 — a task is created with its assignee bound at creation**, and `dispatch` on it succeeds.
- **AC-7 — a human-only task refuses dispatch by precondition 4**, naming it. This is the check
  that keeps §7.1's distinction real: a null assignee is *deliberately human*, never *unassigned*.
- **AC-8 — an agent with a running session cannot be edited.** Refused with a reason naming the
  session; the row is unchanged afterwards.
- **AC-9 — the full cycle, in one test.** Create agent → create task → `dispatch` → the scripted
  fake asks a question → answer it → the fake moves the card to `review` → the human approves →
  `done`. Assert **every** transition has a `TaskEvent` with the right actor, and that the final
  card's evidence line resolves to a real session id. This is the check that proves the loop, and
  it is the one to write first.

**Not covered here, deliberately:** AC-12 in the Stage 3 suite is still the only check that runs a
real agent, and it is still opt-in. **Stage 3b's value is only realised once a human runs the cycle
by hand** — the suite proves the parts connect, not that the product works.

## §5 — Decisions

### 5.1 What creates a `Project` row? — **OPEN, owner**

Three readings, and they differ in more than effort:

**(a) An explicit "Initialize" button on the Tasks page's *not initialized* pane.** The page already
detects the state and says so; the button is next to the sentence explaining the problem.
*Recommended.* It is one click, it is where the confusion already is, and it keeps creation an
explicit human act — consistent with invariant 4, where nothing is written without a click.

**(b) A CLI command** (`pnpm agentos:init <slug>`). Cheapest to build and easiest to script, but it
puts the first step of the product's own onboarding outside the product, and the owner has said the
goal is to test the cycle *through the UI*.

**(c) Automatic on `agentos.yml` appearing.** Rejected on sight, recorded so it is not re-proposed:
a filesystem watcher that creates records is a process that acts without being asked — the exact
shape D24 refused for dispatch, and PRD §12.1's whole subject.

**This needs the owner because it is the product's first-run experience**, not because it is
technically hard. Once chosen it is a two-line change either way.

### 5.2 Where does agent configuration live? — closed

Behind **configuration**, not in the five-tab rail. D23 §8.1 fixed the rail at five and said the cap
is load-bearing: Agents, Templates, Environments and Repos are configuration, and the work-versus-
setup split holds only while there is nowhere for them to creep into. A sixth tab would be a
decision against D23, not a convenience.

### 5.3 Can an agent be edited while it is running? — closed, no

A session composes its SDK options from the `Agent` row **at spawn** and records nothing about what
that row said. Editing underneath a live session would make the session's own record unreadable
after the fact — you could not answer *"what was this agent allowed to do when it ran?"*. Refused
with a reason naming the session (AC-8). Editing between runs is fine and needs no versioning,
because §7.5's drift snapshot already covers *"what did we believe when this started"* for the part
that matters.

### 5.4 Does the tool-grant form let you type any tool name? — closed, no

A fixed list with checkboxes, plus the egress floor applied on save regardless (AC-5). A free-text
field invites a typo that silently grants nothing — or, worse, silently grants something. The list
is short and the floor is in code either way (`composeOptions`, Stage 3 §5.7).

### 5.5 Which repo do the first real runs target? — already closed as **D27**

`fractal-code`, with `canCommit` seeded `false`. Nothing here re-opens it; this stage is what makes
acting on it possible.

## §6 — Build notes

Order matters, and it is short:

1. **The connector** — read `agentos.yml`, write the `Project` row, with AC-1/2/3 written first.
   This is the whole blocker; everything else is a form.
2. **Agent create/edit** behind configuration, with AC-5's hostile fixture written **before** the
   form, so the floor is proved rather than assumed.
3. **Task create**, reusing the Tasks board's existing card model — no new render path.
4. **AC-9, the full cycle**, last and most important.
5. **`docs/HUMAN-TEST.md`** updated: item 1 of *What is not true yet* should become a walkthrough
   with real steps.

**Reuse rather than re-derive:** `lib/tasks/data.ts` for reading, `app/p/[slug]/[tab]/actions.ts`
for the server-action pattern (**including its ownership check** — every new action resolves the
project server-side and refuses anything that does not belong to it), `lib/agentos/db.ts`'s existing
`createProject` / `createAgent` / `createTask`, and the Stage 3 fixture helpers.

**A note for whoever builds this.** The temptation is to make initialization clever — scan for yaml
files, offer a picker, auto-detect agents from a config block. Every one of those is a process that
does something nobody asked for. **One button, one row, one stated reason when it refuses.**

## §7 — Test seams

| Seam | What it substitutes | Used by |
|---|---|---|
| **`Runner`** | the Agent SDK — the scripted fake, unchanged from Stage 3 | AC-9 |
| **the fixture repo** | a real watched project — a temp-dir git repo with an `agentos.yml` | AC-1, 2, 3, 6, 7, 9 |

**No new seam.** If this stage needs one, the thing being built is bigger than the stage.
