# Stage 3 — build tickets

> **Subordinate to [`stage-3-execution-mvp.spec.md`](stage-3-execution-mvp.spec.md).** This file
> adds **sequencing, file ownership and hand-off contracts** and nothing else. Where a ticket and
> the spec disagree, **the spec wins** — and that is a bug in this file, worth fixing rather than
> working around.
>
> **It deliberately does not restate the spec.** A ticket that copied §3.5's inbox reasoning would
> be a second source of truth about the design, which is the failure this whole product exists to
> detect (invariant 5). Every ticket names the sections to read; read them.
>
> **Status:** all decisions closed. The spec is `☑` since **D27** cleared its last two gates.

## How to work a ticket

1. **Read the named spec sections in full before writing code.** They are short, and the design
   decisions in them are not derivable from the ticket.
2. **Write the named acceptance checks first**, then the code that makes them pass. `scripts/`
   already holds three suites in this style — copy their shape (`verify-stage2.mts` is the closest
   model: fixture repos in a temp dir, a `check(id, ok, detail)` helper, non-zero exit).
3. **Touch only the files in *May touch*.** If the work seems to require another file, that is a
   finding — stop and report it rather than widening the blast radius.
4. **Run `pnpm verify` before declaring done.** It runs every suite. The Stage 1 **AC-2** failure is
   known and logged (`docs/BACKLOG.md`); **everything else must be green**, including all of Stage
   2 and Stage 3a. If a previously-passing check goes red, that is the ticket's problem.
5. **Do not commit to a shared branch, do not merge, do not open a PR, do not push.** Leave the work
   in place and report what you did. `CLAUDE.md`: *the agent never merges.*
6. **If a decision surfaces that the spec does not close, stop and report it.** Do not decide it.
   That gate is the point of the whole process.

## Standing constraints (all tickets)

- **No network and no model calls in anything `pnpm verify` runs**, and no writes outside this
  repo. Every default test runs against generated fixtures in a temp dir. **No test may touch a
  watched project** — Stage 2's suite establishes the pattern and the reason.
  **The one exception is T6's AC-12**, which spawns a genuine session behind an env flag and is
  deliberately excluded from the default run. It is the only proof the other eighteen checks are
  testing something real (spec §4), which is why it exists — and why it must never be reachable by
  `pnpm verify`.
- **`lib/reconcile/` must never import `lib/agentos/`.** D19 makes the layer boundary an enforcement
  boundary. The reverse direction is permitted and is used deliberately (spec §7.5).
- **No ORM.** **Eight** tables, plain SQL (spec §3.7 and §6.1). *Said "nine" until 2026-08-18; the schema block has always had eight.*
- **Interpolate complete strings in JSX** — `CLAUDE.md` §Conventions; this bug has shipped twice.
- Dates in docs and comments are absolute (`2026-08-18`), never "today".

---

## T1 — SQLite schema and the data layer

