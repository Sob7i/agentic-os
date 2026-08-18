# Spec — Stage 3: the execution MVP (one vertical thread)

status: ☑ decisions closed — **buildable.** Both gates cleared 2026-08-18 by **D27**: the first
real sessions target `fractal-code`, and `canCommit` ships with the seeded agent set to `false`.
The shell (D23) and the dispatch model (D24) closed earlier, with §7 and §8. Decomposed into build
units in [`stage-3-tickets.md`](stage-3-tickets.md).

> **The first slice that runs an agent.** Everything before it observed; this one *acts*. Product
> context: `docs/PRD.md` §12.4, and **D18–D22**, which are its premise. Depends on Stage 2
> (`stage-2-fix-proposals.spec.md`) only for the guard patterns it reuses — not for its code.
>
> **Read §3.5 and §7 before building anything.** The inbox pause/resume model (§3.5) shapes every
> other file in this slice, and the obvious implementation is the wrong one. **§7 — the motor —**
> answers who picks the work, what starts it, and what happens to a run when the browser goes away;
> it is the section people assume the Kanban already implies, and it diverges from the source
> reference on purpose (D24).
>
> **Source reference:** [`AgentOS-spec.md`](AgentOS-spec.md) §4, §6, §9, §20 — *a reconstruction
> of a talk, not a contract.* Where it and this spec disagree, this spec wins (PRD §12).

---

## §1 — Scope

**In:**

1. **Domain objects in SQLite** — `Project`, `Agent`, `Task`, `Session`, `InboxMessage`, and a
   `ToolCall` log. The minimum that D19's evidence rule can be enforced against.
2. **One project with an execution layer**, opted in by an `agentos.yml` at its root (D18).
3. **A Kanban with four columns** — `todo · doing · review · done` — with create-task and run-now.
4. **A `LocalRunner`** behind AgentOS-spec §16's `Runner` interface: ephemeral **git worktree** +
   Claude Agent SDK subprocess, torn down after every run (D20).
5. **Two in-process MCP servers** — AgentOS (read/update the task) and Inbox (ask the human).
6. **The approval gate, enforced in code** — a session token can never move a gated task to `done`.
7. **A session record** carrying tool calls, `costUsd`, commit shas, and a terminal status.
8. **A fixture-based acceptance suite**, `pnpm verify:stage3`, that never touches a watched repo.

**Out** — each is a later stage or a backlog entry, not an omission:

- Goals, the orchestrator, and the three rails (Stage 5). Templates, chains, and multi-step
  approval (Stage 4).
- Triggers, cron automations, the YAML round-trip and CLI, the PWA and push (PRD §12.7).
- The cloud runner, R2-style filesystem MCP, and secret manager (D20 — deferred behind the same
  `Runner` interface).
- A filesystem MCP of any kind. The MVP agent works in its worktree through the SDK's own file
  tools; there is no second filesystem surface to ACL.
- The rewritten Overview (Stage 6) and portfolio cost (Stage 7).
- **More than one project with an execution layer.** The second one is a config change, not a
  feature, and proving it is not what this slice is for.

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Lists a project's tasks on a four-column board | Cards appear under `todo`/`doing`/`review`/`done` | Load `/p/<project>/tasks` |
| Creates a task and runs it now | Card moves `todo → doing`; a session row appears `running` | AC-1 |
| Runs the agent in a throwaway worktree | Session's `cwd` is a new worktree path; it is gone afterwards | **AC-2** |
| Re-clones rather than reusing a dirty workspace | A second run of the same task gets a clean tree | AC-2 |
| Streams tool calls into the session record | The log holds one row per tool use, in order | AC-3 |
| Lets the agent update its own task | Agent moves the card to `review` through the AgentOS MCP | AC-4 |
| **Refuses a gated `done` from a session** | `403`, with a reason; the card stays in `review` | **AC-5** |
| Accepts the same transition from the human | The card reaches `done`; the row records who moved it | AC-5 |
| Pauses on an inbox question | Session status `waiting-inbox`; no process left running | **AC-6** |
| Resumes with the answer in context | The agent's next turn references the answer | AC-6 |
| Records what the run cost | `costUsd` on the session, sourced from the SDK's own total | AC-7 |
| Records what the run produced | Commit shas on the session, read from git, not from our record | AC-8 |
| Destroys the worktree even when the run fails | Failed session → status `failed`, worktree gone, log kept | **AC-9** |
| Attributes every stored status | Each card shows the session or the human that moved it | AC-10 |
| Leaves a project without `agentos.yml` alone | It renders on the Board exactly as today; no execution UI | AC-11 |
| Refuses a run with a stated reason | A blocked dispatch names which precondition failed; no session row is written | **AC-15** |
| Runs one session per project at a time | A second run-now is refused, not queued, and says why | AC-16 |
| Records the premise a run started on | The session carries the project's drift claim, its check, and its timestamp | **AC-17** |
| Never leaves a session claiming to run after a restart | A `running` row from a dead process becomes `interrupted`, with a reason and no worktree | **AC-18** |
| Keeps the portfolio visible inside a project | The ribbon shows six glyphs and the Board's own freshness, always | Load `/p/<project>/tasks` |
| Shows a project's drift where work starts | The drift band appears **only** when that project is in drift, quoting the Board verbatim | Load `/p/nadim/tasks` |
| Distinguishes executed from hand-moved at a glance | Executed: `▶` + mono + session id + sha. Hand-moved: quoted italic naming a person | AC-10 |

## §3 — Data & sources

### 3.1 The SDK surface — verified 2026-08-15, not assumed

