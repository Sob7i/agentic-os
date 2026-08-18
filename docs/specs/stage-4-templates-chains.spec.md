# Spec — Stage 4: templates, gates, and chains

status: ☑ decisions closed — buildable. **Sequenced behind Stage 3**, which owns every mechanism
this stage composes: `dispatch` (D24), the approval gate, the `Runner`, and the fixture harness.
Nothing here is gated on an owner decision; it is gated on Stage 3 existing.

> **The stage with no new machinery.** Every part of a chain already exists in the codebase or in
> Stage 3: an approval gate that refuses a session token (Stage 2's gesture, Stage 3 §3.4), a
> dispatch funnel with a `chain` trigger already declared (D24), and a `blocked` chip that is a
> label rather than a column (Stage 3 §7.6). **If this stage needs a new mechanism, something has
> gone wrong** — check whether the thing being built is really sequencing, or is quietly the goal
> orchestrator arriving three stages early.
>
> Product context: `docs/PRD.md` §10 (Stage 4) and §12.5, which says *why* templates come before
> goals: a chain is approval gates plus sequencing, and both halves have already run.
>
> **Source reference:** [`AgentOS-spec.md`](AgentOS-spec.md) §9.3, §9.4, §10 — *a reconstruction of
> a talk, not a contract.* Where it and this spec disagree, this spec wins (PRD §12).

---

## §1 — Scope

**In:**

1. **`TaskTemplate` + `TemplateStep`** — a named, ordered list of steps, each naming **an agent or
   the literal `human`**, a prompt, and whether it is gated.
2. **Instantiate** — one click turns a template into **N real task cards** in one project, linked
   as a chain, with variables bound.
3. **Chain advance** — a step reaching `done` dispatches the next step through D24's existing
   funnel with `trigger: 'chain'`. No scheduler, no queue.
4. **Human-only steps** — a step whose `assigneeAgentName` is the literal `human` becomes a task
   with `assigneeAgentId = null`: a card only a person can move (§3.5).
5. **The nine-step `compound-engineer-workflow` seeded** (AgentOS-spec §10), with its two human
   gates at steps 1 and 9.
6. **Chain halt** — a failed or interrupted step stops the chain and says which step stopped it.
7. **`pnpm verify:stage4`**, fixture-based, model never called.

**Out** — each is a later stage or a backlog entry:

- **Sub-agent fan-out.** §5.4 — the single largest scope call in this stage, and it changes what
  step 3 means. Read it before building step 3.
- Goals, the orchestrator, and the three rails (Stage 5). A chain is a **fixed** sequence decided
  before it runs; if the next step is *chosen*, that is the orchestrator, and it is not this stage.
- Editing a chain that is already running; re-running a single step in place; branching or
  conditional chains.
- Triggers and cron (PRD §12.7) — a bug-report trigger instantiating the post-bugfix chain is the
  obvious pairing and it still waits for its own pain.
- Attachments on tasks (AgentOS-spec §9.2). The spec step already attaches a file *through the
  worktree*, which is where a spec belongs; a second upload path is a filesystem surface to ACL.

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Lists the templates a project has | `compound-engineer-workflow` appears, seeded | Load `/p/<slug>/configuration/templates` |
| Instantiates a template as a chain | **Nine cards** appear in `todo`, in order, each naming its agent | **AC-1** |
| Binds template variables | Every `{{var}}` in every step prompt is replaced before any card is written | AC-2 |
| Refuses an unbound variable | Instantiate fails, names the variable and the step; **no cards are created** | **AC-2** |
| Blocks a step behind its predecessor | Steps 2–9 carry a `blocked` chip naming the step they wait on | AC-3 |
| Starts the next step when one is marked done | Step 1 `done` → step 2 dispatches with `trigger: 'chain'` | **AC-4** |
| Will not start step 2 from a session token | The gated `done` on step 1 is refused; step 2 never dispatches | **AC-5** |
| Says what approving will start | The gate reads *"Approve & start step 2 (@plan)"* — never a bare "Approve" | AC-6 |
| Leaves a human step for a human | A step with no agent cannot be dispatched; the refusal names the reason | AC-7 |
| Halts the chain on failure | A failed step stops the chain; later steps say which step stopped them | **AC-8** |
| Records the chain on every card | Each card shows `step N of 9 · <template name>` | AC-9 |
| Never re-dispatches a step | A step already run cannot be started twice by the chain | AC-10 |

## §3 — Data & sources

### 3.1 Schema (extends Stage 3 §3.7)

```
TaskTemplate(id, projectId, slug, name, description, variablesJson, seeded, createdAt)
             -- slug = stable key ('compound-engineer-workflow'); name = display ('compound-engineer')
TemplateStep(id, templateId, ord, name, promptTemplate, assigneeAgentName,
             approvalGate, notes)
Chain(id, projectId, templateId, templateVersionJson, variablesJson,
      status, haltedAtTaskId, haltReason, createdAt)
```

and `Task` gains `chainId`, `chainOrd` (both nullable — a hand-made task has neither).

**`Chain.templateVersionJson` is the template as it was at instantiate**, copied, not referenced.
A running chain must not change because someone edited the template underneath it — that is the
same reasoning as D19's evidence rule one level down: *what actually ran* has to stay
reconstructible. It also makes AC-8's halt reason meaningful a week later.

**One template, one identifier on screen.** `TaskTemplate` carries both a `slug` — the seeded one
is `compound-engineer-workflow`, as AgentOS-spec §10 names it — and a short `name`, which is what a
card renders (`step 3 of 9 · compound-engineer`). The slug is the stable key for seeding, config and
tests; the name is display only. **Never render the slug on a card and never key anything on the
name**, or the same template acquires two identities and AC-9 starts asserting the wrong one.

**`assigneeAgentName` is a name, not an id.** A template is portable across projects (the seeded
one ships with the product); an agent id is not. Resolution happens at instantiate, and a name that
resolves to nothing is a refusal there (§3.3), not a null at dispatch time.

**One representation, stated once, because it is easy to get two.** In a **template**, a step names
`assigneeAgentName` — either an agent's name or the reserved literal **`human`**. On the **task**
that instantiate writes, that becomes `assigneeAgentId`: the resolved agent's id, or **`null`** for
`human`. So *"names no agent"* is never a state a template can express, and `null` on a task always
means human-only rather than unassigned — which is exactly what Stage 3 §7.1 relies on when it
says defaulting happens at creation and `dispatch` never assigns.

### 3.2 All N cards are created up front

PRD §10's acceptance is explicit — *"instantiating the template creates nine cards"* — and the
alternative (materialise step N+1 only when step N finishes) is rejected for a reason worth stating:
**a chain you cannot see is a plan the system is keeping to itself.** Nine visible cards, eight of
them blocked, is a forecast the human can read, argue with, and cancel. One card plus an intention
is the second source of truth D11 exists to forbid.

The cost is that a blocked card looks like work that is not happening, which is true, and the
`blocked` chip says which step it waits on.

### 3.3 Instantiate is all-or-nothing

Stage 2 established the pattern — *a refusal on either file writes neither* — and it applies
unchanged. Instantiate resolves **everything** before writing **anything**:

1. every `{{variable}}` in every step prompt binds to a supplied value;
2. every `assigneeAgentName` resolves to an agent in this project, or is explicitly `human`;
3. the project has an execution layer and a primary repo.

Any failure → **zero rows written**, and the error names the step and the thing that failed. Nine
cards where three have unbound prompts is worse than no cards, because the first three would run.

**An unbound variable is never an empty string.** A prompt reading *"create a branch named  and
implement"* would be executed, cost money, and produce something plausible. This is the same class
as the JSX-newline defect that twice shipped a broken word to the Board — *"contradict s reality"*,
then *"2 file s"* (`docs/LEARNINGS.md`; **quoted verbatim, not a typo**) — a hole where a value was
supposed to be, rendered as though nothing were missing. A template hole is a claim about what the
agent was asked.

### 3.4 The chain advances through `dispatch`, not around it

When a task with a `chainId` reaches `done`, the transition handler looks up the next `chainOrd`
and calls **`dispatch(nextTaskId, 'chain')`** — the funnel D24 already declared and Stage 3 already
built. Every precondition in Stage 3 §7.3 applies unchanged, which is the whole payoff:

- a chain cannot exceed the project's concurrency cap;
- a chain step records the project's drift at spawn, exactly like a manual run;
- a chain step that cannot resolve its agent refuses out loud rather than silently stalling.

**The next step is dispatched by the transition, not by a scanner.** If the dispatch is refused,
the chain **halts with that reason** rather than retrying — a chain that retries is a scheduler,
and D24 declined to build one.

### 3.5 Human-only steps

Step 9 of the reference template has `assigneeAgentName: 'human'`, so instantiate writes a task
with `assigneeAgentId = null`, and `dispatch` is **refused by Stage 3 §7.3's precondition 4** with a
reason — no new mechanism, and the refusal is already the right words. **Stage 3 §7.1 is explicit
that `dispatch` never assigns an agent**, so a human step cannot fall through to the project's
default agent; without that rule this step would be executed by an agent, which is the one outcome
the template's final gate exists to prevent. It sits in `todo` with a `blocked` chip until its predecessor
finishes, then becomes an ordinary card waiting for a person.

**A human step ends the chain's automation, not the chain.** Nothing dispatches after step 9
because there is no step 10; if a human step sat mid-chain, marking it `done` would dispatch the
next step normally.

## §4 — Acceptance

Fixtures only; the model is never called; the scripted `Runner` fake from Stage 3 §6.3 is reused
**unchanged**. If this suite needs a new seam, re-read §1's warning.

- **AC-1 — nine cards, in order.** Instantiating `compound-engineer-workflow` creates exactly nine
  tasks with `chainOrd` 1–9, each carrying the right agent name and gate flag, all in `todo`.
- **AC-2 — binding is total or nothing.** With `branchName` supplied, no `{{` survives in any
  stored prompt. With it omitted: the call fails naming `branchName` **and the step**, and
  `SELECT count(*) FROM Task` is unchanged.
- **AC-3 — steps 2–9 are blocked, and say by what.** Each carries a `blockedReason` naming its
  predecessor. Step 1 carries none.
- **AC-4 — advance goes through the funnel.** Marking step 1 `done` as a human dispatches step 2
  with `trigger: 'chain'`. **Assert the trigger kind**, not merely that a session appeared —
  otherwise a second dispatch path could pass this test.
- **AC-5 — the gate stops the chain, not just the card.** A session token attempting `done` on
  gated step 1 is refused (Stage 3 AC-5), **and step 2 has no session row**. The second half is the
  point: Stage 3 proved the card does not move, this proves nothing downstream started.
- **AC-6 — the gate states its consequence.** The approval control's label names the step and agent
  it will start. Asserted on the rendered string, because a bare "Approve" is how an unattended
  five-hour spend gets authorised by accident.
- **AC-7 — a human step refuses dispatch, and does *not* fall through to the default agent.** With
  `Project.defaultAgentId` **set**, `dispatch` on step 9 returns `started: false` naming the
  human-only assignee, and writes no session. The non-null default is the point of the fixture: the
  bug this guards against is a human review step silently executed by the project's default agent,
  and a test with no default configured would pass while the bug was present.
- **AC-8 — failure halts and attributes.** A `Runner` fake that throws on step 5 leaves: step 5
  `failed`, `Chain.status = 'halted'`, `haltedAtTaskId` = step 5, and steps 6–9 still blocked with
  a reason naming step 5. **No session exists for step 6.**
- **AC-9 — every chained card knows its position.** `step N of 9` renders from `chainOrd` and the
  chain's own step count, never from a hardcoded 9.
- **AC-10 — a step runs at most once per chain.** Re-issuing the `done` transition on step 1 does
  not produce a second session for step 2. Idempotent on the transition, asserted by count.
- **AC-11 — a running chain ignores template edits.** Edit the seeded template after instantiate;
  the chain's stored prompts and step count are unchanged (§3.1).

## §5 — Decisions

Closed. If a new one surfaces mid-build, **stop** and close it in `docs/DECISIONS.md` first.

1. **Materialise all steps, or one at a time?** All N at instantiate (§3.2). PRD §10's acceptance
   requires it, and a hidden plan is a second source of truth.
2. **Does the chain advance through `dispatch`?** Yes, with `trigger: 'chain'` (§3.4). The
   alternative — a chain-specific start path — would duplicate five preconditions and lose the
   drift record. D24 declared this trigger precisely so this stage would not need to invent one.
3. **Does approving a gated step spend money immediately?** **Yes, and the button says so.** A
   chain whose steps need a second click to start is not a chain. The mitigation is the label
   (AC-6): *"Approve & start step 2 (@plan)"*. This is the same reasoning as Stage 2's approval
   copy — the gate is honest about what it does, rather than being made safe by adding friction
   people learn to click through.
4. **⚠ Does step 3 spawn four review agents in parallel?** **No — one session, sequential
   reviews, in this stage.** AgentOS-spec §10 step 3 has a coordinator spawning four review agents;
   the Agent SDK supports sub-agents, so this is possible rather than blocked. It is out of scope
   because **sub-agent fan-out is a new axis, not a chain**: it multiplies concurrency (colliding
   with Stage 3 §5.14's cap of one), multiplies cost non-linearly against Stage 5's rails that do
   not exist yet, and produces four reports whose consolidation is the coordinator's real work.
   Stage 4 ships step 3 as **one `review-coordinator` session instructed to produce the three named
   reviews and a consolidated must-fix / should-fix list**. That preserves the *output* the template
   depends on while deferring the topology → `docs/BACKLOG.md`.
5. **Template variables — how strict?** Total binding, refuse on unbound (§3.3). An empty
   substitution produces a plausible prompt that costs real money.
6. **Is the template copied or referenced?** Copied at instantiate (§3.1). A running chain must
   stay reconstructible after the template is edited.
7. **What happens after a failed step?** Halt with an attributed reason (AC-8). No retry, no skip.
   Retry is a human re-running the step, which is Stage 4's out-of-scope list until someone wants
   it twice.
8. **Where do templates live in the UI?** Behind `configuration` (D23's rail), not in the five work
   tabs. A template is setup; instantiating one is work, and that control lives on the Tasks board
   beside `+ Task`.

## §6 — Build notes

1. **Schema + `templates/compound-engineer.ts`** — the seeded template as data, not a migration
   fixture, so AC-11 can edit it.
2. **`lib/agentos/chain.ts`** — instantiate (all-or-nothing, §3.3) and advance (§3.4). Write AC-2,
   AC-5 and AC-8 with it; they are the three that catch a partial write, a leaked gate, and a
   runaway chain respectively.
3. **`scripts/verify-stage4.mts`** — AC-1…AC-11 before any UI.
4. **UI last**: the template list under `configuration`, the instantiate form, the chain position
   and blocked chips on cards (Stage 3 §8.2 already specifies both), and the gate label (AC-6).

**Reuse rather than re-derive:** `dispatch` and every precondition, the `Runner` fake, the fixture
harness, and the `TaskEvent` attribution. **This stage should add no new seam** — see §7.

## §7 — Test seams

| Seam | What it substitutes | Used by |
|---|---|---|
| **`Runner`** (Stage 3 §3.3) | the Agent SDK — reused unchanged | AC-4, 5, 8, 10 |
| **the fixture repo** | a real watched project | AC-1, 2, 3, 7, 9, 11 |

**No new seam, deliberately.** Stage 3's §9 argued for keeping the count near one; a chain is
sequencing over machinery that is already substitutable, so if this stage grows a third seam the
likely cause is that step 3's fan-out (§5.4) crept back in, or that the chain grew a scheduler.
Both are worth stopping for.
