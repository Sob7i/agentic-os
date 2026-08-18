# Agentic OS — Session Handoff

> Continuation notes for the next working session (human or agent). Updated **2026-08-18**
> (round-3 design closed; the Tasks surface and the dispatch model specced).
> Read `CLAUDE.md` first (session ritual, conventions, doc map); this file is only "where we
> are and what's next."
>
> **Trust but verify:** this file can go stale between sessions — merged PRs, pushed commits, or
> a changed remote don't announce themselves here. Cross-check `git status`, `git log`, and
> `gh pr list` before acting on anything below as fact. *This project exists because that
> failure is real; do not be its next example.* **You can now also just run the app** — it
> checks this project too.

## Verified state

> **The volatile facts live only here, and every one of them rots.** Each row names the command
> that reproduces it, so nothing below has to be believed. **Nothing else in this file, in
> `CLAUDE.md`, or in any spec may restate these values** — link to this block instead. That rule
> exists because "PR #6 is open" survived in three places across two files for three days after #6
> merged; one place to update is one place to check.
>
> **Two rows deliberately hold no value.** *Live board severities* was the original instance of the
> compute-or-omit rule. *Open PRs* joined it after a reviewer pointed out that **this file ships
> inside a pull request** — so any value it states is falsified by the act of stating it, and
> "none" was already wrong by the time the PR recording it existed. A fact that its own recording
> changes cannot be recorded; it can only be reproduced.
>
> **Checked 2026-08-18.** If today is much later than that, this table is a hypothesis.

| Fact | When checked | Reproduce with |
|---|---|---|
| `develop` head | `081ae34` | `git log --oneline -1 origin/develop` |
| Open PRs | **not recorded — run the command** | `gh pr list` |
| Last merged | #6, #7, #8 — all 2026-08-15 | `gh pr list --state merged --limit 5` |
| `pnpm verify` | **18 of 19** | `pnpm verify` |
| — the one failure | Stage 1 **AC-2** | see "Where things stand" for why it is not a bug |
| `pnpm verify:stage2` | 11 of 11 | `pnpm verify:stage2` |
| nadim's drift | **uncorrected** (AC-1 still passes) | `pnpm verify:stage1` |
| Live board severities | **not recorded, by rule** | `pnpm dev` |

## Where things stand

- **⚠ The product was re-scoped on 2026-08-15 — read `docs/PRD.md` §12 before planning anything.**
  Agentic OS is now **two layers**: the portfolio (Board + Overview, read-only, what exists today)
  and a new per-project, opt-in **execution layer** adapted from
  [`docs/specs/AgentOS-spec.md`](specs/AgentOS-spec.md) — tasks, goals, inbox, sessions, costs,
  with agents and templates as configuration. **Nothing of it is built.** Decisions D18–D22 are
  closed; the build order in PRD §10 was renumbered and old Stage 3 (Overview) moved to Stage 6.
- **Stage 2 is merged; its acceptance criterion is still unmet.** The code and the re-scope docs
  are in. But Stage 2's own criterion — *one real drift corrected through the dashboard* — **has
  never been met**: nadim's HANDOFF still claims *"PRs #1 through #22 merged"* and no proposal has
  ever been approved. That is an owner gate, and merging the PR did not clear it. (State: the
  Verified state block above.)
- **Round-3 design is delivered and the shell is closed.** [`design/wireframes2.pen`](../design/wireframes2.pen)
  holds 19 frames and six rationale notes. **D23** picks **Concept B′** (mode switch + a persistent
  portfolio ribbon + a drift band that appears only when *this* project has drifted) over the design
  agent's own recommendation of Concept C, and says why. **D24** closes the execution motor: work is
  **dispatched, never picked up**. The Stage 3 spec gained **§7 (the motor)** and **§8 (the Tasks
  surface)**, plus AC-14…AC-19 and decisions 13–18.
- **⚠ `pnpm verify` is RED, and the code is correct.** Stage 1's **AC-2 fails**: it asserts
  *"itqan is green"* by name, and itqan has not committed since 2026-07-21, so DC7 rightly reports
  it stalled. The test hardcoded a time-dependent fact about a live repo. **Fixing it amends a PRD
  acceptance criterion**, so it is logged as blocking in `docs/BACKLOG.md` with two readings and a
  recommendation, rather than edited silently. Counts are in the Verified state block above.
- **Stage 2 ships: the gate is live.** The Board now offers a correction on DC1 drift and writes
  it only on an explicit click. `pnpm verify` runs **both** suites. Stage 2's tests run entirely
  against generated fixture repos in a temp dir; no watched project is written to by a test.
- **The write path, in order:** `lib/fix/propose.ts` (pure, reads only) → `lib/fix/apply.ts`
  (four guards, all-or-nothing) → `app/actions.ts` (rebuilds the proposal server-side from the
  claim hash — the browser never names a path or supplies bytes) → the card UI in `app/page.tsx`.
- **Nothing has actually been approved yet.** All four UI states were rendered against live data,
  but no watched repo has been corrected through the button — that is an owner gate. nadim's
  `#22` → `#23` proposal is sitting on the Board waiting. **Re-verified 2026-08-18**: still true.