`@anthropic-ai/claude-agent-sdk`, version **0.3.233**, `engines.node >= 18` (this machine runs
v23.11.0). Fetched from the SDK's own documentation rather than recalled — this project's standing
rule is `external-API-fields-are-guilty-until-verified`, and the API reference bundled with the
`claude-api` skill **explicitly does not cover the Agent SDK**, which is a different package from
the `@anthropic-ai/sdk` tool runner. Confusing the two would have produced a spec built on the
wrong library.

| What this slice needs | The verified surface |
|---|---|
| Run an agent | `query({ prompt, options }) → AsyncGenerator<SDKMessage>` |
| Work in the worktree | `options.cwd` (defaults to `process.cwd()`) |
| Capture the session id | `session_id`, on the init `system` message **and** on the result message |
| Resume after an inbox answer | `options.resume: <sessionId>` |
| Restrict tools | `options.allowedTools[]`, `options.disallowedTools[]` — scoped rules supported, e.g. `Bash(rm *)` |
| Gate a call at runtime | `options.canUseTool(request) → { allowed: boolean }` |
| Attach our own tools | `createSdkMcpServer({ name, tools })` + `tool(name, description, zodSchema, handler)` |
| Refuse every other MCP | `options.strictMcpConfig: true` — ignores `.mcp.json` and settings |
| Read the cost | `total_cost_usd` on the result message (plus `total_input_tokens` / `total_output_tokens`) |
| Cap the spend | `options.maxBudgetUsd` — terminates with result subtype `error_max_budget_usd` |
| Cap the turns | `options.maxTurns` — terminates with `error_max_turns` |

**Three findings worth more than the table.**

**(a) The SDK already has a spend cap.** `maxBudgetUsd` is a first-class option that stops the run.
AgentOS-spec §11 treats the spend rail as control-plane logic to be written; on this runner, at
least the per-session half is a parameter. Stage 5's goal-level cap still has to sum across
sessions, but it composes from a primitive rather than racing one.

**(b) `strictMcpConfig` is the default-deny lever, and it is one boolean.** Without it the SDK reads
the machine's `.mcp.json` and user settings, so an agent would silently inherit **the owner's own
MCP servers** — including any that are authenticated. AgentOS-spec §5.1's "default deny" is
therefore not aspirational here; it is one flag, and omitting it is a real leak. Set it, and assert
it in the suite.

**(c) A single-shot `query()` throws *after* yielding its error result.** So the result — carrying
`session_id` and the cost of the work already done — arrives before the throw. Code that wraps the
loop in a `try` and treats the `catch` as "nothing happened" will discard a real session and a real
charge. Capture as you iterate; handle the throw separately.

### 3.2 The ephemeral workspace is a git worktree

AgentOS-spec §6 destroys a container per session. D20 substitutes a worktree, which preserves the
rule the container exists to enforce — *nothing survives but commits* — at roughly no cost:

```
git -C <repo> worktree add --detach <tmp>/agentos/<sessionId> <baseRef>
  → query({ options: { cwd: <tmp>/agentos/<sessionId>, … } })
  → read commit shas:  git -C <worktree> log <baseRef>..HEAD --format=%H
  → git -C <repo> worktree remove --force <tmp>/agentos/<sessionId>
```

Three properties this buys, and one it does not:

- **A clean tree every time.** `worktree add` from a ref cannot inherit the previous run's dirt, so
  AgentOS-spec §6's "no warm workspace" holds by construction rather than by discipline.
- **The owner's checkout is untouched.** The agent never sees the working copy the owner is editing,
  which removes the entire class of "the agent stomped my uncommitted work".
- **Commits are real and local.** They land in the repo's object store on a detached HEAD; nothing
  is pushed, and nothing moves a branch. Recovering the work is `git branch <name> <sha>`; abandoning
  it is doing nothing, and gc eventually reclaims it.
- **It is not a security boundary.** A local process can read outside its `cwd`. §5.6 says what is
  and is not claimed.

**`--force` on removal is deliberate.** A failed run leaves a dirty worktree, and a teardown that
refuses to clean up after exactly the runs most likely to need cleaning is the wrong default (AC-9).

### 3.3 The two MCP servers are in-process

`createSdkMcpServer` builds a server **inside this Node process** — no port, no child process, no
transport to secure. The tools are plain async TypeScript functions, so an MCP tool call is a
function call with a Zod-validated argument.

| Server | Tools | Notes |
|---|---|---|
| `agentos` | `task.read`, `task.update_status`, `task.append_activity` | `task.update_status` is where §3.4's gate lives |
| `inbox` | `inbox.ask` | Returns nothing useful — see §3.5. `inbox.send` is deliberately absent (§5.8) |

Both are constructed **per session** and close over that session's id and task id. The agent
therefore has no parameter with which to name a *different* task: the object it can act on is fixed
at spawn. This is the Stage 2 lesson applied a layer up — *a guard must derive its bounds
independently of its input* (`docs/LEARNINGS.md`) — and it is why these tools take no task id.

### 3.4 The gate, in two layers

AgentOS-spec §5.9 requires that the API refuse `status=done` from a session token when the task is
gated. Two independent layers, because one of them is a prompt and prompts are not enforcement:

1. **`canUseTool`** — the SDK's runtime callback. Cheap, first, and it can decline with a reason
   the agent reads and adapts to.
2. **The tool handler itself** — refuses regardless of what let the call through, and records the
   refusal on the session. **This is the layer the acceptance test asserts**, because it is the one
   that still holds if `canUseTool` is misconfigured.

The rule: **a session may move a task to any status except `done` when `approvalGate` is true.**
`done` from a session on a gated task is refused with a stated reason; `done` from the human is
accepted and attributed. That attribution *is* D19's evidence requirement made concrete.

### 3.5 The inbox — why the obvious design is wrong

The SDK gives two ways to pause for a human, and they differ in more than style:

**(A) Block inside the tool handler.** `inbox.ask` returns a promise that resolves when the human
answers. The session never ends; the agent's own turn simply takes a long time.

**(B) End the turn, resume later.** `inbox.ask` records the question and returns immediately, the
agent finishes, and the answer is delivered by a *new* `query({ options: { resume: sessionId } })`.

**(B) is specified.** (A) is less code and is genuinely tempting — the SDK's own docs note that
built-in permission prompts and `AskUserQuestion` are handled in-loop without ending the call — but
it holds a live subprocess and an unresolved promise for as long as the human takes to answer, which
can be overnight. That fails the product's premise on three counts: it does not survive a `pnpm dev`
restart, so a dashboard reload silently kills a paused run; a machine sleep is indistinguishable
from a hung agent; and it makes "walk away" — the entire point of an executor — the case the design
handles worst. **(B) makes the pause durable, because the state lives in SQLite rather than in a
process's memory.**

The flow (`Session.status` in brackets):

```
agent calls inbox.ask ─▶ row written, status=waiting-inbox, tool returns "asked"
        │                the agent finishes its turn; the worktree is REMOVED
        ▼
human answers in the UI ─▶ new worktree from the same base ref
        │                  query({ prompt: <answer>, options: { resume: sessionId, cwd: <new> } })
        ▼               [running]
```

**The consequence to state plainly:** conversation resumes, **the filesystem does not**. The SDK's
own documentation is explicit that sessions persist the conversation, not the filesystem. Any
uncommitted work in the first worktree is gone. So an agent that is about to ask a question must
commit first — that is a line in the foundational prompt, and it is the reason `inbox.ask`'s
description tells it so. §5.9 records why this is accepted rather than engineered around.

### 3.6 Cost, and a collision with Stage 7

`total_cost_usd` from the result message lands on the session row. But sessions we spawn write their
transcripts to `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` — **the same tree PRD §5's
transcript parser reads.** Two consequences nobody would notice until Stage 7:

- Agent-spawned sessions will appear in the portfolio cost panel **mixed with the owner's own Claude
  Code sessions.** They must be separable, and they are: `cwd` is the worktree path, which is inside
  the temp dir and matches no watched project. Stage 7 gets a free attribution key — provided this
  slice does not put the worktree somewhere ambiguous.
- Each session's worktree path produces its **own** `projects/<encoded-cwd>/` directory, so the tree
  accumulates one directory per session forever. Harmless at this size → `docs/BACKLOG.md`.

Record the SDK's figure verbatim and label it as the SDK's own estimate. Stage 7 will compute the
same number from the transcript; when they disagree, the honest move is to show both, per D7's rule
that a metric ships with its caveat or does not ship.

### 3.7 Schema (SQLite, `data/agentos.sqlite`, gitignored)

```
Project(id, slug, primaryRepoPath, yamlPath, defaultAgentId,     -- D21: repos[] arrives with Stage 4
        maxConcurrentSessions, createdAt)
Agent(id, projectId, name, monogram, model, rolePrompt,
      allowedToolsJson, disallowedToolsJson,                      -- the Json suffix is the convention:
      canCommit, maxTurns, maxBudgetUsd)                          -- a reader must know it is text
Task(id, projectId, name, description, status, blockedReason,
     approvalGate, assigneeAgentId, scheduleKind, createdAt)     -- scheduleKind: 'manual' in Stage 3
TaskEvent(id, taskId, fromStatus, toStatus, actorType, actorId, reason, atISO)
                                                                 -- actorType: 'session' | 'human' | 'system'
Session(id, taskId, agentId, sdkSessionId, status, triggerKind,
        worktreePath, baseRef, costUsd, pid, bootId,
        driftAtSpawnJson, startedAtISO, endedAtISO, failureReason)
        -- status: 'running' | 'waiting-inbox' | 'completed' | 'failed' | 'interrupted'
ToolCall(id, sessionId, seq, name, inputJson, atISO)
InboxMessage(id, sessionId, taskId, kind, body, choicesJson,
             answer, status, askedAtISO, answeredAtISO)
             -- kind: 'question' (the only one in Stage 3)
             -- status: 'open' | 'answered'
CommitSha(sessionId, sha)                                        -- read from git, never from us
```

`TaskEvent` is the table that makes D19 true rather than aspirational: **every status transition
names its actor, and the UI reads status history from here.** A `Task.status` with no corresponding
`TaskEvent` is a bug, and AC-10 asserts it cannot happen. `reason` is not decoration — a refusal
and a crash-sweep both write one, and the UI renders it verbatim.

**Three enumerations were missing until the build asked for them** (added 2026-08-18): a session
that finishes cleanly is **`completed`**; `InboxMessage.kind` is `'question'` and nothing else in
this slice; `InboxMessage.status` is `'open' | 'answered'`. The spec named every *failure* state and
no success state — a gap that is invisible while writing and unavoidable while building.

**Four columns exist for D24 and are explained in §7:** `Session.triggerKind` (what asked for this
run), `driftAtSpawnJson` (what the project claimed when it started), and `pid` + `bootId` (whether
the process that owns this row is still alive). `Task.blockedReason` carries the `blocked` chip the
design draws on a `todo` card — it is a label on a card, **not a fifth column**.

## §4 — Acceptance

**Every test runs against a generated fixture repo in a temp dir, and the model is never called.**
Stage 2 established that a test proving we can write to nadim by writing to nadim has destroyed what
it verified; the same reasoning applies with more force to a test that would spawn a real agent.
**The runner is injectable**: `LocalRunner` satisfies an interface the suite substitutes with a
scripted fake that emits a chosen `SDKMessage` sequence. AC-12 is the one test that touches the real
SDK, and it is opt-in.

