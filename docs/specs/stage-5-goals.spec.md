# Spec — Stage 5: goals, the orchestrator, and four rails

status: ☐ design closed — **one owner decision gates the build**, §5.11: the default spend cap and
whether a goal may spawn unattended at all on its first outing. Everything else in §5 is closed,
including **D25**, which changes what the round-3 wireframe drew. Sequenced behind Stages 3 and 4.

> **The only genuinely new control loop in the product.** Everything before it was sequencing that
> a human decided in advance. A goal decides *what to do next* while nobody is watching, and keeps
> spending until something stops it. That is why it is built last, on machinery that has already
> run (PRD §12.5), and why four of its five hardest decisions are about **stopping**.
>
> **Read §3.4 before building anything.** *"A Definition of Done item is met"* is a **claim**, and
> in this product a claim may never be rendered as a fact. The wireframe draws it as one. D25
> resolves it, and the resolution changes the schema — so it cannot be retrofitted after the UI.
>
> Product context: `docs/PRD.md` §10 (Stage 5) and **§12.6**, which specifies the fourth rail —
> the one no other agent platform can offer. Design: frames `G1` and `P1` in
> [`design/wireframes2.pen`](../../design/wireframes2.pen).
>
> **Source reference:** [`AgentOS-spec.md`](AgentOS-spec.md) §11 — *a reconstruction of a talk, not
> a contract.* Where it and this spec disagree, this spec wins (PRD §12).

---

## §1 — Scope

**In:**

1. **`Goal` + `DoDItem`** — an open-ended brief with a checklist that defines completion.
2. **DoD drafting**, from a spec or brief, by a model call the human then edits.
3. **The approval gate (frame `P1`)** — DoD approval and the **drift pre-flight** folded into one
   click, with the acknowledgement stored and carried onto every session it spawns.
4. **The orchestrator** — control-plane code that runs after **every** session: read the progress
   log, evaluate the DoD, check the rails, then spawn the next specialist or stop.
5. **Four rails** — spend, duration, stuck-at-N (AgentOS-spec §11), **plus drift** (PRD §12.6).
6. **An append-only progress log**, shared across every session in the goal.
7. **Pause and stop**, with defined semantics for a session that is mid-flight.
8. **`pnpm verify:stage5`**, fixture-based, with both the runner **and the orchestrator's model
   call** substituted.

**Out:**

- Shared R2 folder (AgentOS-spec §11 *Shared state*) — D20 deferred the whole persistence layer;
  a goal's sessions share the repo and the log, which is what they actually need.
- Sub-agent fan-out (Stage 4 §5.4) — still deferred, and rails make it *more* dangerous, not less.
- Goal templates, goal-to-goal dependencies, and re-opening a completed goal.
- The Overview's rendering of goals (Stage 6) and cross-goal cost roll-up (Stage 7).

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Drafts a DoD from a brief | Checklist items appear, editable, none marked met | AC-1 |
| Will not start before its DoD is approved | Spawning is refused with a reason; no session exists | **AC-2** |
| Warns when the repo is in drift, before spending | The gate names the document and the claim, and requires an acknowledgement | **AC-3** |
| Carries the acknowledgement onto every session | Each session shows what was acknowledged, by whom, when | AC-3 |
| Runs the orchestrator after every session | A second specialist is spawned without human action | **AC-4** |
| Marks DoD items with **stated evidence** | A met item shows whether a check ran or a model judged it | **AC-5** |
| Completes when every item is met | Goal `completed`; no further sessions spawn | AC-6 |
| Stops at the spend cap | A cap of `$0.00` refuses to spawn at all; a reached cap stops spawning | **AC-7** |
| Stops at the duration cap | Wall-clock past `maxDuration` → stopped, with the elapsed time stated | AC-8 |
| Stops when stuck | `stuckThreshold: 2` stops after two no-progress iterations | **AC-9** |
| Lets a running session finish | Pause and cap stop *spawning*; the live session commits first | AC-10 |
| Shows the rails without a progress bar | Type size, `$attention`, and a stated consequence in words | Load `/p/<slug>/goals/<id>` |
| Keeps an append-only progress log | Entries from several sessions, ordered, each naming its session | AC-11 |

## §3 — Data & sources

### 3.1 Schema (extends Stage 3 §3.7 and Stage 4 §3.1)