- **Stage 1 still ships: the reconciliation Board runs.** `pnpm install && pnpm dev` → the Board
  at `localhost:3000` (`:3001` if the port is busy).
- **It found the drift it was built to find, unaided.** nadim's HANDOFF claims *"PRs #1 through
  #22 merged"*; the Board reports `#23 is merged (1 past the claim); unclaimed open: #24`, and
  cites `docs/HANDOFF.md` as the source.
- **Live board state is not recorded here — run the app.** This bullet used to list all six
  severities as of 2026-07-27, and by 2026-08-15 at least one had moved (itqan `✓ in sync` →
  `○ attention`, which is the whole AC-2 story). **`docs/LEARNINGS.md` already forbids exactly
  this** — *live facts must never be hardcoded in a document; compute them or omit them.* Omitted
  rather than refreshed, because refreshing only resets the clock. **This bullet is the precedent
  the Verified state block generalises**: the rule was right and applying it one bullet at a time
  was the mistake.
- **Built:** collectors (`git`, `github`, `itqan-docs`), checks DC1–DC8, the Board UI per
  Concept C, degraded states, and `scripts/verify-acceptance.mts`.
- **D14 closed mid-build** — DC4 (uncommitted work) needed a threshold. Without one every
  project was permanently non-green and `✓ in sync` could never render, failing AC-2. Default 5,
  configurable per project.
- **Building it found something the wireframe got wrong.** `Fix Proposal v2` draws nadim's claim
  on `line 24` as a tidy snippet; it is really on **line 15**, inside a ~600-character bullet, so
  the live diff wraps to a paragraph. The design's *structure* held — full line, amber-flagged
  date — but its content was a reconstruction → `docs/BACKLOG.md`, `docs/LEARNINGS.md`.
- **The superseded `Fix Proposal` frame is renamed** to `SUPERSEDED (round 1) — … do not build`,
  closing the round-2 review's one blocking item.