- **AC-1** — Creating a task and running it moves the card `todo → doing` and creates a session row
  in `running`, with a `TaskEvent` naming the session.
- **AC-2 — the worktree is real and ephemeral.** During the run, `git worktree list` shows it and
  its path is the session's `cwd`. Afterwards it appears in neither `worktree list` nor the
  filesystem. A second run gets a **different** path with a clean tree.
- **AC-3** — Each emitted tool-use message writes one `ToolCall` row, ordered by `seq`.
- **AC-4** — A scripted `task.update_status("review")` moves the card and records the actor.
- **AC-5 — the gate holds.** On a task with `approvalGate: true`: the session's `task.update_status`
  to `done` is refused with a reason, the card stays in `review`, and a refusal is recorded. The
  same transition from the human succeeds and writes a `TaskEvent` with `actorType: 'human'`.
  **Assert which layer refused** (§3.4) — Stage 2's lesson was that a test asserting only "something
  refused" hid a broken guard for a whole build.
- **AC-6 — pause and resume.** `inbox.ask` sets `waiting-inbox`, removes the worktree, and leaves no
  live handle. Answering calls the runner again with `resume: <sdkSessionId>` and the answer as the
  prompt. *Assert the resume options*, since the fake cannot prove the model saw anything.
- **AC-7** — `total_cost_usd` from the result lands on the session unmodified.
- **AC-8** — Commit shas come from `git log <baseRef>..HEAD` in the worktree, **before** teardown,
  and match commits the fixture actually has. A run that commits nothing records none.
- **AC-9 — failure still cleans up.** A runner that throws mid-run leaves status `failed` with a
  reason, **no worktree**, and every `ToolCall` written before the throw still on the record.
- **AC-10** — No `Task` reaches a status without a matching `TaskEvent`. Asserted by walking every
  task in the fixture after a full run.
- **AC-11** — A project without `agentos.yml` exposes no execution surface, and **the Board's
  existing 8 Stage-1 checks still pass against it** — the portfolio layer is unaffected by this
  slice.
- **AC-12 — one real session, opt-in.** Behind an env flag, run a genuine agent against a scratch
  fixture with a trivial prompt, and assert a session id, a cost above zero, and a clean teardown.
  Not in `pnpm verify` — it costs money and needs the network. **It is the only proof the other
  eleven are testing something real**, and skipping it forever is how a green suite starts lying.
- **AC-13 — no MCP inheritance.** The composed options set `strictMcpConfig: true` and list exactly
  the two in-process servers. §3.1(b): without it an agent inherits the owner's authenticated MCP
  servers.
- **AC-14 — `dispatch` is the only door.** Session creation is exposed as **one exported function**,
  `createSession()` in `lib/agentos/db.ts`; the assertion is that `createSession` and `runner.run`
  are each imported by **exactly one module, `lib/agentos/dispatch.ts`**. Structural rather than
  behavioural, deliberately: D24's funnel is worth exactly as much as the guarantee that nothing
  bypasses it, and the second path will be added by someone in a hurry who never reads §7.2.
  **Assert the import graph, not the SQL text** — a grep for `INSERT INTO Session` breaks on
  quoting, line wrapping, or a prepared-statement helper, and would then fail while the invariant
  holds, which is the failure mode that teaches people to delete a check.
- **AC-15 — every refusal is stated and writes nothing.** Each of §7.3's five preconditions is
  driven to failure in turn. Each returns `started: false`, names the precondition that stopped it,
  and leaves **zero new `Session` rows and zero new `TaskEvent` rows**. Following Stage 2's lesson,
  **assert which precondition refused** — not merely that something did.
- **AC-16 — the concurrency cap holds.** With `maxConcurrentSessions: 1` and one session running, a
  second `dispatch` in the same project is refused with a reason; a dispatch in a *different*
  project succeeds. Asserts the cap is per project, not global.
- **AC-17 — the premise is recorded.** A fixture whose state doc contradicts its git history
  produces a session whose `driftAtSpawnJson` carries the claim, the verified counter-fact, the
  source path, the check id, and a timestamp. A fixture in sync records the in-sync severity —
  **not `null`**, since an absent record and a clean project must not look alike.
- **AC-18 — a dead session cannot claim to be running.** Insert a `running` session with a foreign
  `bootId`, run the boot sweep, and assert: status `interrupted`, a stated `failureReason`, no
  worktree on disk or in `git worktree list`, `ToolCall` rows preserved, and a `TaskEvent` with
  `actorType: 'system'` moving the task back. Repeat for a `waiting-inbox` session, which has no
  worktree to remove and must still be swept (§7.7).
- **AC-19 — the state machine refuses illegal moves.** `todo → done` from a session, and any
  transition that would write a `Task.status` without a `TaskEvent`, are both rejected at the data
  layer rather than only in the UI.

## §5 — Decisions

Closed unless marked. If a new one surfaces mid-build, **stop** and close it in
`docs/DECISIONS.md` first — that gate is the point (`CLAUDE.md` §Working style).

1. **Runner topology?** Local-first behind AgentOS-spec §16's interface — **D20**, closed.
2. **Which SDK?** `@anthropic-ai/claude-agent-sdk` (Claude Code as a library), **not** the
   `@anthropic-ai/sdk` tool runner. They are different packages with different jobs, and the
   reference material bundled in this environment covers only the latter (§3.1).
3. **Ephemeral container?** A detached git worktree per session (§3.2). Preserves §6's rule; is not
   a security boundary (see 6 below).
4. **Where does domain state live?** SQLite at `data/agentos.sqlite`, gitignored. D3 planned SQLite
   for Stage 7's transcript cache; this arrives first and takes the same file? **No — a separate
   file.** The cache is derived and disposable; this is the execution layer's record and losing it
   loses evidence. Different lifetimes, different files.