```
Goal(id, projectId, name, brief, sourceRef, status, runnerKind,
     dodApprovedBy, dodApprovedAtISO,
     driftAckReason, driftAckBy, driftAckAtISO, driftAtApprovalJson,
     spendCapUsd, maxDurationMins, stuckThreshold,
     startedAtISO, endedAtISO, stopReason)
DoDItem(id, goalId, ord, text, met, verification, verificationCmd,
        metBySessionId, metSha, metAtISO, evidenceNote)
ProgressEntry(id, goalId, sessionId, atISO, body)
GoalSession(goalId, sessionId, ord, specialist)
```

`Session` (Stage 3) gains `goalId`, nullable.

`Goal.status`: `drafting` → `awaiting-approval` → `active` → (`completed` | `stopped` | `paused`).
`stopReason` is a sentence, not an enum — it is rendered verbatim, and *"stopped: spend cap $50.00
reached after 6 sessions"* is the whole point of having one.

### 3.2 The gate is one click, and it is the highest-stakes click in the product

Frame `P1` folds two approvals into one because they are asked at the same instant and an extra
dialog is a dialog people learn to dismiss (the design's position 7). The single click authorises:

1. **the DoD** — the five statements that define done;
2. **the rails** — cap, duration, stuck threshold, runner;
3. **the drift acknowledgement**, *with a reason*, when the primary repo is in `⚠ drift`.

**Approving starts session 1 immediately**, and the control says so. Nothing else in the product
spends money without a human action.

### 3.3 The fourth rail — drift, and why it does not block

Before the first session, the orchestrator reads **the portfolio layer's** current state for the
goal's primary repo (Stage 3 §7.5's direction of dependency, unchanged). If it is in drift, the
gate states which document, which claim, and how long it has been wrong — then requires an
acknowledgement with a reason, chosen from *"irrelevant to this goal"*, *"fix the document
first"*, or free text.

**It does not block, and this is deliberate**: a system that refuses to work because a document is
stale gets routed around within a week. What it does instead is put the premise **on the record**:
`driftAtApprovalJson` stores the check verbatim, and every session the goal spawns renders
`○ started while <project> was in drift — "<reason>", <who>, <when>`.

> This is the one place the two layers touch, and it is the reason they are one product
> (PRD §12.1). An executor can spend five hours and real money on a goal drafted from a twelve-day
> stale document and trip none of its own rails — **because every other rail measures the loop,
> never its premise.**

### 3.4 How a DoD item gets marked — the honesty problem (D25)

**This is the section that changes the design.** AgentOS-spec §11 has the orchestrator *"mark DoD
checkboxes that are satisfied"*, and frame `G1` draws a met item with `▶ s_8f21c4 · b71f04d`
beside it — the executed-provenance treatment, which in this product means *a session produced this
and here is the commit that proves it*.

**It does not prove it.** The session produced the *work*; the judgement that the work satisfies
the item is **a model reading a progress log**. Rendering that with the same glyph as a verified
fact is precisely the claim-as-fact collapse invariant 3 exists to prevent, committed by the
product itself, on the screen that decides whether to keep spending.

**D25 resolves it by splitting the field.** Every `DoDItem` carries a `verification`:

| `verification` | Means | Renders |
|---|---|---|
| `command` | `verificationCmd` ran in the worktree and exited 0 | **`✓ verified`** + the command and its exit |
| `judged` | the orchestrator's model call read the log and concluded it | **`◆ derived`** + *"the orchestrator's reading"* + the session id |
| `human` | a person ticked it | quoted italic, naming them |

A DoD item **may** declare a `verificationCmd` when it is written — *"covered by an integration
test"* becomes `pnpm test path/to/spec`, and then completion is a fact rather than a reading.
Items that cannot be commanded (*"the key is never written to a log"*) stay `judged`, honestly
labelled.

**The consequence that matters:** a goal completes when every item is met, and now the completion
banner can state *"3 of 5 verified by command, 2 by the orchestrator's reading"*. A goal whose DoD
is entirely `judged` is a goal that declared itself finished, and the UI says so rather than
implying a proof.

### 3.5 The orchestrator: a model may choose, but only code may stop

After **every** session ends — completed, failed, or interrupted — the orchestrator runs:

```
1. append the session's outcome to the progress log
2. run each unmet DoD item's verificationCmd, if it has one   ← code
3. ask the model to evaluate the remaining items and pick a    ← model
   next specialist, given the log, the DoD, and the diff
4. check the four rails                                        ← code, and it wins
5. spawn via dispatch(taskId, 'chain') — or stop, with a reason
```

**Step 4 is never the model's.** The model may propose the next specialist and may judge a `judged`
item; it may not decide whether there is budget, time, or progress left. A rail evaluated by the
thing it constrains is not a rail. This is the same separation as Stage 3 §3.4's approval gate,
where a prompt is not enforcement.