- **Round-2 designs delivered, reviewed, and now partly consumed.** Overview direction is closed
  as **D16** (Concept A, tabbed/by-band, plus Concept B's "blocked on you" spotlight band).
- **All product decisions closed** — `docs/DECISIONS.md` **D1–D25**. The newest are D23 (the
  shell), D24 (dispatch, never pull) and **D25** (a DoD item carries the *kind* of evidence that
  closed it — which supersedes what frame `G1` drew); D18–D22 are the re-scope.

## How to pick up

1. `git status && git log --oneline -5 && gh pr list` — verify this file against reality.
2. `pnpm install && pnpm verify` — compare against the **Verified state** block, and expect Stage
   1's **AC-2 to fail** for the reason above. That is a known, logged, blocking item — not a regression you introduced, and not
   something to "fix" by editing the check before reading `docs/BACKLOG.md`. If **AC-1** also fails,
   that is **good news**: it means nadim's HANDOFF was corrected. Update the acceptance fixture
   rather than the check.
3. `pnpm dev` → read the Board. It includes itself, and nadim's card carries a live proposal.
4. `pnpm type-check` and `pnpm build` both clean as of this commit.

## Next up

1. **Approve nadim's proposal once, by hand** (owner gate). With Stage 2 merged this is the
   *only* thing separating "eleven fixture tests pass" from "this has corrected a real document",
   and it should happen *before* the execution layer starts, so the pivot begins from a closed
   stage rather than an open one. Afterwards the card should read `✎ written · awaiting re-check`
   with git's own porcelain beneath it, and the next reload should decide for itself whether the
   drift is gone. Undo is `git checkout -- docs/HANDOFF.md docs/LEARNINGS.md` in nadim.
2. **Clear the two gates on the Stage 3 spec** — `docs/specs/stage-3-execution-mvp.spec.md` is
   `☐` and now blocked on **nothing but** §5.11 (which watched repo the first sessions target —
   recommendation `fractal-code`) and §5.12 (whether the MVP agent may commit at all —
   recommendation: ship the capability, default the seeded agent to `canCommit: false`). Both are
   owner calls because both end in a write to someone's repo. Answering them flips the glyph to `☑`.
   Everything else in §5, including the shell (D23) and the dispatch model (D24), is closed.
3. **Specs for Stages 4 and 5 are written** —
   [`stage-4-templates-chains.spec.md`](specs/stage-4-templates-chains.spec.md) is **`☑`
   buildable** (no owner gate; it is sequenced behind Stage 3), and
   [`stage-5-goals.spec.md`](specs/stage-5-goals.spec.md) is **`☐`**, gated on one owner call in
   its §5.11 — the default spend cap, and whether a goal may spawn unattended before the loop has
   been watched once. Stage 6 (the rewritten Overview) and Stage 7 (portfolio cost) are **not**
   specced yet, deliberately: both read data that Stages 3–5 produce, and speccing them now would
   be guessing at shapes that do not exist.
4. **Build Stage 3.** Build order is in the spec's §6 — now seven items, with
   `lib/agentos/dispatch.ts` added as **5**. Risk is concentrated in the first three (schema,
   worktree, runner-plus-fake) and in dispatch, which is small but is the only door to a session;
   the acceptance suite goes in before the UI, exactly as Stage 2 did. Then Stage 4 templates →
   Stage 5 goals → Stage 6 the rewritten Overview → Stage 7 portfolio cost. PRD §10 has the
   acceptance criterion for each.
5. **Commit `design/wireframes2.pen`** — it arrived untracked, and there is a stray
   `pencil-new.pen` (1 MB) at the repo root, which is the same autosave pattern `docs/BACKLOG.md`
   already recorded once. Decide whether it is a design artefact or debris before the next commit.

- **2026-08-18** — Round-3 wireframes reviewed and the shell closed as **D23**: Concept B′ over
  the design agent's own recommendation of C, because the Kanban is the surface this product will be
  used in for hours and C spends 268px of it permanently on five projects you are not working on.
  **One amendment to the owner's instruction, stated rather than applied silently:** the drift band
  is conditional as asked, but the *ribbon* stays always-present — a ribbon that appears only on
  drift makes its own absence an unsourced claim, which is invariant 2 and the exact distinction
  Stage 1 already ships (*"nothing to check" vs "checked and fine"*). **D24** closed the motor:
  work is dispatched through one funnel, never picked up by a scanner — the largest deliberate
  divergence from AgentOS-spec §9.4, on the grounds that a process which finds work and starts it is
  PRD §12.1's failure mode automated. **Found stale on arrival:** this file still said PR #6 was
  open; all three PRs had merged three days earlier. Also evaluated `/to-spec` and declined it —
  `docs/LEARNINGS.md`.

- **2026-08-18 (later)** — Stage 4 and Stage 5 specced. Stage 5 surfaced **D25**, which changes
  what the design drew: frame `G1` renders a met Definition-of-Done item with `▶ s_… · sha`, the
  glyph D22 reserves for *"a session produced this and here is the commit that proves it"* — but the
  session produced the **work**, while the judgement that the work satisfies the item is a model
  reading a log. That is the claim-as-fact collapse this product exists to prevent, on the one
  screen that decides whether to keep spending. Split into `command` / `judged` / `human`, which
  also makes writing a DoD an exercise in *"how would I know?"*. **Also restructured `HANDOFF.md`**
  so volatile facts live in one *Verified state* block — see below.

**Deliberately not next:** the Overview as previously specced (cancelled by D22 — it must read the
execution layer's tasks and goals, which do not exist yet), and everything in PRD §12.7.

**One thing to keep honest.** PRD §11.3 contains a standing instruction written before enthusiasm:
*if the Board is not opened daily within two weeks of Stage 2, the premise was wrong — record it
and stop.* Stage 2 is not merged and that clock has not meaningfully started. The re-scope does
not void that instruction; it makes it easier to forget.

## Blockers

None.

## Session log

- **2026-07-26** — PRD written; design brief written; round-1 wireframes delivered, Concept C
  chosen. Three commits direct to `main` (before D13).
- **2026-07-27** — Owner closed the open decisions (→ D5–D12). itqan installed (lite +
  `docs/specs/`), PR #1 merged. Stage 1 spec written and decision-closed, PR #2 merged. Stage 1
  built: all acceptance criteria pass, the Board runs in both colour schemes, and D14 was closed
  mid-build when DC4's threshold surfaced. Stage 2 spec written (PR #4), round-2 designs reviewed
  and D15/D16 recorded (PR #5).
- **2026-07-27 (later)** — Stage 2 built: propose → apply → 11 fixture-based acceptance checks →
  UI, in that order. Two defects were caught by *running* it rather than by review — a
  path-confinement guard that derived its bounds from its own input, and the JSX-newline bug
  recurring as "2 file s". The second one had already bitten once, so it was promoted from a
  lesson to a rule in `CLAUDE.md`.
- **2026-08-15 (later)** — Stage 3 spec written against **verified** SDK documentation rather than
  recall. Two findings changed the design: the Agent SDK is a *different package* from the tool
  runner the bundled API reference covers, and `strictMcpConfig` turns out to be the whole of
  "default deny" — omit it and an agent silently inherits the owner's own authenticated MCP servers.
  The inbox model was the real decision (§3.5): blocking inside the tool handler is less code and
  was rejected, because a paused run must survive a `pnpm dev` restart to mean anything.
- **2026-08-15** — Nineteen days idle; PR #6 never merged. `docs/specs/AgentOS-spec.md` arrived as
  the target for where the product should go. Evaluated against the shipped code, and the finding
  that shaped everything: the two systems point in **opposite directions** and the source spec
  breaks three of the five invariants — so the integration was written as **narrowing ADRs rather
  than deletions** (D19), which turned out to produce a better rule than the one it replaced.
  Phase A shipped this session: D18–D22, PRD §12 + a renumbered §10, the round-3 design brief, and
  the invariants scoped in `CLAUDE.md`. **Also found stale:** `CLAUDE.md` still read *"Status:
  pre-code"* while its own Commands table documented 19 passing acceptance checks — fixed, with a
  lesson (`docs/LEARNINGS.md`). **No code was written and no behaviour changed**, so
  `docs/FEATURES.md` is deliberately untouched.