5. **Inbox: block or resume?** Resume (§3.5). Durability beats simplicity, because surviving a
   restart is what "walk away" means.
6. **What isolation is claimed?** MCP and tool-layer only. There is no container and no network
   namespace, so a local process can read outside its worktree. **Stated in `FEATURES.md` under
   *Known gaps*, not implied away** — already logged in `docs/BACKLOG.md` from D20.
7. **Can the agent reach the network?** Only what the SDK itself needs, plus whatever tools it is
   granted. `WebFetch`/`WebSearch` are **not** in the MVP agent's `allowedTools`. This keeps D19's
   egress carve-out at "the model API" rather than "the internet".
8. **Can the agent message the human for progress?** No. `inbox.ask` exists; `inbox.send` does not.
   AgentOS-spec §8's foundational prompt says *do not message for routine progress* — a tool that
   cannot be misused beats an instruction not to misuse it. Progress goes to `task.append_activity`.
9. **Uncommitted work is lost across an inbox pause — engineer around it?** No. Preserving the
   worktree across the pause would reintroduce the warm workspace §6 forbids, to save work the agent
   could have committed. The foundational prompt tells it to commit before asking; the limitation is
   recorded in `FEATURES.md`.
10. **Model for the MVP agent?** `claude-opus-5`, default effort. One agent, one job; tiering is a
    Stage 4 concern once several roles exist.
11. **Which repo do the first real sessions target?** **`fractal-code` — closed as D27.** PRD §12.4 says a low-stakes watched
    repo, never agentic-os. Both candidates are quiet: `my-personal-website` (last commit 2026-08-06)
    and `fractal-code` (2026-07-26). **The owner picks**, because it is their repo and the run ends
    in a commit. *Recommendation: `fractal-code`* — it is the quieter of the two and has no state
    doc for a stray agent to contradict.
12. **May the MVP agent commit at all?** **`canCommit` ships, seeded `false` — closed as D27.** The thread in PRD §12.4 ends in a commit, and
    AC-8 assumes one. A `canCommit: false` first run — agent works, we read the diff, nothing is
    written to the object store — is a defensible smaller step that still exercises worktree,
    inbox, gate, and cost. **The owner decides**; both are buildable and the schema carries the flag
    either way. *Recommendation: ship with `canCommit: true` but default the seeded agent to
    `false`*, so the first real run is observable before it is consequential.

13. **Pull or push — does anything scan for work?** Push. No scanner, no worker, one
    `dispatch(taskId, trigger)` funnel — **D24**, closed. This is the largest divergence from
    AgentOS-spec §9.4 and the one most likely to be re-litigated by whoever builds chains.
14. **How many sessions may run at once?** One per project (`maxConcurrentSessions`, default 1),
    and a second dispatch is **refused rather than queued** (§7.3). Refusal is honest and needs no
    scheduler; a queue would need one, and would hold a claim about future work that nothing in the
    UI could source. Configurable because the right number is a property of the machine, not of the
    design.
15. **Does drift block a run?** No — it is recorded on the session, not enforced (§7.5, D24). A
    blocking rail on the most common real state of a real project trains dismissal, and the blocking
    version of this belongs to Stage 5's DoD gate where the stakes justify it.
16. **Where does a long run live?** Unawaited in the Next.js Node process, with state in SQLite
    (§7.4). A supervisor process would survive restarts and is what the cloud runner brings; until
    then a restart kills running sessions and **the sweep reports that** rather than leaving a row
    that lies (§7.7) → `docs/BACKLOG.md`.
17. **Which shell?** Concept B′ with a persistent portfolio ribbon and a conditional drift band —
    **D23**, closed. The ribbon is always present; only the drift band is conditional, and D23
    records why the distinction is not cosmetic.
18. **Is `blocked` a fifth column?** No — a chip on a card (§7.6). The four columns are the
    reference's own, the design draws blocked cards inside `todo` and `doing`, and a fifth column
    would make "waiting on a human" a *place* rather than a state, which is the Inbox's job.

**Deliberately not decided here** (they belong to later stages, and deciding them now would be
guessing): the goal orchestrator's next-specialist choice, template variable interpolation, and how
the Overview renders `▶ executed`.

## §6 — Build notes

Order matters; the risk is concentrated in the first three.

1. **`lib/agentos/db.ts`** — schema + migrations. No ORM; this is **eight** tables. *(Said "nine" until 2026-08-18; the schema block below has always had eight. Caught by the agent building it, which correctly refused to invent a ninth to make the count true.)*
2. **`lib/agentos/worktree.ts`** — create/teardown, with AC-2 and AC-9 written **first**. This is
   the piece that touches a real repo, so it gets tested before anything can call it in anger.
3. **`lib/agentos/runner/` — the `Runner` interface, `LocalRunner`, and the scripted fake.** The
   fake is not a test detail; it is what makes eleven of the thirteen checks runnable at all.
4. **`lib/agentos/mcp/`** — the two in-process servers, with the gate in the handler (§3.4).
5. **`lib/agentos/dispatch.ts` + the boot sweep** — §7. Small, and the single most consequential
   file in the slice: it is the only door to a session (AC-14), it owns the five preconditions, and
   it is where D24's drift record is written. Write AC-14…AC-19 with it.
6. **`scripts/verify-stage3.mts`** — AC-1…AC-19 against fixtures, before any UI.
7. **UI last**: `/p/<slug>/tasks` per §8, then the session view with its tool-call log, then the
   inbox. **The shell is no longer built here** — D26 split it out as
   [`stage-3a-shell.spec.md`](stage-3a-shell.spec.md), which is ungated and goes first, so these
   surfaces mount into routing and chrome that already exist.