**Spec:** §3.7 (schema), §5.4 (why a separate file from D3's cache), §6.1.
**Depends on:** nothing. **May run in parallel with T2.**

**May touch:** `lib/agentos/db.ts`, `lib/agentos/types.ts`, `.gitignore`.
**Must not touch:** anything under `lib/reconcile/`, `lib/fix/`, `app/`, `components/`.

**Build:** the eight tables of §3.7 with migrations, at `data/agentos.sqlite`, **gitignored**.
Expose typed accessors — **including exactly one `createSession()`**, which is the only function in
the system permitted to insert a `Session` row (T5's AC-14 asserts nothing else imports it).

**Traps.**
- `TaskEvent` columns are **`fromStatus` / `toStatus`**, never `from` / `to` — both are SQL
  reserved words. This was caught in review; do not "simplify" it back.
- Columns ending `Json` store JSON text and are parsed at the edge, not stored as objects.
- `Task.blockedReason` is a **label on a card**, not a fifth column (§7.6).
- **This is not D3's transcript cache.** Different file, different lifetime, deliberately (§5.4).

**Done when:** `pnpm type-check` is clean, a migration creates every table on a fresh file, and
`createSession` is the sole insert path for `Session`.

---

## T2 — The ephemeral git worktree

**Spec:** §3.2 (lifecycle and the four properties), §5.3, §5.6 (what isolation is *not* claimed),
§6.2. **Depends on:** nothing. **May run in parallel with T1.**

**May touch:** `lib/agentos/worktree.ts`, `scripts/verify-stage3.mts` (create it; AC-2 and AC-9
only), `package.json` (add `verify:stage3`; **append to `verify`, do not replace it**).
**Must not touch:** `lib/agentos/db.ts` (T1 owns it), any UI.

**Build:** create and tear down a detached worktree per session, per §3.2's four-line lifecycle.
**Write AC-2 and AC-9 first** — §6.2 says so, and this is the ticket that touches a real git repo.

**Traps.**
- **Read commit shas *before* teardown**, from `git log <baseRef>..HEAD` in the worktree. After
  `worktree remove` there is nothing to read.
- **`--force` on removal is deliberate** (§3.2): a failed run leaves a dirty worktree, and refusing
  to clean up after exactly the runs most likely to need it is the wrong default.
- Teardown must run on the failure path too. AC-9 is the check that catches a `try` with no
  `finally`.
- Do **not** claim isolation this does not provide — §5.6. A local process can read outside its
  `cwd`, and `docs/FEATURES.md` must say so under *Known gaps* when this ships.

**Done when:** AC-2 and AC-9 pass against a generated fixture repo, `git worktree list` is clean
afterwards, and no watched project was touched.

---

## T3 — The `Runner` interface, `LocalRunner`, and the scripted fake

**Spec:** §3.1 (the **verified** SDK surface — the table *and* the three findings under it), §5.2,
§5.7, §5.10, §6.3, §9 (seams). **Depends on:** T1, T2.

**May touch:** `lib/agentos/runner/*`. **Must not touch:** `lib/agentos/dispatch.ts` (T5).

**Build:** the `Runner` interface, a `LocalRunner` over `@anthropic-ai/claude-agent-sdk`, and the
**scripted fake** that emits a chosen `SDKMessage` sequence. §6.3: *the fake is not a test detail —
it is what makes eleven of the checks runnable at all.*

**Traps.**
- **`strictMcpConfig: true` is mandatory.** Omit it and the agent silently inherits the owner's own
  authenticated MCP servers (§3.1b). AC-13 asserts it.
- **A single-shot `query()` throws *after* yielding its error result** (§3.1c). Capture as you
  iterate; a `try` that treats `catch` as "nothing happened" discards a real session and a real
  charge.
- `WebFetch` / `WebSearch` are **not** in the MVP agent's `allowedTools` (§5.7).
- Model is `claude-opus-5` (§5.10). Do not substitute.
- **Verify the SDK surface against the installed package** before using anything not in §3.1's
  table. That table was fetched from documentation on 2026-08-15; the standing rule is
  `external-API-fields-are-guilty-until-verified`.

**Done when:** the fake drives a full session end-to-end in a test, and `LocalRunner` type-checks
against the real SDK without being called.

---

## T4 — The two in-process MCP servers, and the gate

**Spec:** §3.3, §3.4 (**the gate, in two layers**), §3.5 (**read before designing `inbox.ask`**),
§5.8, §6.4. **Depends on:** T1, T3.

**May touch:** `lib/agentos/mcp/*`. **Must not touch:** `lib/agentos/dispatch.ts` (T5).

**Build:** `agentos` (`task.read`, `task.update_status`, `task.append_activity`) and `inbox`
(`inbox.ask`), both via `createSdkMcpServer`, both **constructed per session** and closing over that
session's id and task id.

**Traps.**
- **These tools take no task id.** The object they can act on is fixed at spawn — *a guard must
  derive its bounds independently of its input* (`docs/LEARNINGS.md`, learned the hard way in
  Stage 2).
- **The gate is two layers and the test asserts the second one** (§3.4). `canUseTool` is the cheap
  first pass; the handler refuses regardless of what let the call through. AC-5 asserts **which
  layer refused** — not merely that something did.
- **`inbox.ask` returns immediately and ends the turn** (§3.5 design B). Blocking inside the handler
  is less code and is **wrong**; §3.5 says why in three sentences. Read them.
- **`inbox.send` does not exist** (§5.8). A tool that cannot be misused beats an instruction not to
  misuse it.

**Done when:** AC-4 and AC-5 pass, including the human-vs-session attribution, and the refusal
records a reason on the session.

---

## T5 — `dispatch()` and the boot sweep

**Spec:** **§7 in full** — it is the section people assume the Kanban implies — plus **D24**.
**Depends on:** T1, T2, T3, T4.

**May touch:** `lib/agentos/dispatch.ts`, `lib/agentos/sweep.ts`.

**Build:** the single funnel of §7.2, the five preconditions of §7.3, the request/run split of §7.4,
the state machine of §7.6, and the boot sweep of §7.7.

**Traps.**
- **This is the only door to a session.** AC-14 asserts `createSession` and `runner.run` are each
  imported by exactly one module — this one.
- **A refusal writes nothing** — no `Session`, no `TaskEvent` — and returns a reason the UI renders
  verbatim. AC-15 asserts **which** precondition refused.
- **A null `assigneeAgentId` means human-only and is refused** (§7.1, §7.3 precondition 4). It is
  never defaulted at dispatch; defaulting happens at task creation. Getting this wrong runs a human
  review step under an agent.
- **A second dispatch is refused, not queued** (§5.14). Queueing needs a scheduler; D24 declined to
  build one.
- **Every session records `driftAtSpawnJson`** (§7.5) — including for an in-sync project, where it
  records the in-sync state rather than `null` (AC-17). This crosses the layer boundary in the
  **permitted** direction: execution reads the portfolio, never the reverse.
- **`waiting-inbox` sessions are swept too** (§7.7). Key the sweep on the session having no live
  owner, not on status alone.

**Done when:** AC-14 through AC-19 pass, and `pnpm verify` is green apart from Stage 1 AC-2.

---

## T6 — The acceptance suite, completed

**Spec:** §4 (all of AC-1…AC-19), §9. **Depends on:** T1–T5.

**May touch:** `scripts/verify-stage3.mts`, fixture helpers.

**Build:** every remaining check. AC-12 (one real session, opt-in behind an env flag) is written but
**not** added to `pnpm verify` — it costs money and needs the network. §4: *it is the only proof the
other eighteen are testing something real, and skipping it forever is how a green suite starts
lying.*

**Traps.** Assert **which** guard or precondition fired, never merely that something did — Stage 2
lost a whole build to a test that only checked *that* a write was refused. AC-17's in-sync case must
assert a recorded in-sync state, not the absence of a record.

**Done when:** AC-1…AC-19 pass; AC-12 exists, is documented, and is excluded from the default run.

---

## T7 — UI: the Tasks board, the session view, the inbox

**Spec:** §8 (the whole surface), §2's behaviour rows, **D23** for the shell it mounts into.
**Depends on:** T1–T6, **and on Stage 3a being merged** (`feat/stage-3a-shell`, PR #11) — the routes
`/p/<slug>/<tab>` and the shell chrome already exist and must be reused, never re-created.

**May touch:** `app/p/[slug]/[tab]/`, `components/tasks/*`, a new CSS Module.
**Must not touch:** `app/board.css`, `app/page.tsx`, `components/board/*`, `lib/fix/*` — the Board
is a shipped surface and Stage 3a's AC-1 (the suite result is unchanged) still applies.

**Traps.**
- **A `todo` card renders no evidence line at all** (§8.3). Not an empty one — nothing has happened,
  and a placeholder would be a claim about a run that does not exist.
- **Executed vs hand-moved must differ before either is read**: `▶` + mono + session id + sha,
  versus quoted italic naming a person.
- **No motion on a running card** (§8.6). The running item is the one you are allowed to ignore.
- **Dragging a gated card to `done` is refused with the same reason string the API returns** —
  one reason, one source. If drag makes that awkward, drop drag.
- Column counts are plain mono numerals, no pill (§8.5).
- Follow the shell's conventions: pure logic in `lib/`, dumb components, CSS Modules, and read the
  Board through `boardOnce` if you need it at all.

**Done when:** the board renders every card state against fixture data, and `pnpm verify` is green
apart from Stage 1 AC-2.

---

## Wave plan

| Wave | Tickets | Why together |
|---|---|---|
| **1** | **T1, T2** | Genuinely independent — disjoint files, no shared types. Parallel. |
| 2 | T3, then T4 | Both need T1; T4 needs T3's message types. |
| 3 | T5 | Needs all four. The smallest and most consequential file in the slice. |
| 4 | T6, T7 | T7 also waits on PR #11 merging. |
