# Spec — Stage 4b: the delivery path

status: ☑ decisions closed (**D37–D41**) — buildable. **One owner gate remains and it is an
acceptance criterion, not a decision:** no branch this product created has ever been pushed, and
until one is, this stage is code that has never left the machine. Sequenced **after Stage 4** and
**before Stage 6**, for the reason in the box below.

> **The stage that lets the product build itself.**
>
> Everything from Stage 3 forward can start work, run it, gate it, pause it, cost it and record it.
> None of it can *hand the work back*. A session's commits land on a **detached HEAD** inside a
> worktree that is then `--force` removed ([`lib/agentos/worktree.ts:13`](../../lib/agentos/worktree.ts#L13)
> — *"nothing is pushed, nothing moves a branch"*), so the output of a successful five-hour run is a
> sha in a `CommitSha` row and a dangling object with a garbage collector's deadline on it. There is
> no branch, no push, no PR, and the worktree has no `node_modules`, so the agent cannot run
> `pnpm verify` to find out whether its own work compiles.
>
> Stage 4's seeded template ends at step 9: *"Human checks out the PR, reviews, merges."* **The
> product cannot produce that PR.** This stage is the four things between a commit and that
> sentence: a **branch**, a **prepared workspace**, a **verified result**, and a **pull request** —
> plus the one that makes stacked work expressible at all, a **declared base ref**.
>
> **Why it is numbered 4b and not 3d.** It is not a missing piece of Stage 3; Stage 3's motor is
> complete and correct on its own terms. It is the boundary between *running* work and *shipping*
> it, and it only becomes urgent once chains exist to produce more than one commit worth handing
> back. **Why it comes before Stage 6:** Stage 6 (the Overview) is the first stage that could
> plausibly be built *by* this system rather than by hand. It cannot be, while a finished session's
> work can only be recovered by reading a sha out of SQLite and running `git branch` against it.
>
> Product context: `docs/PRD.md` §12 (the two layers) and D19's evidence rule — **a status that
> cannot name the session that produced it is a claim.** A PR body is where that evidence stops
> being internal.
>
> **This stage has no source in [`AgentOS-spec.md`](AgentOS-spec.md).** The talk assumes a PR
> appears; nothing in it says who makes one. Where that reconstruction is silent, this spec decides.

---

## §1 — Scope

**In:**

1. **A named branch per session** (D37) — the worktree is created with `-b`, so every commit is on a
   ref before the run starts, not archaeology after it ends.
2. **A declared base ref** (D38) — `Project.defaultBaseRef` and per-task `Task.baseRef`, replacing
   `dispatch`'s hardcoded `HEAD`. This is what makes **stacked tickets expressible**: T2's task can
   name T1's branch.
3. **Workspace preparation** (D39) — a `prepare:` command in `agentos.yml`, run inside the worktree
   **before** the model call, whose failure refuses the dispatch instead of handing the agent a
   workspace it will spend budget discovering is broken.
4. **Session self-verification** (D40) — a `verify:` command in `agentos.yml`, run inside the
   worktree **after** the model call and **before** teardown, with exit code and output tail
   recorded on the `Session` as evidence.
5. **A composed dispatch preamble** — the facts a session cannot function without (its branch, its
   base, that the worktree is destroyed at the end, that it must commit) built by code from what the
   system already knows, not retyped into every task description.
6. **Push & open PR** (D41) — **one explicit human click** per session, producing a pushed branch
   and a PR against the project's integration branch, whose body is that session's evidence.
7. **`pnpm verify:stage4b`**, fixture-based. **The remote is a real bare repo in a temp dir**, never
   a network host (§7).

**Out** — each is a later stage, an invariant, or a backlog entry:

- **Merging. Ever.** `CLAUDE.md`: *the agent never merges — not its own PR, not any PR.* The
  product's authority ends at an open PR. No code in this stage may call `gh pr merge`, and AC-11
  asserts the string appears nowhere in the shipped source.
- **Automatic push on session completion.** D41 — the click is the gate, and it is Invariant 4
  applied to the one action that leaves the machine.
- **Surviving a dev-server restart.** A session runs inside the Next.js process (Stage 3 §7.4); a
  restart still kills it and the boot sweep still marks it `interrupted`. A supervisor is the cloud
  runner's problem (D20) → `docs/BACKLOG.md`. **This stage does not solve it and materially reduces
  it:** the branch already exists, so an interrupted session's commits are on a ref instead of
  dangling, and the card can say *"interrupted at `<sha>` on `<branch>`"* rather than losing the run.
- **Rebasing, conflict resolution, or updating a branch that has fallen behind.** A branch that no
  longer merges cleanly is a human's problem, and a product that resolves conflicts unattended is
  making judgement calls nobody reviewed.
- **Deleting a branch after its PR merges.** Cleanup is `git branch --list 'agentos/*'`, by hand,
  and the namespace exists so that command is safe (§3.3) → `docs/BACKLOG.md`.
- **Non-primary repos.** D21 allows a project to mount several; this stage branches, prepares,
  verifies and pushes **the primary one only**. A per-session repo manifest is the unspecced
  `Repos` setup row.
- **Caching `node_modules` between sessions.** Symlinking or copying the owner's tree into the
  worktree is faster and lets a session corrupt the checkout the owner is working in. `prepare:`
  pays the honest cost → `docs/BACKLOG.md` for a content-addressed store if it ever hurts enough.

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Puts every session's work on a branch | `git branch --list 'agentos/*'` names it, and it survives teardown | **AC-1** |
| Leaves no branch for a session that wrote nothing | A run with zero commits deletes its own ref | AC-2 |
| Branches from a declared base, not the owner's HEAD | A task naming `origin/develop` branches there while the checkout sits elsewhere | **AC-3** |
| Lets one task stack on another's branch | T2's task names T1's branch and sees T1's commits | AC-4 |
| Prepares the workspace before spending anything | `prepare:` runs in the worktree; `node_modules` exists before the model is called | **AC-5** |
| Refuses the run when preparation fails | Non-zero exit → `started: false`, reason names the command and its exit code; **no session, no cost** | **AC-6** |
| Runs the project's own verification after the agent | Exit code and last output lines recorded on the session | AC-7 |
| Never lets the agent report its own verification | The recorded result comes from the runner's own child process, not from anything the session said | **AC-7** |
| Tells the session what it needs to know | Preamble names branch, base sha, the destroyed worktree, and the duty to commit | AC-8 |
| Pushes and opens a PR on one click | Branch pushed, PR opened against the integration branch, URL stored on the session | **AC-9** |
| Puts the evidence in the PR body | Session id, cost, drift at spawn, commit shas, verify exit code | AC-10 |
| Refuses to push a session that failed verification | Unless the human confirms in the same gesture; the refusal says which check failed | AC-9 |
| Never merges | `gh pr merge` appears nowhere in the source | **AC-11** |
| Says a push is a push | The control reads *"Push `agentos/…` & open PR → develop"*, never "Ship" | AC-12 |

## §3 — Data & sources

### 3.1 Schema (extends Stage 3 §3.7 and Stage 4 §3.1)

```
Project  gains  defaultBaseRef        -- 'HEAD' unless agentos.yml says otherwise
                integrationBranch     -- PR base; 'develop' unless agentos.yml says otherwise
Task     gains  baseRef               -- nullable; null means the project's default
Session  gains  branchName            -- 'agentos/<task-slug>-<short>'; null only pre-migration
                prepareExitCode, prepareMs
                verifyExitCode, verifyTail
                pushedAtISO, prUrl
```

Every added column is **nullable with no default**, and migration 3 is additive for the same reason
Stage 4's migration 2 is: `data/agentos.sqlite` on the owner's machine already holds real rows
(`stage-4-tickets.md`, inherited fact 3). **Never edit an applied migration.**

### 3.2 The branch is created at spawn, not derived afterwards

`createWorktree` changes from `worktree add --detach <path> <sha>` to
`worktree add -b <branch> <path> <sha>`. That is close to a one-line change and it is the highest-
value line in this stage, because of what the current behaviour costs:

- **`worktree remove --force` leaves the commits unreferenced.** `worktree.ts:137` already documents
  the recovery — *"recoverable only as `git branch <name> <sha>` … and eventually reclaimed by gc"*.
  The product's own evidence rule is that work must stay reconstructible; a sha with a deadline on it
  is not.
- **It converts an interruption from a loss into a restart.** The boot sweep (Stage 3 §7.7) already
  reports a killed session honestly. With a branch, honest also becomes *useful*.
- **It is what a push needs.** You cannot push a detached HEAD without inventing a ref, and
  inventing it at push time means inventing it after the worktree that produced it is gone.

`readWorktreeCommits` keeps reading `<baseSha>..HEAD` — the base is still pinned to a resolved sha
(worktree.ts's own trap note), and the branch name is bookkeeping on top of it, not a replacement.

### 3.3 The branch name is namespaced, and that is the cleanup story

`agentos/<task-slug>-<first 8 of sessionId>`. Three properties, each load-bearing:

- **It can never collide with hand-made work.** This repo's branches are `feat/…`, `fix/…`,
  `chore/…`, `docs/…` (`CLAUDE.md`). The `agentos/` prefix is unclaimed, so a human can run
  `git branch -D $(git branch --list 'agentos/*')` without reading any of them first.
- **The session id is in the name.** Given a branch, one query returns the session, its cost, its
  tool calls and its drift at spawn. Given a session, the branch is computable. Neither direction
  needs a lookup table, which is the second source of truth D11 forbids.
- **The task slug is in the name** so the branch list is readable by a human at a glance. It is
  display, not a key — **nothing is keyed on the task slug** (Stage 4 §3.1's one-identifier rule,
  one level down).

### 3.4 A session that wrote nothing leaves nothing

If `readWorktreeCommits` returns empty, the branch is deleted (`git branch -D`) as part of teardown.
A ref pointing at the base sha is not evidence of work; it is nine refs a week of noise that make
`git branch --list 'agentos/*'` useless, which makes the cleanup story in §3.3 untrue.

**Ordering matters and it is the same trap §3.2 records:** commits are read *before* teardown, and
the delete decision uses that already-read list — never a second `git log` after the worktree is gone.

### 3.5 `prepare:` and `verify:` are declared, never inferred

`agentos.yml` gains two optional keys, both absent by default:

```yaml
prepare: pnpm install --frozen-lockfile
verify:  pnpm verify:stage4
```

**Neither is guessed from the repo's contents.** A lockfile is not consent to run a package manager,
and inferring `pnpm install` from a `pnpm-lock.yaml` would mean any repo that grows one starts
executing an install the owner never authorised. Absent key → step skipped, and the session's
`prepareExitCode` stays `null` — *"not configured"*, never `0`, because `0` is a claim that
something ran and passed.

**`prepare:` reaches the network, and that is inside the existing carve-out, not a new one.** D19
narrows Invariant 1 for an execution layer to *the model API, and the hosts a session's environment
explicitly allow-lists.* A command written by hand into the project's own `agentos.yml` is that
allow-list — it is the owner declaring it, in a file the owner owns, read at dispatch. **What must
never happen is this command being suggested, defaulted, or written by the product.** D39 records
the reasoning; if that reading is ever contested, it is an invariant question and stops the build.

**Why preparation refuses the dispatch rather than warning.** A worktree with no dependencies is a
workspace where the first `pnpm verify` fails for a reason unrelated to the work, and the agent's
next twenty turns are spent diagnosing our bug on the owner's budget. Refusing costs nothing;
proceeding costs money and produces a plausible wrong conclusion.

### 3.6 Verification is run by the runner, and never reported by the session

`verify:` runs as a child process after the model call settles, in the worktree, before teardown.
Its exit code and the **last 40 lines** of its output land on the `Session` row.

**The session is never asked whether its work passes.** That is the whole product in one line: a
session saying *"tests pass"* is a claim, and this product exists because claims and reality diverge.
The runner watching a child process exit is a check. AC-7 asserts the recorded result is unaffected
by anything the session said, by scripting a `FakeRunner` that announces success while the verify
command exits non-zero — **and the session must still be recorded as failing verification.**

**Verification failing does not fail the session.** They are different facts and both are recorded:
`Session.status` reports what the *run* did; `verifyExitCode` reports what the code does. Collapsing
them would make a session that correctly reported a pre-existing red suite look like a crashed run.
This is the same shape as the teardown-failure rule in `dispatch.ts` — *neither fact is allowed to
hide the other.*

### 3.7 The preamble is composed, not configured

The prompt becomes the task's own text **preceded by a block the code builds** from facts it already
holds: the worktree path, the branch, the resolved base sha, the prepare and verify commands, and
the two sentences a session in an ephemeral worktree cannot work without — *commit your work before
you finish or stop* and *this directory is destroyed when this session ends*.

It is code, not a config field, for the same reason `gateRefusalReason` is one function with two
renderings (D36): two strings that must agree are a second source of truth wearing a justification.
The task description stays the brief; the preamble stays the environment.

### 3.8 Push and PR: one click, one gesture, and never a merge

The control lives on the session card of a **settled** session that has a branch and at least one
commit. One click does all of: `git push -u origin <branch>`, then
`gh pr create --base <integrationBranch> --head <branch>` with a generated title and an evidence
body, then stores `prUrl` and `pushedAtISO`.

**One click, not three.** A gate people learn to click through three times is not three gates; it is
one gate with worse copy — the reasoning Stage 2 closed for the fix-proposal button and Stage 4 §5.3
reuses for the chain gate. The honesty lives in the **label** (AC-12), which names the branch and the
base: *"Push `agentos/stage-6-t1-a1b2c3d4` & open PR → develop"*.

**Never `main`.** `integrationBranch` defaults to `develop`, and `CLAUDE.md`'s workflow is explicit
that `main` receives only `develop` and only from the owner. AC-11 asserts no merge call exists at
all; the base default is what keeps an honest mistake from targeting the wrong branch.

## §4 — Acceptance

Fixtures only. The model is never called. **The remote is a real bare repo in a temp dir** (§7), so
push is genuinely exercised without touching a network host.

- **AC-1 — the work is on a ref.** A `FakeRunner` scripted to commit leaves, after teardown,
  `git branch --list 'agentos/*'` naming the branch and `git log <branch>` containing the commit.
  Assert **after** `removeWorktree` — before it, a detached HEAD would pass too.
- **AC-2 — an empty run leaves no ref.** A run that commits nothing: the branch does not exist, and
  `git worktree list` shows no stale entry.
- **AC-3 — the base is declared.** With the fixture repo's checkout on branch `X` and the task's
  `baseRef` naming `Y`, the worktree's base sha is `Y`'s. **`[G]`** revert to `BASE_REF = "HEAD"`,
  observe red, revert — this guard is the whole point of the column.
- **AC-4 — stacking works.** Task B names task A's branch as `baseRef`; B's worktree contains A's
  commit and B's own `<base>..HEAD` range excludes it.
- **AC-5 — prepare runs first.** A `prepare:` of `touch prepared.txt` leaves that file present in
  the worktree **at the moment the runner is invoked** — asserted from inside the `FakeRunner`'s own
  callback, not afterwards, because afterwards cannot distinguish "before the model" from "after".
- **AC-6 — a failed prepare refuses the dispatch.** `prepare: exit 3` → `dispatch` returns
  `started: false` naming the command and exit code, **and** `SELECT count(*) FROM Session` is
  unchanged, **and** the worktree is gone. Nothing spent, nothing stranded.
- **AC-7 — verification is measured, not reported.** `verify: exit 1` with a `FakeRunner` scripted
  to announce success: `verifyExitCode = 1`, `verifyTail` non-empty, and `Session.status` is
  `completed` — the run succeeded and the code is red, both recorded, neither hiding the other.
- **AC-8 — the preamble carries the environment.** The composed prompt contains the branch name, the
  resolved base sha, the worktree path, and the commit-before-you-stop sentence. Asserted on the
  composed string.
- **AC-9 — push and PR, on the gesture and only on it.** Against the bare-repo remote: before the
  click, `git ls-remote` shows no such ref and `prUrl` is null; after it, the ref exists and `prUrl`
  is stored. **And:** a session with `verifyExitCode` non-zero refuses unless the confirm flag is
  set, naming the failing command.
- **AC-10 — the PR body is the evidence.** The generated body contains the session id, its cost, its
  `driftAtSpawn`, every commit sha, and the verify exit code. Asserted on the composed body string,
  so no PR need be created to check it.
- **AC-11 — the product cannot merge.** `gh pr merge` and `git merge` appear in no file under
  `lib/` or `app/`. A source-level check, deliberately crude: this is an invariant, and an invariant
  enforced only by nobody remembering to violate it is enforced by nobody.
- **AC-12 — the control names what it does.** The label contains the branch name and the base
  branch. Asserted on the rendered string from a pure function.
- **AC-13 — the migration is additive.** Migration 3 against a database holding Stage 3 and Stage 4
  rows leaves every existing row byte-identical, with new columns `NULL`; migrating twice is a no-op.

**The owner gate — AC-14, and no fixture can close it.** *One real branch, pushed, with a real PR
opened, reviewed by a human, and merged by the owner.* Every check above runs against a bare repo in
`/tmp`. Until a PR exists on GitHub that this product opened, the last mile is unproven code — the
same shape as Stage 2's *"one real drift corrected"*, which is still open, and Stage 3b's *"no human
has run the cycle by hand"*. **Write it into `docs/HANDOFF.md` as an open gate the day this stage
lands**, not the day someone notices.

## §5 — Decisions

**D37–D41, written into `docs/DECISIONS.md` by T1 before any code.** Summarised here; the records
are the contract.

1. **D37 — a session commits to a named branch, created at spawn.** Not derived at teardown, not
   invented at push. §3.2.
2. **D38 — the base ref is declared, never inherited from the owner's checkout.** `dispatch`'s
   hardcoded `HEAD` means "wherever the owner happens to be standing", which is the exact failure
   `CLAUDE.md` records four sub-agents hitting from the other direction. §3.1, §3.3.
3. **D39 — the workspace is prepared by a command the owner declared, and that command may reach the
   network.** Inside D19's existing allow-list carve-out, not a new one, **because the owner wrote
   it by hand in their own repo's file.** The product may never suggest, default, or infer it. §3.5.
4. **D40 — a session's verification is run by the runner and never reported by the session.** A
   session's account of its own work is a claim; a child process's exit code is a check. §3.6.
5. **D41 — push and PR are one human click, and merge is not the product's to make.** §3.8.

**No decision is open.** If one surfaces mid-build — particularly anything that widens what
`prepare:` may do, or that would let a push happen without a click — **stop and close it in
`docs/DECISIONS.md` first.** That is what the gate is for.

## §6 — Build notes

Four tickets, stacked, in this order. Ticket file: `docs/specs/stage-4b-tickets.md`, written before
T1 starts.

1. **T1 — D37/D38, migration 3, and the branch.** `worktree.ts` (`-b`, and the empty-branch delete),
   `dispatch.ts` (base ref resolution from task → project → `HEAD`), `db.ts` migration 3, the suite.
   Closes AC-1, AC-2, AC-3, AC-4, AC-13.
2. **T2 — prepare and verify.** `config.ts` (two keys), `dispatch.ts` (the pre-run gate), the
   post-run child process. Closes AC-5, AC-6, AC-7.
3. **T3 — the preamble and the PR body.** Both pure composers in a leaf module so the suite asserts
   strings without spawning anything. Closes AC-8, AC-10, AC-12.
4. **T4 — push, the PR, and the UI.** The server action, the session-card control, and the
   `verifyExitCode` refusal. Closes AC-9, AC-11. Ships the stage and writes AC-14 into `HANDOFF.md`
   as an open owner gate.

**Reuse rather than re-derive:** `run()` from `lib/collectors/exec.ts` for every child process (it is
already the project's one command runner and it already returns `null` on failure rather than
throwing); `FakeRunner` unchanged; the fixture-repo harness from `verify-stage2.mts`; and
`resolveOwnedTask` for the push action's ownership check.

## §7 — Test seams

| Seam | What it substitutes | Used by |
|---|---|---|
| **`Runner`** (Stage 3 §3.3) | the Agent SDK — reused unchanged | AC-1, 2, 5, 7 |
| **the fixture repo** | a real watched project | all |
| **a bare repo in a temp dir, as `origin`** | GitHub, for `git push` | AC-9 |
| **an injected `gh` invoker** | GitHub's API, for `pr create` | AC-9 |

**Two new seams, and the stage argues for both.** Stage 3 §9 and Stage 4 §7 both push to keep the
count near one, and this stage is the exception those arguments anticipated: it is the first that
acts on something outside the machine, so it is the first that needs the outside substituted.

**The push seam is not a fake.** `git init --bare` in a temp dir is a *real* remote, exercising real
`git push` semantics — ref creation, non-fast-forward rejection, the lot. A mocked push would prove
only that we called a function we wrote. **The `gh` seam is a genuine substitute** and is the
smaller of the two on purpose: one injected function that takes argv and returns stdout, so the
argv it is called with is itself assertable — which is how AC-11's *"never merges"* becomes checkable
behaviour rather than only a source grep.