**The orchestrator is not a chat agent** and has no inbox. Its model call is one tight prompt with
a structured response; if that call fails, the goal **stops** with a stated reason rather than
guessing a specialist.

### 3.6 The rails, and how they compose with what already exists

| Rail | Stops when | Built from |
|---|---|---|
| **Spend** | cumulative session `costUsd` ≥ `spendCapUsd` | summed from Stage 3's session rows, **and** each session's `maxBudgetUsd` is set to `min(agent cap, remaining goal budget)` — the SDK primitive from Stage 3 §3.1(a) |
| **Duration** | `now − startedAtISO` ≥ `maxDurationMins` | wall-clock, checked before spawning |
| **Stuck** | N iterations with the same specialist, the same unmet DoD set, and no new progress entry | the log itself |
| **Drift** | never — it records and warns (§3.3) | the portfolio layer |

**Spend has two layers on purpose.** The goal-level sum stops the *next* spawn; the per-session
`maxBudgetUsd` stops a *single* runaway session from blowing through the cap before the sum is next
read. Neither alone is sufficient, and Stage 3 already built the second.

**A cap is required by default.** A goal with no spend cap is permitted only with an explicit
confirmation, per AgentOS-spec §11. §5.11 is the owner decision about the default value.

### 3.7 Pause, stop, and the session that is already running

A rail tripping, a pause, and a stop all mean the same thing: **stop spawning**. None of them kills
a live session. The running session finishes its turn and commits — which is stated on the rail
card in words: *"the session running now commits first, then nothing new spawns."*

Killing a live session would destroy uncommitted work in an ephemeral worktree (Stage 3 §3.2) to
save at most one session's cost, which is the wrong trade and is why the cap is checked **before**
spawning rather than during.

## §4 — Acceptance

Fixtures only. **Two things are substituted**: the `Runner` (Stage 3) and the orchestrator's model
call (§7). The rails, the verification commands, git, and SQLite are all real.

- **AC-1 — a DoD is drafted and is not self-marking.** Drafting from a brief produces ≥2 items,
  every one `met: false`, and none carries a session id.
- **AC-2 — no approval, no spawn.** `start()` on a goal in `awaiting-approval` is refused with a
  reason and creates **no session**. After approval it starts exactly one.
