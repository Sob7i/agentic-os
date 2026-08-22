# Stage 4b — build tickets

Four tickets for [`stage-4b-delivery.spec.md`](stage-4b-delivery.spec.md).
**They stack: T2 branches off T1, T3 off T2, T4 off T3 — never off `develop`.**

**No ticket here writes D37–D41** — a correction to spec §5, which says they are *"written into
`docs/DECISIONS.md` by T1 before any code."* They were written with the spec itself in **#33** and
are in the file now ([`docs/DECISIONS.md`](../DECISIONS.md), D37 through D41). T1 **reads** them;
rewriting them would produce two versions of a closed decision, which is the second source of truth
invariant 5 forbids. If a genuinely new decision surfaces mid-build — particularly anything that
widens what `prepare:` may do, or that would let a push happen without a click — **stop and close it
in `docs/DECISIONS.md` first.** The next free number is **D44**; D42 and D43 were closed by Stage 4.

## What this stage inherits that is not in the spec

Twelve measured facts, carried here so a ticket brief does not have to re-derive them. All measured
**2026-08-22** by reading the named files at `f383c42`, which is `develop`'s head as this was
written — re-check anything below that a ticket depends on rather than trusting the line numbers.

1. **The next migration number is 4, not 3.** Spec §3.1 and AC-13 both say *"migration 3"*, and
   migration 3 already exists: it is Stage 4's `TaskTemplate` de-duplication and unique index, added
   in review of #38 ([`db.ts:248`](../../lib/agentos/db.ts#L248)). `MIGRATIONS` holds versions 1, 2
   and 3 today (`grep -n '    version: ' lib/agentos/db.ts` → three hits). **This stage adds
   migration 4**, and AC-13 is asserted against it. Reading "migration 3" literally would either
   edit an applied migration — the one thing §3.1 says never to do — or silently skip, since
   `migrate()` ignores any version at or below `PRAGMA user_version`.
2. **One migration for the whole stage, added by T1.** Migration 4 adds **every** column §3.1 names,
   including the ones only T2 and T4 write (`prepareExitCode`, `prepareMs`, `verifyExitCode`,
   `verifyTail`, `pushedAtISO`, `prUrl`). Three tickets each adding a migration would mean three
   schema versions for one stage and three chances to edit an applied one; T2 and T4 then write to
   columns that already exist. **Never edit an applied migration** — including migration 4 once T1
   has landed, which is why it must be complete on the first pass.
