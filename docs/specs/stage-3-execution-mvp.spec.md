# Spec — Stage 3: the execution MVP (one vertical thread)

status: ☐ design closed — **two owner decisions gate the build**, both in §5.11 and §5.12: which
watched repo the first sessions target, and whether the MVP agent may commit at all. Everything
else in §5 is closed. The owner clears both.

> **The first slice that runs an agent.** Everything before it observed; this one *acts*. Product
> context: `docs/PRD.md` §12.4, and **D18–D22**, which are its premise. Depends on Stage 2
> (`stage-2-fix-proposals.spec.md`) only for the guard patterns it reuses — not for its code.
>
> **Read §3.5 before building anything.** The inbox pause/resume model is the one decision that
> shapes every other file in this slice, and the obvious implementation is the wrong one.
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
Project(id, slug, primaryRepoPath, yamlPath, createdAt)          -- D21: repos[] arrives with Stage 4
Agent(id, projectId, name, model, rolePrompt, allowedTools,      -- JSON columns for the two arrays
      disallowedTools, canCommit, maxTurns, maxBudgetUsd)
Task(id, projectId, name, description, status, approvalGate,
     assigneeAgentId, createdAt)
TaskEvent(id, taskId, from, to, actorType, actorId, atISO)       -- actorType: 'session' | 'human'
Session(id, taskId, agentId, sdkSessionId, status, worktreePath,
        baseRef, costUsd, startedAtISO, endedAtISO, failureReason)
ToolCall(id, sessionId, seq, name, inputJson, atISO)
InboxMessage(id, sessionId, taskId, kind, body, choicesJson,
             answer, status, askedAtISO, answeredAtISO)
CommitSha(sessionId, sha)                                        -- read from git, never from us
```

`TaskEvent` is the table that makes D19 true rather than aspirational: **every status transition
names its actor, and the UI reads status history from here.** A `Task.status` with no corresponding
`TaskEvent` is a bug, and AC-10 asserts it cannot happen.

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
11. **⚠ GATING — which repo do the first real sessions target?** PRD §12.4 says a low-stakes watched
    repo, never agentic-os. Both candidates are quiet: `my-personal-website` (last commit 2026-08-06)
    and `fractal-code` (2026-07-26). **The owner picks**, because it is their repo and the run ends
    in a commit. *Recommendation: `fractal-code`* — it is the quieter of the two and has no state
    doc for a stray agent to contradict.
12. **⚠ GATING — may the MVP agent commit at all?** The thread in PRD §12.4 ends in a commit, and
    AC-8 assumes one. A `canCommit: false` first run — agent works, we read the diff, nothing is
    written to the object store — is a defensible smaller step that still exercises worktree,
    inbox, gate, and cost. **The owner decides**; both are buildable and the schema carries the flag
    either way. *Recommendation: ship with `canCommit: true` but default the seeded agent to
    `false`*, so the first real run is observable before it is consequential.

**Deliberately not decided here** (they belong to later stages, and deciding them now would be
guessing): the goal orchestrator's next-specialist choice, template variable interpolation, and how
the Overview renders `▶ executed`.

## §6 — Build notes

Order matters; the risk is concentrated in the first three.

1. **`lib/agentos/db.ts`** — schema + migrations. No ORM; this is nine tables.
2. **`lib/agentos/worktree.ts`** — create/teardown, with AC-2 and AC-9 written **first**. This is
   the piece that touches a real repo, so it gets tested before anything can call it in anger.
3. **`lib/agentos/runner/` — the `Runner` interface, `LocalRunner`, and the scripted fake.** The
   fake is not a test detail; it is what makes eleven of the thirteen checks runnable at all.
4. **`lib/agentos/mcp/`** — the two in-process servers, with the gate in the handler (§3.4).
5. **`scripts/verify-stage3.mts`** — AC-1…AC-13 against fixtures, before any UI.
6. **UI last**: `/p/<slug>/tasks` board, the session view with its tool-call log, the inbox.

**Reuse rather than re-derive:** `lib/collectors/git.ts` for repo facts, `lib/collectors/exec.ts`
for subprocess plumbing, and the `app/actions.ts` pattern where the server rebuilds the request
rather than trusting the browser — the reason the browser never names a path in Stage 2 applies
unchanged to a task id.

**A note for whoever builds this.** The Board must keep working throughout. It is the surface the
owner actually uses, and D19 makes the layer boundary an enforcement boundary — so
`lib/reconcile/` must not import `lib/agentos/`. If it ever needs to, that is a decision, not an
import.