- **AC-3 — the pre-flight records the premise.** With a drifted fixture: approval is refused
  without an acknowledgement; with one, `driftAtApprovalJson` holds the claim, the counter-fact,
  the source and the check time, and **every session spawned by the goal carries the reason and the
  person**. With an in-sync fixture, approval needs no acknowledgement and the field records the
  in-sync state — **not `null`** (Stage 3 AC-17's rule).
- **AC-4 — the loop turns.** A two-item DoD completes by spawning **at least two** specialist
  sessions, with no human action between them, each linked to the goal by `GoalSession`.
- **AC-5 — evidence is typed, and the type is honest.** An item with a `verificationCmd` that exits
  0 is `verification: 'command'`; the same item with a failing command stays **unmet even when the
  model says it is met** — assert this specific case, because it is the one that proves code
  outranks the model. An item without a command that the model marks met is `'judged'` and renders
  as derived.
- **AC-6 — completion is total.** The goal reaches `completed` only when every item is met; one
  unmet item leaves it `active`.
- **AC-7 — the spend rail.** `spendCapUsd: 0.00` refuses to spawn at all, with a reason. A cap
  reached mid-goal stops the next spawn, and the session already running is **not** killed
  (assert it still ends normally and its commit is recorded).
- **AC-8 — the duration rail.** A `maxDurationMins` already exceeded stops the next spawn and the
  `stopReason` states the elapsed time.
- **AC-9 — the stuck rail.** With `stuckThreshold: 2`, a scripted orchestrator returning the same
  specialist against the same unmet DoD with no new progress entry stops after two iterations.
- **AC-10 — stopping never destroys work.** Pause, stop, and each rail leave the in-flight session's
  worktree teardown and commit recording intact (Stage 3 AC-8 and AC-9 still hold).
- **AC-11 — the log is append-only and attributed.** Entries from ≥2 sessions are ordered, each
  names its `sessionId`, and no code path updates or deletes one.
- **AC-12 — the orchestrator cannot overrule a rail.** A scripted orchestrator that returns
  *"spawn"* while the spend cap is exceeded results in **no session**. §3.5 step 4, asserted
  directly, because this is the failure that costs money.
- **AC-13 — a failed orchestrator call stops the goal.** The model call throwing leaves the goal
  `stopped` with a stated reason, not `active` with nothing scheduled.

## §5 — Decisions

Closed unless marked.

1. **Does the DoD gate block the loop?** Yes — no approval, no spawn (AC-2). AgentOS-spec §11 is
   explicit and it is the only human gate the loop has.
2. **Does drift block?** No — record and acknowledge (§3.3, PRD §12.6, frame `P1`). A blocking
   version gets routed around; a recorded one survives being seen fifty times.
3. **⚠ How is a DoD item known to be met?** Split by evidence type — **D25**, closed. Changes the
   schema and frame `G1`'s rendering. §3.4 is the argument.
4. **May the model decide to keep going?** No. It may propose a specialist and judge a `judged`
   item; the rails are code and are checked after it (§3.5, AC-12).
5. **Are all four rails checked before spawning, or during?** Before. Checking during would mean
   killing a live session, which destroys uncommitted work in an ephemeral worktree (§3.7).
6. **How does a goal spawn work — a new mechanism?** No: the orchestrator creates a task and calls
   `dispatch(taskId, 'chain')`. D24's funnel again, so goal sessions inherit every precondition and
   the drift record.
7. **Shared filesystem across sessions?** No — the repo is the shared state, plus the append-only
   log. AgentOS-spec's R2 folder exists because *its* containers are remote (D20).
8. **Can a goal run in a project that is not opted in?** No. Stage 3 §7.3 precondition 1, unchanged.
9. **Does a goal get its own inbox thread?** It uses the project inbox, with messages carrying the
   goal id. A second inbox would be a second place to look for the one counter the product allows.
10. **What happens to a goal when the server restarts?** Its in-flight session is swept to
    `interrupted` (Stage 3 §7.7) and the goal goes to `paused` with that reason — **it does not
    silently resume**, because resuming would spawn against a premise nobody re-read. Restarting it
    is a human action.
11. **⚠ GATING — the default spend cap, and unattended running.** Two halves of one owner call,
    because both are the owner's money. *(a)* What is the default `spendCapUsd` on a new goal?
    *(b)* On the first outing, may a goal spawn its second and later sessions **unattended**, or
    must each spawn be confirmed until the loop has been watched once end to end? **Recommendation:
    default the cap to `$25.00`** — roughly one G1-sized session and change, low enough that a
    runaway is an annoyance rather than an incident — **and ship a `confirmEachSpawn` flag defaulted
    to `true` for the first goal**, turned off by the owner once they have watched the loop turn.
    That is the same shape as Stage 3 §5.12's recommendation: build the capability, seed it timid.

**Deliberately not decided here:** how the Overview renders a goal (Stage 6), and whether the
orchestrator's specialist choice should be tiered by cost (needs data from real runs).

## §6 — Build notes

1. **Schema + rails as pure functions.** `lib/agentos/rails.ts` — four predicates over a goal and
   its sessions, no I/O. Write AC-7, AC-8, AC-9 and AC-12 against them **first**; they are the
   cheapest tests in the stage and they guard the expensive failure.
2. **`lib/agentos/orchestrator.ts`** — the five steps of §3.5, with the model call behind an
   interface (§7). Rails after the model, never before.
3. **`lib/agentos/goal.ts`** — draft, approve (with the pre-flight), start, pause, stop.
4. **`scripts/verify-stage5.mts`** — AC-1…AC-13 before any UI.
5. **UI last**: frame `P1` (the gate) before frame `G1` (the goal view) — the gate is the only
   surface that can spend money, and building it first means the goal view has real data to show.

**Reuse rather than re-derive:** `dispatch` and its preconditions, the drift read from Stage 3
§7.5, the session sweep from §7.7, the `Runner` fake, and Stage 4's chain advance.

## §7 — Test seams

| Seam | What it substitutes | Used by |
|---|---|---|
| **`Runner`** (Stage 3 §3.3) | the Agent SDK — reused unchanged | AC-4, 7, 10 |
| **`Orchestrator`** *(new)* | the model call that judges items and picks specialists | AC-5, 9, 12, 13 |
| **the fixture repo** | a real watched project, drifted or in sync | AC-3, 11 |

**One new seam, and it is the same kind as the first.** `Orchestrator` is the boundary between our
logic and a model — exactly what `Runner` is — and it exists for the same reason: the four checks
that matter most (a rail overruled, a stuck loop, a lying judgement, a failed call) are impossible
to trigger reliably against a real model, and expensive to try.

**The rails are never faked.** They are the subject. Nor are the verification commands: AC-5 runs a
real command in a real fixture, because *"code outranks the model"* is only true if the code
actually ran.