3. **`createWorktree` cannot take a required fourth parameter without turning `verify:stage3`
   red.** Production callers are exactly two — [`dispatch.ts:268`](../../lib/agentos/dispatch.ts#L268)
   and [`dispatch.ts:529`](../../lib/agentos/dispatch.ts#L529) (the resume). **`withWorktree` has no
   production caller at all**; `dispatch` uses `createWorktree`/`removeWorktree` directly, and
   `withWorktree` is reached only from `scripts/verify-stage3.mts:189` and `:220`, with a third
   direct `createWorktree` call at `:149`. So the branch argument goes in as an **optional trailing
   parameter, absent → today's detached behaviour**, and the Stage 3 suite keeps compiling and
   passing with no edit. Stage 4's inherited fact 6 recorded why that matters: a suite red across
   three tickets is exactly how a real regression hides in the noise.
4. **`BASE_REF = "HEAD"` is one constant used twice, and the resume path never sees it.**
   [`dispatch.ts:252`](../../lib/agentos/dispatch.ts#L252) defines it; `:253` resolves it for
   precondition 5 and `:268` passes it to `createWorktree`. **`resumeSession` passes
   `session.baseRef`** ([`:529`](../../lib/agentos/dispatch.ts#L529)) — already a resolved sha from
   the first dispatch — and passes through none of the five preconditions. Two paths, and spec §1
   item 3 and §3.2 both turn on the second one.
5. **AC-11's grep is clean at the base.** `grep -rn "gh pr merge\|git merge" lib app` returns
   nothing today. The guard is not documenting an existing state to preserve by luck; it is a check
   on what **this stage** adds. Run it at the start of T4 and again at the end.
6. **`verify:stage3c` AC-17 lists table *names*, and this stage adds no table.** It compares the
   `CREATE TABLE IF NOT EXISTS` names in `db.ts` against an explicit eleven-name list
   ([`verify-stage3c.mts:735`](../../scripts/verify-stage3c.mts#L735)). Stage 4b adds **columns
   only**, so — unlike Stage 4's T1 — **no edit to `verify-stage3c.mts` is needed, and none is
   permitted.** A ticket that finds itself editing that list has started creating a table, which is
   not in this stage's scope.
7. **`verify:stage3c` AC-1 walks value-imports transitively from every `"use client"` file**
   ([`:353`](../../scripts/verify-stage3c.mts#L353)), failing on `node:*` or `lib/agentos/db`.
   `lib/agentos/command.ts` will import `node:child_process` and the push path will reach `gh`, so
   **the push control's client component may import the server action and pure render helpers, and
   nothing else.** The `lib/tasks/dnd.ts` pattern, not the `lib/tasks/model.ts` one.
8. **`config.ts` parses exactly two keys today** — `slug` and `maxConcurrentSessions`
   ([`config.ts:42`](../../lib/agentos/config.ts#L42)). All four of §3.5's keys are new work, and
   `ParsedConfig` is consumed by `initializeProject` in
   [`app/p/[slug]/[tab]/actions.ts`](../../app/p/%5Bslug%5D/%5Btab%5D/actions.ts) — so T2 owns both
   ends: parsing the keys and persisting the two that become `Project` columns.
9. **`gh` is invoked in exactly one file today** — [`lib/collectors/github.ts:15`](../../lib/collectors/github.ts#L15)
   and `:28`, both through `run()`. That file is the **portfolio layer's** collector and the layer
   boundary is an enforcement boundary (D19): the `pr create` invoker is new code in the execution
   layer and does not belong there.
10. **`Task` has no slug column** — only a free-form `name`
    ([`types.ts:74`](../../lib/agentos/types.ts#L74)). `slugify` is new, and §3.3 specifies it
    precisely because there is nothing to reuse.
11. **`data/agentos.sqlite` on the owner's machine holds real rows**, still true from Stage 4's own
    fact 3. **The counts are deliberately not written here** — they are volatile and belong to
    `docs/HANDOFF.md`'s *Verified state* block alone; reproduce with `sqlite3 data/agentos.sqlite
    ".tables"` and a `count(*)` per table. What does not rot: migration 4 runs against a live
    database with the owner's data in it.
12. **`updateSession` builds its `SET` clause from the patch object's own keys**
    ([`db.ts`](../../lib/agentos/db.ts), `updateSession`), so a new `Session` column needs only a
    field on `SessionPatch` — there is no per-column writer to add. `createSession`'s input type is
    the one that needs `branchName` explicitly, since the branch is known at spawn.

## Standing constraints — every ticket

- **Base check in every brief:** the expected sha **and** a structural tell. For this stage the
  cheap tells are `grep -c '    version: ' lib/agentos/db.ts` (**3** at T1's base, **4** after) and
  `ls lib/agentos/command.ts` (**absent** at T1 and T2's base, present from T3). A missing file is
  a faster tell than a hash comparison, and sub-agents in this project have started from the wrong
  base four times. Worktrees are created **by hand** from the named branch:
  `git worktree add -b <branch> <path> <base>`, then `pnpm install` inside it — never the tool's
  default base, which is `origin/main` and deliberately behind `develop`.
- **Three new test seams, and no fourth.** Spec §7 names them: the bare repo as `origin`, the
  injected `gh` invoker, and `command.ts`'s runner. A fourth is a **stop and say so**, not a build
  decision — the stage already argued its way past the "keep the count near one" rule once.
- **No test touches a network host, a watched repo, or `data/agentos.sqlite`.** The remote is
  `git init --bare` in a temp dir; `gh` is the injected invoker; every fixture db is a fresh temp
  file. A fresh temp dir per check, one unconditional cleanup sweep at the true end — the
  `verify-stage4.mts` shape.
- **Every decision that can be wrong goes in `lib/`.** No acceptance script imports a component
  (`docs/LEARNINGS.md`, 2026-08-19). AC-8, AC-10 and AC-12 assert **strings produced by pure
  functions**, which is why T3 exists as its own ticket.
- **Every new server action gets a hostile ownership check** — reuse `resolveOwnedTask`
  ([`app/p/[slug]/[tab]/actions.ts:193`](../../app/p/%5Bslug%5D/%5Btab%5D/actions.ts#L193)) with its
  injected db threaded, and do not write a sixth one. The push action is the highest-value target in
  the product: it leaves the machine.
- **Guards must be proven.** For each `[G]` check — AC-3 and AC-14 — commit the sin, observe red,
  revert. A guard never seen red is decoration.
- **`package.json`: insert the `verify:stage4b` key, never edit the `verify` key.** `verify-all.mts`
  discovers suites from the `verify:*` keys; a hand-maintained list is what made two branches
  collide over a question containing no disagreement.
- **A command is argv, never a shell string** (§3.5). `execFile` does not tokenize. `sh -c` is
  available by writing `["sh", "-c", "…"]`, which is the owner's explicit choice and greppable.
- **In JSX, interpolate complete strings.** This stage's version of the twice-shipped defect is a
  push label reading `Push agentos/… & open PR → develop` with the branch name broken across a
  newline. Use a ternary returning whole phrases.
- **Never `main`.** No ticket may write code that calls `gh pr merge` or `git merge`, and T2's
  parser refuses `main`/`master` as an `integrationBranch` (§3.8). If a ticket finds itself needing
  a merge to make something work, the thing it is building is out of scope.

---

## T1 — the branch, the declared base, and migration 4

**Branch:** `feat/stage-4b-t1-branch` off `develop`.
**Closes:** AC-1, AC-2, AC-3, AC-4, AC-13, AC-14, AC-15. Creates the suite and adds **AC-0a**, one
structural check of its own, numbered outside the spec's range so a later reader can see it is
ticket-level.

**This is the largest of the four**, and deliberately so: spec §6 assigns the schema, both worktree
paths and the form field to it, and splitting them would mean shipping a column nothing writes.

**Owns:**
- `lib/agentos/db.ts` — **migration 4 only** (inherited facts 1 and 2), adding every column §3.1
  names, on `Project`, `Task` and `Session`, all nullable with no default **except**
  `integrationBranch` (see the backfill note below). Plus: `CreateTaskInput`/`createTask` gain
  optional `baseRef`; `CreateSessionInput` gains `branchName`; `SessionPatch` gains the six columns
  T2 and T4 will write.
- **The `integrationBranch` backfill, and why it is not a D-number.** Migration 4 sets
  `integrationBranch = 'develop'` on existing `Project` rows rather than leaving them `NULL`. D38
  already decided the fallback chain **ends** at `integrationBranch`; a `NULL` there gives the chain
  no terminus, so every existing task would refuse at precondition 5 the moment T1 lands. The
  backfill is *how an existing row acquires the terminus D38 specified*, not a new choice about what
  the terminus is. **AC-13 is asserted with that one column exempted** — its value is asserted as
  `'develop'`, every other new column as `NULL`. Say so in the migration's own comment. If you
  conclude this *is* a decision rather than an implementation of one, **stop and raise it** rather
  than picking either way.
- `lib/agentos/types.ts` — the new fields on `ProjectRow`, `TaskRow`, `SessionRow`.
- `lib/agentos/slug.ts` (new, **leaf — pure, no imports beyond types**) — `slugify(name)` exactly as
  §3.3 specifies (lowercase, non-`[a-z0-9]` runs → single `-`, strip leading/trailing `-`, truncate
  to 40 at a `-` boundary, empty → the literal `task`) and `sessionBranchName(name, sessionId)` →
  `agentos/<slug>-<first 8 of sessionId>`. Pure so AC-15's first half asserts it without git.
- `lib/agentos/worktree.ts` — the **optional trailing branch parameter** (inherited fact 3):
  `{ name: string; mode: 'create' | 'attach' }`, absent → today's `--detach`. `create` →
  `worktree add -b <name> <path> <sha>`; `attach` → `worktree add <path> <name>`. Plus an exported
  `deleteBranch(wt, name)` for §3.4's empty-run delete. `withWorktree` gains the same optional
  passthrough and stays otherwise untouched.
- `lib/agentos/dispatch.ts` — three changes and no others. (1) **Base ref resolution** replacing the
  `BASE_REF = "HEAD"` constant: `task.baseRef ?? project.defaultBaseRef ?? project.integrationBranch`,
  resolved by the existing precondition-5 `rev-parse` so an unresolvable one refuses loudly. Put the
  chain itself in a **pure exported function** so AC-3 asserts it without spawning anything.
  (2) **The branch at spawn** — name it from `slug.ts`, pass `mode: 'create'`, store it on the
  `Session` row. (3) **`resumeSession` attaches** — same branch name off the session row, `mode:
  'attach'`, never `create` (§3.2's second half; AC-14 is the `[G]`).
- **The empty-run delete, and the one path that must not do it.** In `runSessionToCompletion`, the
  already-read `commitShas` list decides: empty → `deleteBranch` after teardown. **The
  `waiting-inbox` early-return path must not delete**, because that session is paused and
  `resumeSession` will attach to exactly that branch — and it returns before commits are read at
  all, so there is no list to decide from. Never a second `git log` after the worktree is gone
  (§3.4's ordering trap, which is §3.2's from a different direction).
- `app/p/[slug]/[tab]/actions.ts` — `createTaskForSlug` reads an optional `baseRef` form field.
  **The normalisation is a pure function in `lib/`** (blank/whitespace → `null`), not an inline
  ternary in the action, so the suite asserts it.
- `components/tasks/TaskDrawer.tsx` — the optional field, labelled so a human knows blank means the
  project default.
- `scripts/verify-stage4b.mts` (new), `package.json` (the `verify:stage4b` key, inserted).

**Must not touch:** migrations 1, 2 and 3; `config.ts` (T2's); any `verify-*.mts` other than the new
one; `lib/shell/model.ts`; anything under `lib/collectors/`.

**The checks:**
- **AC-0a — the suite runs and the seams are wired.** A fixture repo, a fixture db at migration 4,
  and a `FakeRunner` scripted to commit; one end-to-end dispatch settles. Structural, so a broken
  harness fails here rather than inside AC-1.
- **AC-1 — the work is on a ref**, asserted **after** `removeWorktree` (before it, a detached HEAD
  would pass too).
- **AC-2 — an empty run leaves no ref**, and `git worktree list` shows no stale entry.
- **AC-3 `[G]` — the base is declared.** Checkout on `X`, task's `baseRef` naming `Y`, worktree's
  base sha is `Y`'s. Revert to `HEAD`, observe red, revert back.
- **AC-4 — stacking works.** B's `baseRef` names A's branch; B's worktree contains A's commit and
  B's own `<base>..HEAD` range excludes it.
- **AC-13 — migration 4 is additive.** Against a db holding Stage 3 **and** Stage 4 rows: every
  existing row byte-identical, new columns `NULL` (except `integrationBranch`, asserted `'develop'`
  — see the backfill note), and migrating twice is a no-op landing `user_version` on 4.
- **AC-14 `[G]` — a resume attaches and keeps the paused turn's commit.** `FakeRunner` commits then
  pauses via `inbox_ask`; answer it; the resumed worktree is on the **same** branch, `worktree add`
  did not fail, and the first turn's commit is reachable. Make the resume pass `create`, observe
  red, revert. **This is the check the whole of §3.2's second half exists for.**
- **AC-15 — a hostile name still produces a legal ref.** `  ~~Fix: the *thing* (again)!!  ` yields a
  branch `git check-ref-format --branch` accepts; a name with no `[a-z0-9]` yields
  `agentos/task-<short>`. Asserted against pure `slugify`, and **once end-to-end against real git**.

**Done criteria:** `pnpm verify:stage4b` green; `pnpm verify` no new red **compared per-suite**, not
by total — the *Verified state* block records that total moving for reasons unrelated to any branch.
Both `[G]`s proven red and reverted.

**Hand-off to T2:** every column exists, both worktree paths carry a branch, the base ref resolves
through a pure function T2 can call, and the suite has a fixture harness (repo + bare remote + db)
T2 extends. `command.ts` does not exist yet — T2 creates it.

---

## T2 — prepare, verify, and the four config keys

**Branch:** `feat/stage-4b-t2-prepare` off `feat/stage-4b-t1-branch`.
**Closes:** AC-5, AC-6, AC-7, AC-16.

**Owns:**
- `lib/agentos/command.ts` (new) — `runCommand(argv, cwd, timeoutMs)` → `{ exitCode, stdout,
  stderr, timedOut, durationMs }`. **Never reuse `run()` from `lib/collectors/exec.ts` here** and do
  not change it: it returns `string | null`, discards the exit code and stderr, and defaults to 15
  seconds (§1 item 7). `run()` stays exactly as it is for every git call, including T1's.
  Default timeout **300000**; argv, never a shell string.
- `lib/agentos/config.ts` — all four keys (`integrationBranch`, `defaultBaseRef`, `prepare`,
  `verify`), each optional with a stated default, each malformed value a refusal carrying the
  parser's own message. **`main` and `master` are refused for `integrationBranch`**, naming the
  workflow rule (§3.8). A command value must be a non-empty array of strings — a bare string is a
  refusal that says so, because §3.5's whole point is that it would otherwise be looked up as an
  executable with a space in its name.
- `app/p/[slug]/[tab]/actions.ts` — `initializeProject` persists `integrationBranch` and
  `defaultBaseRef` onto the `Project` row. **All-or-nothing**, the shape initialize already uses:
  AC-16 asserts **no `Project` row is created** when the yaml names `main`.
- `lib/agentos/dispatch.ts` — the pre-run gate on **both** paths. In `dispatch`, after the worktree
  exists and **before** the model call: run `prepare:`; non-zero or timed out → `started: false`
  naming the command and its exit code, **no `Session` row, worktree removed, and the branch
  deleted** (AC-6's last clause — T1 created the branch before prepare ran, so a refusal here would
  otherwise strand an empty `agentos/*` ref on every failed preparation). In `resumeSession`, the
  same gate on the fresh worktree — a resumed turn otherwise reaches the model with no dependencies
  at all (§1 item 3). Then, after the model call settles and **before** teardown: run `verify:`,
  record `verifyExitCode` and the **last 40 lines** as `verifyTail`.
- **Absent key → skipped, and the exit code stays `null`.** Never `0`. `0` is a claim that something
  ran and passed (§3.5).
- **Verification failing does not fail the session** (§3.6). `Session.status` reports what the run
  did; `verifyExitCode` reports what the code does. Neither hides the other — the same shape as the
  teardown-failure rule already in this file.
- `scripts/verify-stage4b.mts` — adds AC-5, AC-6, AC-7, AC-16.

**May touch:** `lib/agentos/types.ts` — the parsed-config types only.

**Must not touch:** any migration; `worktree.ts`; `slug.ts`; `lib/collectors/exec.ts`; any component.

**The checks:**
- **AC-5 — prepare runs first**, asserted **from inside the `FakeRunner`'s own callback**. Afterwards
  cannot distinguish "before the model" from "after".
- **AC-6 — a failed prepare refuses and leaves nothing behind.** `["sh","-c","exit 3"]` → `started:
  false` naming the command and exit code, `SELECT count(*) FROM Session` unchanged, worktree gone,
  **and the branch gone.**
- **AC-7 — verification is measured, not reported.** `verify:` exits 1 while the `FakeRunner`
  announces success: `verifyExitCode = 1`, `verifyTail` non-empty, `Session.status = 'completed'`.
  **The session's own account changes nothing** — that is the product in one check.
- **AC-16 — `main` is refused.** `integrationBranch: main` fails to parse, the error names the
  workflow rule, no `Project` row is created. Same for `master`.

**Hand-off to T3:** a session row now carries prepare and verify evidence, and the config supplies
the branch names. T3 composes strings from all of it and spawns nothing.

---

## T3 — the preamble and the PR body

**Branch:** `feat/stage-4b-t3-compose` off `feat/stage-4b-t2-prepare`.
**Closes:** AC-8, AC-10, AC-12.

**The short ticket, and the one that keeps the other three honest.** Everything it owns is a pure
function in a leaf module, so three of the stage's user-visible strings are asserted without a
worktree, a remote or a model.

**Owns:**
- `lib/agentos/delivery-render.ts` (new, **leaf — no `db`, no `node:*`**, inherited fact 7):
  - `composePreamble(...)` → the block that precedes the task's own text: worktree path, branch,
    resolved base sha, the prepare and verify commands, *commit your work before you finish or
    stop*, and *this directory is destroyed when this session ends*. **Composed from what the code
    already holds, never a config field** (§3.7) — two strings that must agree are a second source
    of truth wearing a justification, which is D36's reasoning one level down.
  - `composePrBody(...)` → session id, cost, `driftAtSpawn`, every commit sha, verify exit code.
  - `pushControlLabel(branch, base)` → `Push \`agentos/…\` & open PR → develop`. Never "Ship".
- `lib/agentos/dispatch.ts` — **one line**: the prompt becomes `composePreamble(...) + task text`,
  replacing the current `Task: ${name}\n\n${description}`. Nothing else in that file.
- `scripts/verify-stage4b.mts` — adds AC-8, AC-10, AC-12.

**Must not touch:** anything else. If this ticket grows a second file outside the suite, it has
absorbed T4's work.

**The checks:** AC-8 (branch, base sha, worktree path, the commit sentence — on the composed
string), AC-10 (every evidence field — on the composed body, **so no PR need be created**), AC-12
(the label contains the branch name and the base branch).

---

## T4 — push, the PR, the UI, and the stage

**Branch:** `feat/stage-4b-t4-push` off `feat/stage-4b-t3-compose`.
**Closes:** AC-9, AC-11. Ships the stage.

**Owns:**
- `lib/agentos/push.ts` (new) — `pushAndOpenPr({ db, sessionId, confirmDespiteVerifyFailure, gh })`.
  One gesture: `git push -u origin <branch>` via `run()`, then `gh pr create --base
  <integrationBranch> --head <branch>` via the **injected invoker** (argv in, stdout out — so the
  argv is itself assertable, which is how AC-11's *never merges* becomes checkable behaviour and not
  only a grep), then store `prUrl` and `pushedAtISO`.
  **Refusals, each naming its reason:** no branch; no commits; the session is not settled; already
  pushed; `verifyExitCode` non-zero **unless the confirm flag is set in the same gesture**, and that
  refusal names the failing command.
- `app/p/[slug]/[tab]/actions.ts` — the server action, with a hostile ownership check through
  `resolveOwnedTask` (db threaded).
- `app/p/[slug]/[tab]/[id]/page.tsx` and a client component — the control on the session card of a
  **settled** session that has a branch and at least one commit. Label from T3's
  `pushControlLabel`; the client component imports the action and pure helpers only (inherited
  fact 7).
- `scripts/verify-stage4b.mts` — adds AC-9 and AC-11.
- **Docs, in this same PR** (`CLAUDE.md`'s session-end ritual — never a separate docs commit):
  - `docs/HANDOFF.md` — where things stand, and **AC-17 written in as an open owner gate the day
    this stage lands**, not the day someone notices. Also refresh the *Verified state* block's suite
    rows on the branch this ships in, and say which branch they were measured on.
  - `docs/FEATURES.md` — §2's twelve behaviour rows.
  - `docs/BACKLOG.md` — the deferrals spec §1 names, each with an unblock condition: a supervisor so
    a session survives a dev-server restart (D20's cloud runner); branch cleanup after a PR merges
    (**listing `agentos/*` and checking each name's session id against the `Session` table — never a
    wildcard delete**, §3.3); non-primary repos; caching `node_modules` between sessions.
  - `docs/LEARNINGS.md` — anything found by building that the next session must not re-buy.
  - `docs/DECISIONS.md` — only if a genuinely new decision was closed (D44+). D37–D41 are already
    there; do not restate them.

**The checks:**
- **AC-9 — push and PR, on the gesture and only on it.** Against the bare-repo remote: before the
  click `git ls-remote` shows no such ref and `prUrl` is null; after it the ref exists and `prUrl`
  is stored. **And** a session with `verifyExitCode` non-zero refuses unless confirmed, naming the
  failing command.
- **AC-11 — the product cannot merge.** `gh pr merge` and `git merge` appear in no file under
  `lib/` or `app/`. Deliberately crude, and inherited fact 5 says it is clean at the base, so a
  failure here means **this stage** introduced it.

**Done criteria:** `pnpm verify:stage4b` green; `pnpm verify` no new red per-suite; the paired docs
updated in the same PR; `pnpm build` clean.

**What T4 does not close, and must say so out loud.** **AC-17 is an owner gate and no fixture can
close it** — *one real branch, pushed, with a real PR opened, reviewed by a human, and merged by the
owner.* Every check above runs against a bare repo in a temp dir. Until a PR exists on GitHub that
this product opened, the last mile is unproven code, and the PR body for T4 must say that in those
terms rather than reporting the stage as finished. It joins Stage 2's *one real drift corrected* and
Stage 3b's *no human has run the cycle by hand* — reproduce its state with
`gh pr list --state all --search "head:agentos/"`, and record it in `docs/HANDOFF.md`, never here.