**Reuse rather than re-derive:** `lib/collectors/git.ts` for repo facts, `lib/collectors/exec.ts`
for subprocess plumbing, and the `app/actions.ts` pattern where the server rebuilds the request
rather than trusting the browser — the reason the browser never names a path in Stage 2 applies
unchanged to a task id.

**A note for whoever builds this.** The Board must keep working throughout. It is the surface the
owner actually uses, and D19 makes the layer boundary an enforcement boundary — so
`lib/reconcile/` must not import `lib/agentos/`. If it ever needs to, that is a decision, not an
import.

---

## §7 — The motor: how a task becomes a running session

**This is the section to read before writing any UI.** It answers the three questions the Kanban
makes people assume are already answered: *who picks the work, what starts it, and what happens to
a run when the browser goes away.* All three are closed by **D24**.

### 7.1 Agents do not pick — they are picked

There is **no scanner, no poller, and no queue-worker**. Nothing in this system looks at the `todo`
column and decides to start something. Every `Task` carries its agent in `assigneeAgentId`, and
**that assignment is made when the task is created** — by a human in Stage 3, by a template step in
Stage 4, by the goal orchestrator in Stage 5.

**`dispatch` never assigns an agent.** If a task is created without one, `Project.defaultAgentId`
is applied **at creation time and written to the row**; a task that reaches `dispatch` with
`assigneeAgentId = null` is therefore not an unassigned task but a **deliberately human-only** one,
and precondition 4 refuses it (§7.3). The distinction is load-bearing from Stage 4 onward: the
reference template's step 9 is *"human review of deployment / PR"*, and a dispatch-time fallback
would run it under the default agent — the exact outcome the approval gate exists to prevent.

This is the single biggest divergence from the source reference and it is deliberate. AgentOS-spec
§9.4 says *"completing step N enqueues step N+1 (`todo` → runner picks it up)"*, and §3.4 suggests
pg-boss or Inngest to do it. D24 records why that shape is rejected here: **a process that finds
work and starts it is the failure PRD §12.1 exists to catch, automated.** Anyone building the
Kanban will feel the pull toward a worker loop the moment chains arrive in Stage 4 — §7.3 is the
answer, and it is not a worker.

**Agent *selection* — a model choosing which specialist should act next — does not exist in this
slice at all.** It is the goal orchestrator, Stage 5, and it is a model call rather than an
algorithm. A reader who assumes Stage 3 has it will look for code that is not there.

### 7.2 One funnel

```ts
// lib/agentos/dispatch.ts — the ONLY function in the system that may create a Session
dispatch(taskId: string, trigger: TriggerKind): Promise<DispatchResult>

type TriggerKind = 'manual' | 'chain' | 'goal' | 'cron' | 'webhook'
type DispatchResult =
  | { started: true;  sessionId: string }
  | { started: false; refusedBy: Precondition; reason: string }
```

Only `'manual'` is reachable in Stage 3. The other three are **future callers of this same
function**, not future mechanisms:

| Trigger | Caller | Stage |
|---|---|---|
| `manual` | the *Run now* control on a card | **3** |
| `chain` | the `done` transition handler, when step N+1 exists | 4 |
| `goal` | the goal orchestrator choosing the next specialist | 5 |
| `cron` | a scheduler tick | deferred → `docs/BACKLOG.md` |
| `webhook` | the trigger receiver | deferred → `docs/BACKLOG.md` |

**Each caller gets its own kind, even when the code path is identical.** `goal` and `chain` both
advance work without a human, and it would be tempting to let goals reuse `chain`. They are kept
apart because `triggerKind` exists to record **what asked for this run** — a chain step was decided
in advance by a template a human instantiated, a goal step was chosen by a model mid-loop, and a
session record that cannot tell those apart has lost the distinction the funnel was built to keep.

The value of deciding this now is that cron — the first caller that can start work while nobody is
watching — inherits §7.3's preconditions and §7.5's drift record **by construction**, instead of
arriving as a second path that has to be talked into obeying them.

### 7.3 Preconditions, checked in order, each refusing out loud

`dispatch` evaluates these in order and **stops at the first failure**. A refusal writes **no
`Session` row**, returns the reason as a string, and the UI renders that string verbatim — the
Stage 2 pattern, where the refusal text the API produced is the refusal text the human reads, so
the two can never disagree.

1. **The project has an execution layer** — an `agentos.yml` at its root (D18). Otherwise there is
   no board to dispatch from.
2. **The task is dispatchable** — status `todo`, and no session of its own currently `running` or
   `waiting-inbox`. Re-running a `doing` card is the mistake this catches.
3. **The project is under its concurrency cap** — `maxConcurrentSessions`, default **1** (§5.14).
4. **The agent resolves** — `assigneeAgentId` is **not null**, the agent exists, and its
   `allowedTools` / `disallowedTools` / `canCommit` grants can be composed into SDK options. A null
   assignee means **human-only** (§7.1) and is refused with that reason, never defaulted. An agent
   that cannot be composed must fail here, loudly, rather than silently spawning with default
   permissions.
5. **The base ref resolves** — `git rev-parse <baseRef>` succeeds in the primary repo, so §3.2's
   `worktree add` cannot fail halfway.

**Refusing is not queueing.** A refused dispatch is over; nothing is remembered and nothing retries.
Queueing would require a scheduler, and a scheduler is the thing D24 declined to build — pretending
otherwise would put a second, invisible source of truth about *what is about to happen* inside the
product whose premise is that no such thing should exist.

### 7.4 The session outlives the request

A run takes minutes to hours. An HTTP request cannot hold it, so:

```
server action ─▶ dispatch()
                   ├─ preconditions          (synchronous)
                   ├─ INSERT Session(status='running', pid, bootId, driftAtSpawnJson)
                   ├─ TaskEvent  todo → doing, actorType='session'
                   ├─ start the run, unawaited          ◀── the request returns HERE
                   └─ return { started: true, sessionId }
```

The run then proceeds in the Next.js Node process, writing `ToolCall` rows, `costUsd`, commit shas
and the terminal status into SQLite as it goes. **The UI never holds the run**; it reads the same
rows on load and on the manual refresh D8 already established. There is no streaming to the browser
in this slice — the design's own position 4 asks for a counter and a 3px rail, not a live feed, and
polling one row satisfies it.

### 7.5 What a session records about its own premise

At insert, `dispatch` calls the **portfolio layer's** reconciler for that project and stores the
result on the session as `driftAtSpawnJson`:

```json
{ "severity": "drift",
  "claim": "PRs #1 through #22 merged",
  "verified": "#23 is merged (1 past the claim); unclaimed open: #24",
  "source": "docs/HANDOFF.md",
  "check": "DC1",
  "checkedAtISO": "2026-08-18T11:07:04Z" }
```

Three things about this, in order of how easy each is to get wrong:

- **It is a record, not a rail.** Drift does **not** block dispatch. nadim has been `⚠` for twelve
  days; a modal on every run would be dismissed by the third one, which is exactly the reasoning
  behind the design's position 7. A blocking pre-flight still belongs to the goal DoD gate in
  Stage 5 (PRD §12.6) and this decision does not pre-empt it.
- **It is a snapshot, and is labelled as one.** The stored object is what was true at spawn and is
  never refreshed. The UI must render it in the past tense — *"started while the project claimed…"*
  — because re-reading it as current state would be the product committing its own sin.
- **This is the one call that crosses the layer boundary, and it crosses the permitted way.**
  §6's rule is that `lib/reconcile/` must not import `lib/agentos/`. This is the opposite direction:
  the execution layer *reads* the portfolio's checks. That direction is fine and stays fine — the
  dependency arrow points one way, and D19's boundary is about the portfolio's data path never
  reading execution state, not the reverse.

### 7.6 The state machine

Four columns — `todo · doing · review · done`. **`blocked` is a chip on a card, never a fifth
column**, matching frame `T1` where a `todo` card carries *"Unblocked by: Sobhi pasting a real key"*
and a `doing` card that has asked a question stays put.

| From | To | Actor | When |
|---|---|---|---|
| `todo` | `doing` | `session` | `dispatch` succeeds |
| `doing` | `review` | `session` | the agent calls `task.update_status` |
| `doing` | `done` | `session` | **only if `approvalGate` is false** (§3.4) |
| `doing` | `todo` | `system` | the session failed or was interrupted; `reason` recorded |
| `review` | `done` | `human` | the approval gate — always, when gated |
| *any* | *any* | `human` | a human may always move a card, and it is recorded as hand-moved |

Two rules the code enforces rather than the prompt:

- **A session may never write `done` on a gated task.** Two layers, §3.4, and AC-5 asserts *which*
  layer refused.
- **Every arrow writes a `TaskEvent`.** A status without one is a status with no evidence, which
  D19 does not permit to exist. AC-10 walks the fixture and asserts it cannot.

A card that is waiting on the inbox keeps `Task.status = 'doing'` and sets `blockedReason`; the
`Session.status` is `waiting-inbox` (§3.5). The card does not move, because nothing about the work
changed — only who it is waiting on.

### 7.7 A `running` row whose process is dead is a lie

The failure §7.4 buys is that `pnpm dev` restarting mid-run leaves a `Session` row saying `running`
forever, with no process behind it. That is a stored claim contradicted by reality — this product's
entire subject matter, occurring inside it — so it gets a mechanism rather than a note.

Every session stores `pid` and `bootId` (a uuid minted once per server process). **On boot, sweep:**
any session `running` or `waiting-inbox` whose `bootId` is not the current one becomes
`interrupted`, with `failureReason` stating it plainly, its worktree removed, its `ToolCall` rows
and `costUsd`-so-far kept, and its task moved back with a `TaskEvent` whose `actorType` is
`system`. **`waiting-inbox` is swept too** — its worktree is already gone by design (§3.5) and it
holds no process, but its `bootId` is stale, so the sweep must key on the session having no live
owner rather than on status alone. AC-18.

The honest consequence, which belongs in `FEATURES.md` under *Known gaps*: **restarting the dev
server kills every running session**, and the system reports that rather than hiding it. Surviving a
restart needs a supervisor process, which is the cloud runner's problem (D20) → `docs/BACKLOG.md`.

---

## §8 — The Tasks surface

Frame `T1` in [`design/wireframes2.pen`](../../design/wireframes2.pen) is the specification for this
page; the shell around it is `B′2` as amended by **D23**. This section states only what the drawing
cannot: the rules a builder would otherwise have to infer.

### 8.1 The shell (D23)

Three stacked pieces, top to bottom:

1. **The portfolio ribbon, 40px, always present.** Six projects as glyph + name only — no counts, no
   sentences, no deltas — plus the Board's own freshness timestamp and `← All projects` (`⌘1`).
   It renders from the same collector run as the Board, so the two cannot disagree; if the check
   failed, the ribbon says so rather than rendering six glyphs it cannot vouch for.
2. **The project drift band — only when *this* project is in drift.** The drift sentence verbatim
   from the check, and `open on Board`. Absent when the project is not in drift. This conditionality
   is safe in a way the ribbon's would not be (D23): the ribbon above it is already asserting this
   project's severity with a timestamp, so the band's absence adds no unsourced claim.
3. **The project rail + pane** — `Tasks · Goals · Inbox · Sessions · Costs`, with everything else
   behind `configuration`. Five items is the cap, and it is load-bearing: Agents, Templates,
   Environments and Repos are configuration, and the brief's work-versus-setup split holds only
   while there is nowhere for them to creep into.

### 8.2 Card anatomy

Top to bottom, all optional except the title:

| Element | Register | Notes |
|---|---|---|
| Title | sans, normal | the task name |
| Claim line | **quoted italic sans** | present only when it quotes a document — inherits the Board's claim register |
| Agent | `SP` monogram in a hairline `$muted` box + `@name` | fixed two letters, fixed position, **never a status colour** |
| Schedule chip | mono | `once`, `once · now`; `cron · Mon 09:00` is drawn but not built in this slice |
| Chain position | mono, `$muted` | `step 1 of 9 · compound-engineer` — drawn; Stage 4 |
| `blocked` chip + reason | sans | a label, not a column (§7.6) |
| **Evidence line** | see §8.3 | the reason the card is allowed to exist |
| Gate block | — | `review` cards only (§8.4) |

### 8.3 The evidence line is the whole point

D19 permits stored status **only** because every transition names what produced it. So:

| Card state | Renders | Register |
|---|---|---|
| `todo` | **nothing at all** | — |
| running | `▶ running · 12m · 41 tool calls · $2.10 so far` + branch, and a 3px `$muted` left rail | mono |
| executed | `▶ s_2f19ab · 3ac91e2 · 38m · $6.40 · 12 tool calls` | mono |
| failed | `▶ s_c40d17 · failed after 22m · $4.05` + the reason verbatim | mono |
| hand-moved | `"moved by hand · Sobhi · no session produced this"` | **quoted italic sans** |

**A `todo` card shows no evidence line, and this is a rule rather than an omission** — nothing has
happened yet, and an empty or placeholder line would be a claim about a run that does not exist.
The design states this on the frame; it is repeated here because it is the kind of blank a builder
fills in helpfully.

The mono-versus-italic split is the Board's claim-versus-fact distinction one layer down, and it is
doing real work: **an executed card and a hand-moved card must be distinguishable before either is
read.** A hand-moved card names a person and offers nothing to verify; an executed card offers a
session id and a sha that resolve.

**Session ids and shas resolve.** A sha links into the repo; a session id opens the session view.
An evidence line that displays an identifier nothing can look up is decoration, and would be the
first step toward the placeholder problem above.

### 8.4 The gate, on the card

A `review` card whose task has `approvalGate` carries: `human gate` / *"agent reached review · only
you can mark done"*, and the two actions `Approve & mark done` and `Read spec`.

- **The agent has no control here.** There is no affordance a session could operate, and §3.4's two
  layers mean it could not succeed if there were.
- **Dragging a gated card to `done` is refused in the UI with the same reason string the API
  returns.** One reason, one source. If drag-and-drop makes that awkward, drag is what gets dropped.
- The card states the consequence of *not* approving where a chain exists — *"step 2 (@plan) stays
  blocked until this is done"* — because that is the information the decision actually needs.

### 8.5 Column counts, and the counter rule

Column counts render as **plain mono numerals beside the column name — no pill, no colour**. The
design brief's §5 rule is that exactly one counter is legitimate (the Inbox); the design pushed
back that a column count is not a counter but a number of cards you could verify by looking, and
that reading is adopted. **If it reads as a badge once built, delete it — nothing depends on it.**

### 8.6 What this page must never do

- **No second drift board.** The band in §8.1 quotes the Board's own check and links to it; it never
  re-derives, re-words, or re-scores drift (D22).
- **No `+ New` in the portfolio layer**, and no project creation from the ribbon.
- **No agent picker at run time.** The agent is a property of the task, set when the task is created
  (§7.1). A per-run picker would be agent selection, which is Stage 5.
- **No activity feed.** Position 10: what needs you is the Inbox, what happened is Sessions, what is
  true now is the Board.
- **No motion on a running card.** The running item is the one you are *allowed* to ignore, and
  motion is the strongest attention signal available — spending it there inverts the product.

---

## §9 — Test seams

*New section, 2026-08-18.* Borrowed from the one idea in the `/to-spec` skill worth taking (see
`docs/LEARNINGS.md`): **name the seams the feature is tested at, prefer existing ones, and keep the
count as close to one as the design allows.** Our template had no slot for this, and Stage 3 chose
its seams implicitly — writing them down makes the choice reviewable and stops the suite from
growing a second one by accident.

| Seam | What it substitutes | Used by |
|---|---|---|
| **`Runner`** (§3.3, §6.3) | the entire Agent SDK — a scripted fake emits a chosen `SDKMessage` sequence | AC-1, 3, 4, 5, 6, 7, 9, 13 |
| **the fixture repo** (§4) | a real watched project — a generated git repo in a temp dir | AC-2, 8, 11, 15, 17, 18 |
| **`bootId`** (§7.7) | a process lifetime — a foreign value simulates a restart with no restart | AC-18 |

**One seam does the real work.** `Runner` is the boundary between "our logic" and "a model,
a subprocess, money and the network", and eight of nineteen checks cross it. That it was already the
right shape is not luck — D20 required the interface so a cloud runner could be substituted later,
and testability came free with it. **Nothing else may be mocked**: SQLite is real, git is real,
the MCP servers are real in-process functions, and `dispatch` is called for real. A test that stubs
any of those is testing our stubs.

**The seam that does not exist, deliberately.** There is no fake for git. AC-2 and AC-8 exist
precisely to prove worktree behaviour against the real binary, and a git fake would delete their
subject. AC-12 plays the same role one level up for the SDK — the single opt-in real session that
keeps the other eighteen honest.
