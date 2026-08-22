# Agentic OS — Decision Record

Short-form ADRs. Newest last. **This file is authoritative** for what is decided; `docs/PRD.md`
§9 is a pointer to it, not a second copy. Never renumber or rewrite a past ADR — supersede it
with a new one that says so.

> **Numbering note.** D2–D12 were first drafted in `docs/PRD.md` §9 as PRD-D1…PRD-D11, before
> this file existed. They are recorded here with their original PRD id noted, so a reader of
> either document can follow the trail. `docs/PRD.md` §9 no longer holds decision state.

---

## D1 — Profile: lite + `docs/specs/` (2026-07-27)

**Decision:** Install the **lite** profile — router, `docs/HANDOFF.md`, `docs/DECISIONS.md`,
`docs/LEARNINGS.md`, `docs/BACKLOG.md`, `docs/FEATURES.md` — **plus `docs/specs/`**, which is
normally a full-profile element.

**Rationale:** Lite fits the project's reality: one solo track, no released versions, no
production users, 3 commits of history. Two departures from pure lite, each with a reason:

- **`docs/specs/` added** because (a) the owner requires decision-closed specs before building,
  and (b) **the product parses this exact format** — the Overview (PRD §6.8.2) reads
  `☑`/`☐` status glyphs from sibling projects' `docs/specs/*.md`. A dashboard that cannot read
  its own specs will not read hadaya's. Dogfooding is the stronger reason.
- **CHANGELOG + release ritual deferred** (interview Q2/Q6): no versions, no production users,
  nothing to promote. Graduation trigger: the first tagged release or external user.
- **SPEC-CONTRACT §5–§7 gates deferred** (interview Q3): no feature has been rebuilt because a
  decision surfaced mid-build — there is no code yet, so there is no churn to mine. Specs are
  written as plain decision-closed documents until that pain is felt. → `docs/BACKLOG.md`.

**Interview provenance** — so a future session can tell decided from assumed. INSTALL.md Phase 1
allows inference where reliable; these were **inferred by the installer, not answered live**:
Q1 single-track (solo, one deliverable), Q2 no releases (local tool, D10 confirms local-only),
Q3 no mid-build rebuild (no code exists), Q4 invariants (drawn from PRD §3 principles), Q6 no
production users. **Answered by the owner directly:** the branch model (→ D13), and the D5–D12
product decisions below. **If any inference is wrong, correct it here as a new ADR.**

**Rejected:** Full profile — COMPASS + per-track handoffs would create four files with one
track to put in them, and itqan's default on ambiguity is to start lite and graduate on pain.

## D2 — Primary job: drift reconciliation, not usage analytics (2026-07-26) *(PRD D1)*

**Decision:** The product leads with reconciling document claims against git/GitHub reality.
Usage and cost analytics are a secondary, collapsed panel.

**Rationale:** The reference screenshot (Devin's usage view) is retrospective metrics. The
evidenced pain is different and better documented: nadim's HANDOFF has been caught stale three
times, and was **verified two PRs behind on 2026-07-26**. Knowing a quarter's spend does not
tell you a document is lying to the next agent that reads it.

**Rejected:** Mirroring the screenshot; a live "agent control tower" view.

## D3 — Delivery: local Next.js app + collectors (2026-07-26) *(PRD D2)*

**Decision:** A real Next.js + TypeScript app in this repo, with server-side collectors and a
SQLite cache, run locally with `pnpm dev`.

**Rationale:** Matches the stack used across every other active project. Interactive and
always-fresh, and it can grow — unlike a regenerated static HTML file.

**Rejected:** Self-contained regenerated HTML (simplest, but static between runs); a CLI plus a
published artifact.

## D4 — itqan is both the data model and the installed framework (2026-07-26) *(PRD D3)*

**Decision:** The dashboard reads itqan's seven-role spine as its schema, **and** this project
installs itqan on itself.

**Rationale:** Dogfooding surfaces the framework's gaps — this is itqan's second real install
after nadim #9. And the dashboard must be able to show itself as a green row; self-inclusion is
the acceptance test.

**Consequence:** Executed 2026-07-27 (this install). See LEARNINGS — it was *claimed* in the PRD
a day before it was true.

## D5 — Claim parsing: heuristics + confidence, not required markers (2026-07-27) *(PRD D4)*

**Decision:** Parse claims out of existing document prose using heuristics, and attach a
confidence score to each. Do **not** require structured markers in the five watched repos.

**Rationale:** Markers would be more accurate but demand editing five repos before the tool
delivers any value, which inverts the adoption order. If heuristics prove too noisy in practice,
the fallback is to propose a small marker convention **upstream to itqan** (a dated header
format, a canonical PR-reference syntax) rather than a local hack. → `docs/BACKLOG.md`.

**Consequence:** Confidence must be visible in the UI. A low-confidence drift claim shown as
certain would violate the product's own `verify-before-claim` invariant.

## D6 — "Mark verified" writes locally only (2026-07-27) *(PRD D5)*

**Decision:** Acknowledgements write to `data/verified.json` in this repo. They never write into
a watched project's repo.

**Rationale:** Keeps the dashboard strictly read-only toward other repos until the gated fix
proposal (PRD §6.2) is built and proven. Read-only is the safe default to start from.

## D7 — Cost basis: compute both; API-equivalent is the headline (2026-07-27) *(PRD D6)*

**Decision:** Compute **both** bases. Display API-equivalent cost as the primary figure, with
subscription-relative available as a secondary toggle.

**Rationale:** The owner asked for both if cheap. It is cheap, and here is the actual check:
API-equivalent is a pure function of recorded tokens × a price table (the `usage` object in
every transcript line already carries input, output, and both cache counts). Subscription-
relative needs exactly one extra config constant — the monthly plan price — and is then an
allocation of that fee across the period's tokens. Neither requires new collection.

**The cost is not computation, it is ambiguity:** two dollar figures for the same PR invites
misreading. So API-equivalent leads — it is verifiable against `ccusage` and comparable to
public pricing — and subscription-relative is explicitly labelled **an allocation of a fixed
fee, not a price paid.** A Max plan is a flat fee with rate limits, not a token budget; that
caveat ships with the number or the number does not ship (PRD §6.3).

**Rejected:** API-equivalent only (loses the "what is my plan actually buying" question, which
is the more useful one for a subscriber).

## D8 — Refresh: on-load only (2026-07-27) *(PRD D7)*

**Decision:** Collectors run when the page loads, plus an explicit manual refresh. No timer, no
filesystem watcher.

**Rationale:** Simplest correct thing. It suits the two primary usage moments — session start
and a deliberate glance — both of which involve opening or focusing the page. A ticking timer
also fights the calm register the design brief calls for.

**Consequence:** The freshness indicator becomes *more* load-bearing, not less: with no
auto-refresh, a page left open overnight is stale and must visibly say so.

## D9 — Scope: the named projects only (2026-07-27) *(PRD D8)*

**Decision:** Watch exactly the projects declared in `projects.config.ts` — salla-apps
(`hadaya/`), nadim, itqan, fractal-code, my-personal-website, and agentic-os itself. No
auto-discovery from transcript `cwd`.

**Rationale:** `~/Documents/sl/` holds 30+ directories; auto-discovery would surface ~14 stale
repos as permanent noise and destroy the three-second scan the Board is designed for.

## D10 — Remote and PRs; agentic-os appears in its own board (2026-07-26) *(PRD D9)*

**Decision:** `github.com:Sob7i/agentic-os`, with a normal PR workflow. It is watched by itself
as the sixth project.

## D11 — The Overview stays strictly read-only (2026-07-27) *(PRD D10)*

**Decision:** The Overview displays; it never accepts input. No task creation, assignment, due
dates, effort estimates, reordering, or status toggles.

**Rationale:** Anything editable here would become a second source of truth that can itself
drift — the exact failure this product exists to catch. Every item traces to a file in a repo;
editing happens there, through the normal ritual.

**Consequence:** This is an invariant (`CLAUDE.md` §Invariants 5), not a preference. Reversing
it is a product identity change requiring a superseding ADR.

## D12 — The decision queue folds into the Overview (2026-07-27) *(PRD D11)*

**Decision:** Do not build a separate Decision Queue screen. Its content — open decisions with
age, non-decision-closed specs, pending human gates — is the Overview's **Blocked** band.

**Rationale:** Same data, same question ("what is waiting on me"). Two screens would split one
answer. The round-1 wireframe of a standalone queue is kept as record, not as a target.

**Consequence:** Revisit only if the Blocked band proves too crowded in daily use. →
`docs/BACKLOG.md`.

## D13 — Branch model: feature → develop → main (2026-07-27)

**Decision:** All PRs target `develop`. `main` advances only by owner-merged `develop` → `main`
promotion. Agents never merge, and never open a PR from a long-lived branch.

**Rationale:** Owner instruction, matching itqan's branch-discipline guardrail and nadim's D14,
which was itself adopted after PRs merged sideways into each other's branches.

**Consequence:** The three existing doc commits landed directly on `main` before this decision
(2026-07-26). `develop` was branched from that point, so history is consistent — but that route
is closed from here.

## D14 — Uncommitted work needs a threshold before it is a finding (2026-07-27)

**Decision:** DC4 (uncommitted work) reports `attention` only at or above a per-project
`dirtyThreshold`, default **5**. Below it, the dirty count is still *displayed* as a fact, but it
does not raise severity.

**Rationale:** Surfaced mid-build, so the build stopped to close it (`CLAUDE.md` §Working style).
Running the engine against real data, **every one of the six projects came back non-green** —
itqan's sole "dirty" file is an untracked research note. With no threshold, `✓ in sync` can never
render, which breaks the product's stated core value (PRD §3.1: *"a green row is worth as much as
a red one… a dashboard that only shows problems makes you wonder whether it ran"*) and fails the
Stage 1 gate AC-2.

The threshold is not invented: the design brief's own reference data already implied one — itqan
at 1 dirty was recorded `✓ in sync`, while fractal-code at 5 and my-personal-website at 7 were
`○ attention`. This decision makes that implicit line explicit and configurable.

**Rejected:** *No threshold* — makes green unreachable and trains the eye to ignore the board.
*Dropping DC4* — a large uncommitted tree is genuinely worth seeing. *Treating untracked
differently from modified* — a real distinction, but it splits one check into two and the
threshold already handles the common case; revisit if the count proves noisy.

**Consequence:** `stalledAfterDays` and `dirtyThreshold` both live in `projects.config.ts`, per
spec §5.8 — thresholds are configuration, never hardcoded.

## D15 — Corrections are deterministic edits, never generated prose (2026-07-27)

**Decision:** Any correction this product proposes to a watched repo is a **deterministic string
edit** computed from a matched claim span. No model-drafted prose, ever — not for state docs, not
for `LEARNINGS.md` entries (which are templated), not for future checks.

**Rationale:** Forced by invariant before it is a preference. `CLAUDE.md` §Invariants 1 permits no
network egress beyond `gh`, so a model-drafted rewrite is out of scope by rule. It is also the
better engineering answer, verified against nadim's real HANDOFF: the deterministic fix changes
one character inside the matched span, leaves the file at 23,074 bytes, and touches one line — a
diff a human can actually review. A generated rewrite would also restyle the date, the branch
note, and the tone, producing a larger and less reviewable diff.

**Consequence — the known limitation is accepted, not hidden.** A mechanical edit can introduce a
*new* inaccuracy in prose it never read: correcting `#22` → `#23` leaves the adjacent
`(verified 2026-07-13 via gh pr list)` beside a fact re-verified today. The mitigation is the
gate — the diff shows the **full line in context** and the UI flags the stale neighbour. This is
the argument for human approval stated concretely, and it is why an auto-applied fix is refused.

**Rejected:** Model-drafted corrections (breaks the egress invariant, unreviewable diffs);
whole-line regeneration (same problem, smaller blast radius).

*Promoted from `docs/specs/stage-2-fix-proposals.spec.md` §5.1.*

## D16 — Overview direction: tabbed / by-band, plus a "blocked on you" spotlight (2026-07-27)

**Decision:** Build the Overview as **Concept A** — a second tab beside the Board, arranged
**by band** (In flight · Ready · Blocked · Shipped · Deferred) — **plus Concept B's dedicated
"Blocked on you" spotlight band** lifted above the columns.

**Rationale:** The deciding argument appears in neither concept's own rationale: **the Board is
already a by-project view** — a roster of six rows. An Overview that is also by-project (B) makes
the second pillar partly duplicate the first. By-band is a genuinely different cut of the same
seven roles, which is what earns it a separate surface. The tab also keeps the Board on its own
full surface; B's collapsed strip demotes it, in tension with the requirement that the Board keep
its three-second scan (design brief §10.10).

B's one clear win is carried over: a dedicated **"blocked on you"** band serves itqan's core
thesis — decision availability is the bottleneck — better than A's chip inside the Blocked
column. It is sourced from real `Unblocked by: Sobhi …` strings.

**Rejected:** A as delivered (buries the bottleneck in a column); B as delivered (duplicates the
Board's by-project cut and compresses it).

**Consequence:** The Stage 3 spec is written against this synthesis, not against either wireframe
as drawn. Provenance rendering (◆ derived / ✓ verified / ~ suspect, suspect in amber and never
the Board's drift red) carries over from both concepts unchanged.

## D17 — The gate's second button acknowledges; it does not reject (2026-07-27)

**Decision:** The fix proposal's secondary action is **"Leave as is"**, which writes a local
acknowledgement (`data/verified.json`, D6). There is no "Reject" button, despite the round-2
wireframe drawing one.

**Rationale:** A reject that merely hides the card would be forgotten on reload, so the next
session would see the same proposal and re-decide — the dashboard silently losing a decision the
user made. A reject that *persisted* would be a status this product stores about a watched repo,
which is the second source of truth D11 forbids. Acknowledging is the honest version of the same
gesture: it records **that you looked**, never what is true, and it expires by construction when
the claim changes, because the key is the claim hash.

**Consequence:** Acknowledged drift stays on the Board, visibly acknowledged and muted, rather
than disappearing. "Un-acknowledge" is one click. The `Fix Proposal v2` wireframe's Reject button
is therefore *not* built as drawn — recorded here so the divergence is deliberate and findable.

**Rejected:** *Reject = dismiss for this session* (loses a decision silently); *Reject = mark
resolved* (the dashboard grading its own work, already refused in spec §5.6).

---

> **D18–D22 re-scope the product** (2026-08-15). They introduce an execution layer beneath the
> portfolio, adapted from `docs/specs/AgentOS-spec.md`. Read D18 first; the other four follow from
> it. Together they amend D9, D12, D16 and supersede D11 in part — each says so where it applies.

## D18 — Two layers: a portfolio above a per-project execution layer (2026-08-15)

**Decision:** Agentic OS becomes **two layers**, not one product.

- **Portfolio layer** — top level, all projects. The Board (drift) and the Overview (in flight ·
  ready · blocked · shipped · deferred). Read-only, derived from files and git. This is what
  exists today.
- **Execution layer** — per project, nested. An AgentOS in the shape of
  [`specs/AgentOS-spec.md`](specs/AgentOS-spec.md): agents, tasks, goals, inbox, sessions,
  templates, costs. Read-write; it runs agents.

**The execution layer is opt-in per project.** A project has an `agentos.yml` or it does not. A
project without one keeps appearing in the portfolio exactly as today — the same graceful
degradation the codebase already applies to unfilled roles (*absent → "not instantiated", never an
error*). Of the six watched projects, itqan is a framework repo and two are router-only; none of
them needs an agent roster.

**Rationale.** The AgentOS spec is *already* project-scoped — its §4 makes `Project` the unit of
YAML-as-code, holding agents, skills, templates, MCP connections and repos, and its reference UI
carries a project switcher above the entire sidebar. What it has **no** surface for is more than
one project at a time. This product is the inverse: nothing but a cross-project surface. They
stack; they do not compete.

The reason to own both rather than adopt one is sharper than convenience. **An executor that
spawns a five-hour goal from a specification drafted against a twelve-day-stale HANDOFF will burn
the money and pass every safety rail the spec defines.** §11's rails — spend cap, max duration,
stuck-at-19 — all measure the *loop*; none measures its premise. Nothing in AgentOS-spec checks
whether a goal's inputs are still true. Stage 1 already does exactly that, against real repos,
and found the instance that motivated this project. That check is worth more guarding a spend
than guarding a read.

**Rejected:** *Replace this product with AgentOS* — throws away the only verification layer, which
is the one thing the spec lacks and cannot easily grow. *Build AgentOS as a panel of the Board* —
inverts the scale; execution is 20–40× the current codebase and cannot be a subpanel of it. *One
flat sidebar holding both* — a project's agent roster is not a portfolio concern, and six rosters
in one nav destroys the three-second scan the Board is built for.

**Consequence:** navigation and shell become a first-class design problem for the first time —
[`DESIGN-BRIEF-EXECUTION.md`](DESIGN-BRIEF-EXECUTION.md). The Overview as scoped in D16 is
cancelled and rewritten → D22.

## D19 — The invariants are narrowed to the portfolio layer, not deleted (2026-08-15)

**Supersedes D11 in part.** Amends
`CLAUDE.md` §Invariants 1, 4 and 5.

**Decision:** Three of the five invariants change **scope, not truth**. Each holds unchanged at
the portfolio layer, and is narrowed — explicitly, with a stated boundary — inside a project that
has opted into an execution layer.

| Invariant | Portfolio layer | Execution layer (opted-in project only) |
|---|---|---|
| **1 · Local-only, no egress** | unchanged — git, `gh`, the filesystem | **+ the model API the runner calls**, and the hosts a session's environment explicitly allow-lists. Nothing else. No telemetry, no analytics, no cloud sync, ever. |
| **4 · Read-only; writes gated** | unchanged — one click, one line, two files | agent sessions write in their granted repos. The gate moves from **per-write** to **per-session**: a session is authorized once, at spawn, against a declared manifest of repos, paths, and permissions. |
| **5 · No second source of truth** | **unchanged and absolute** | narrowed by the rule below |

**The rule that replaces D11 inside a project:**

> **The portfolio stores no state. A project's execution layer may — and everything it stores
> carries a session id and a commit sha as evidence.**

**Rationale.** D11 made read-only an identity property because anything editable becomes a status
that nothing checks — precisely the drift this product exists to catch. *That reasoning is still
correct*, which is why the carve-out is scoped rather than general. A Kanban card reading
`status: done` is exactly the unchecked claim D11 forbids — **unless** the transition was produced
by a session that ran and left a commit behind, in which case it is the strongest fact in the
system: stronger than a document, and stronger than a bare git log, because it carries its own
provenance (→ D22).

**The evidence requirement is what makes the carve-out safe.** A status that cannot name the
session that produced it is a claim, not a fact, and must render as one. Human-set statuses are
therefore permitted and must be visibly weaker than executed ones — the same claim-versus-fact
distinction the Board already draws, applied one layer down.

**Consequence:** the layer boundary *is* the enforcement boundary, so it must be a real boundary
in code and not only in the UI — the portfolio's data path may not import the execution layer's
store. The fix-proposal gate stays per-write and unchanged; it is a portfolio-layer feature.

**Rejected:** *Delete D11* — loses the only reason this is not a worse Linear, and licenses
exactly the drift the product diagnoses. *Keep D11 whole* — makes the execution layer unbuildable;
every task, goal, session and inbox message is state with no file to hold it.

## D20 — Runner: local-first, behind the spec's Runner interface (2026-08-15)

**Decision:** MVP sessions execute **on the local machine** — the Claude Agent SDK as a
subprocess, an **ephemeral git worktree** per session, SQLite for domain objects, the OS keychain
for secrets. AgentOS-spec §16's `Runner` interface (`provision` / `streamToolCalls` /
`injectReply` / `destroy`) is implemented from the first session, with one backend behind it.

**Rationale**, in order of weight. It narrows D19's egress carve-out from *"delete invariant 1"*
to *"add the model API host"* — the difference between amending an invariant and abandoning it.
Both products are explicitly single-operator on one machine, so cloud execution buys the ability
to close the laptop and very little else before the loop is proven. And §16's interface is the
spec's best structural idea: it is the seam that makes this reversible, so building it first costs
one indirection and buys the cloud path unbuilt.

**The spec's ephemeral container becomes an ephemeral git worktree plus a fresh SDK session.** The
rule the container exists to enforce — §6: no warm dirty workspace; nothing survives a session but
commits and files written through the filesystem MCP — is preserved exactly, and cheaply.

**The weakening is stated, not hidden:** a local process can in principle reach the whole
filesystem, so §5's least-privilege walls are enforced at the MCP and tool layer only, without a
container or a network namespace beneath them. → `docs/BACKLOG.md`.

**Rejected:** *Cloud-managed from day one* — deletes invariant 1 outright and adds infrastructure
before any loop is proven. *R2 + Secret Manager as specced* — that persistence design exists
because *the spec's* containers are ephemeral **and remote**; a local worktree runs on a local
disk, so the whole R2 layer solves a problem this build does not yet have.

## D21 — A project may mount several repos; exactly one is primary (2026-08-15)

**Amends D9.**

**Decision:** `Project` holds a **list** of repos, each with a mount path and permissions, per
AgentOS-spec §4. Exactly one is marked **primary**: the repo whose state document the Board
reconciles and whose role coverage the roster reports.

**Rationale:** [`projects.config.ts`](../projects.config.ts) currently assumes one project is one
directory, and salla-apps already strains it — the project is named `salla-apps` and the directory
is `hadaya/`. The AgentOS model is 1:N because an agent commonly mounts an application repo and a
docs or infrastructure repo together. Deciding this now costs one config shape; deciding it after
tasks, sessions, grants and cost records all reference a repo costs a migration through every one
of them.

**The primary designation is declared, never derived.** With several repos there is no
non-arbitrary rule for which one holds "the" HANDOFF, and guessing would make the Board's source
citation unreliable — the one thing it may never be (invariant 2).

**Consequence:** `projects.config.ts` grows `repos[]`; today's `path` becomes the primary repo's
path. D9's rule — the watched set is explicit and never auto-discovered — is unchanged.

## D22 — `▶ executed` provenance; one Overview, two sources (2026-08-15)

**Amends D12 and D16.**

**Decision:** Three parts.

1. **Provenance gains a fourth level**, above the three in PRD §6.8.1: **`▶ executed`** — this
   item was produced by a session *this system ran*, and it carries the session id and commit sha
   that prove it.
2. **The portfolio Overview reads both sources** — tasks and goals for projects with an execution
   layer, documents and git for those without — into the same bands.
3. **There is no per-project Overview.** A project's forward-looking surface is its Tasks and
   Goals. Full stop.

**Rationale.** (1) The provenance ladder was `derived` > `verified` > `suspect`, and `derived`
topped it because git cannot lie. An executed item is strictly stronger still: *"we ran it, here
is the session, here is the commit"* answers not only whether the work happened but what produced
it and what it cost. This is the payoff of D19's evidence requirement — the thing that makes
stored state safe is the same thing that makes it the best row on the Overview.

(2) A mixed portfolio is the real one: six projects, and the execution layer will reach them one
at a time over months. An Overview that only reads files would go blind on exactly the projects
being worked hardest; one that only reads tasks would show four empty projects.

(3) Two answers to *"what is in flight for nadim"*, drawn from two sources, is **the drift this
product exists to catch, appearing inside the product.** The bands are a portfolio cut; per
project, the Kanban already answers the question with better data.

**Consequence:** the Stage 3 Overview spec is cancelled and rewritten. D16's synthesis survives
unchanged — arranged by band, with a dedicated "blocked on you" spotlight above the columns; what
changes is where the rows come from and that a fourth provenance level must be designed.
`~ suspect` keeps its rule: sourced from the Board's drift state, never re-derived.

## D23 — The shell is a mode switch with a persistent portfolio ribbon (2026-08-18)

**Closes round-3 design.** Chooses between the four architectures in
[`docs/DESIGN-BRIEF-EXECUTION.md`](DESIGN-BRIEF-EXECUTION.md) §4.2, answered by
[`design/wireframes2.pen`](../design/wireframes2.pen).

**Decision:** **Concept B′ — the mode switch** (frames `B′1`, `B′2`), not the design's own
recommendation of Concept C. Inside a project the shell is three stacked pieces:

| Piece | Present | Carries |
|---|---|---|
| **Portfolio ribbon**, 40px | **always** | all six projects as glyph + name, the Board's own freshness timestamp, `← All projects` (`⌘1`) |
| **Project drift band** | **only when *this* project is in drift** | the drift sentence verbatim from the Board's check, and `open on Board` |
| Project rail + pane | always | `Tasks · Goals · Inbox · Sessions · Costs`, and `configuration` for everything else |

**Rationale — why B′ over C.** The design agent recommended C (a persistent 268px spine) and its
argument is good: the portfolio becomes peripheral vision rather than a destination. It is
rejected on the surface it costs the most. The Kanban is the screen this product will be used in
for hours, it carries four columns of cards that already stack a title, a claim line, an agent, a
schedule chip and an evidence line, and C spends 268px of that width permanently to keep five
projects visible that the owner is, by construction, not working on. B′'s own rationale note
concedes the fallback explicitly: *"B′ is the right answer if the Kanban proves cramped in build."*
We are deciding before the build rather than after, which is cheaper and reversible — the two
concepts share every component and differ only in where the portfolio list is mounted.

**What we accept by choosing it:** switching projects costs two actions rather than one, and
entering a project is a real visual swap rather than a pane change. Both are stated in B′'s
rationale as its sacrifices, and both are accepted.

**The ribbon is always present — the amendment.** The owner's instruction was *"the ribbon is
important at a project view level only when the project itself has drifted."* That instruction is
adopted for **the drift band** and rejected for **the ribbon**, because the two were one object in
the wireframe and are two different things:

- **A conditional ribbon makes its own absence a claim.** No ribbon would mean *"nothing here has
  drifted"* — a fact, asserted, with nothing stating when it was checked. That is invariant 2, and
  the Board already refuses exactly this shape: *"Distinguishes 'nothing to check' from 'checked
  and fine'"* is a shipped Stage 1 behaviour ([`docs/FEATURES.md`](FEATURES.md)). A silent
  execution layer would be indistinguishable from an execution layer whose collectors had failed.
- **The ribbon is the only thing that makes B′ survivable.** B′ beats plain B solely because the
  portfolio does not vanish on entry. A ribbon that appears only on drift deletes that property
  and reduces B′ to the concept the design brief already ruled out.
- **The intent behind the instruction is correct and is honoured** — nothing about the portfolio
  should shout while you work. It is honoured by weight, not by absence: the ribbon is glyph +
  name only, no counts, no sentences, no deltas (the resolution B′ and C share), and the loud
  object — the drift band, in words, in `$drift` — appears **only when this project is the one in
  drift**, which is what was asked for.

**Consequence:** frame `B′2` is the shell to build, with the ribbon and the drift band separated
into two rows. `C1`–`C5` become reference for everything that is *not* the shell — the provenance
ladder (`C5`), the running treatment, and the agent monograms are unaffected by this choice and
are adopted as drawn. The ten positions in the design's *"Positions on the ten open questions"*
note are adopted unchanged **except position 1** (architecture), which this decision overrides.

## D24 — Work is dispatched, never picked up (2026-08-18)

**Decision:** Three parts, all load-bearing for the execution layer.

1. **No agent chooses its work.** Every `Task` carries its agent in `assigneeAgentId`, written
   **when the task is created** — `Project.defaultAgentId` is applied there, never at dispatch, so a
   `null` assignee reaching `dispatch` means deliberately human-only work and is refused (spec
   §7.1, §7.3). There is no scanner, no poller, and no queue-worker that looks for `todo` cards and
   starts them. **Nothing runs unless something explicitly asks for it by task id.**
2. **One funnel.** A single `dispatch(taskId, trigger)` is the only path in the system that may
   create a `Session`. Run-now (Stage 3), chain steps (Stage 4), cron and webhooks (deferred, →
   `docs/BACKLOG.md`) are **callers of that function**, not mechanisms of their own.
3. **Every session records the project's drift state at spawn**, as evidence on the session row —
   the claim, the check that produced it, and when it was checked. Recorded, not blocked.

**Rationale.** (1) and (2) are one argument. AgentOS-spec §9.4 describes the opposite —
*"completing step N enqueues step N+1 (`todo` → runner picks it up)"* — a durable job queue with a
worker, and §3.4 suggests pg-boss or Inngest for it. That is the right shape for a hosted product
with webhooks firing 600 times. It is the wrong shape here, for a reason specific to this
product: **a process that scans for work and starts it is the exact failure PRD §12.1 says we are
building the portfolio layer to catch** — hours and real money spent against a premise nobody
re-read. A queue makes that failure autonomous and repeatable; explicit dispatch keeps a namable
cause behind every session. It is also less code, has no daemon, and survives a `pnpm dev`
restart without a scheduler to recover.

The cost is real and accepted: **nothing happens while you are asleep** until cron exists, and
cron will then be the first caller that can start work unattended. When it arrives it inherits the
preconditions and the drift record rather than getting a second path — which is the whole point of
the funnel, and why it is decided now rather than when the second caller appears.

(3) is the differentiator made concrete. The portfolio layer's finding — *this document contradicts
git* — is worth most at the moment work **starts**, and an execution layer that runs a task without
recording what its project claimed at that instant throws that away. This is deliberately **a
record, not a rail**: blocking dispatch on drift would make the most common state of a real
project (`⚠`, for twelve days) into a modal people learn to dismiss, and the design's position 7
already rejects that shape for the goal pre-flight. The record costs one column and makes a
post-mortem answerable — *"was this session started on a stale premise?"* — which today nothing in
either layer could answer.

**Consequence:** `lib/agentos/dispatch.ts` is the single entry point and the acceptance suite
asserts it (spec §7, AC-14…AC-18). `Session` gains `triggerKind`, `driftAtSpawnJson`, `pid`
and `bootId`. A goal-level pre-flight that *does* block is still open for Stage 5 (PRD §12.6) and is
not pre-empted by this decision.

## D25 — A Definition of Done item carries the *kind* of evidence that closed it (2026-08-18)

**Amends the round-3 design** (frame `G1` in [`design/wireframes2.pen`](../design/wireframes2.pen)),
and applies D22's provenance ladder to the execution layer's own completion signal.

**Decision:** `DoDItem` gains a `verification` field with three values, and the UI renders each
differently:

| `verification` | What actually happened | Renders as |
|---|---|---|
| `command` | a declared `verificationCmd` ran in the worktree and exited 0 | **`✓ verified`**, naming the command and when it ran |
| `judged` | the orchestrator's model call read the progress log and concluded it | **`◆ derived`** — *"the orchestrator's reading"* — with the session id |
| `human` | a person ticked it | quoted italic, naming them |

A goal's completion banner states the split — *"3 of 5 verified by command, 2 by the orchestrator's
reading"* — so a goal that declared itself finished looks different from one that was checked.

**Rationale.** AgentOS-spec §11 has the orchestrator *"mark DoD checkboxes that are satisfied"*, and
frame `G1` draws a met item with `▶ s_8f21c4 · b71f04d` beside it. In this product `▶ executed`
means *a session produced this and here is the commit that proves it* (D22). **It does not prove
it.** The session produced the work; the judgement that the work satisfies the item is a model
reading a log. Rendering a model's reading with the glyph reserved for verified execution is the
claim-as-fact collapse invariant 3 exists to prevent — committed by this product, on the one screen
that decides whether to keep spending money.

The fix is cheap because the vocabulary already exists. D22 built a four-level ladder precisely so
that things of different evidentiary weight could stop looking alike; a DoD item is simply the first
place inside the execution layer where two of those levels collide. **`~ suspect` is deliberately
not used** — a judged item is not doubtful, it is *derived*, and reserving `suspect` for the Board's
drift state keeps its meaning sharp.

**The second-order effect is the valuable one.** Because a `verificationCmd` upgrades an item from
`judged` to `verified`, writing a DoD becomes an exercise in asking *"how would I know?"* —
*"covered by an integration test"* becomes `pnpm test path/to/spec`, and completion becomes a fact.
Items that genuinely cannot be commanded (*"the key is never written to a log"*) stay `judged` and
say so. **The design pressure points the right way**, which a single boolean `met` could never do.

**Consequence:** the schema in `docs/specs/stage-5-goals.spec.md` §3.1 carries `verification`,
`verificationCmd`, `metBySessionId`, `metSha` and `evidenceNote`; AC-5 asserts that a failing
command keeps an item unmet **even when the model says it is met**; and frame `G1` is superseded in
this one respect. It cannot be retrofitted after the goal UI is built, which is why it is closed
now rather than during Stage 5.

## D26 — The shell is split out of Stage 3 and built first, as Stage 3a (2026-08-18)

**Amends the build order in `docs/PRD.md` §10**, which is gated, so moving work across a gate is a
decision rather than a scheduling preference.

**Decision:** the app shell — routing, the portfolio ribbon, the drift band, the project rail, and
the decomposition of `app/page.tsx` that they require — is removed from Stage 3's build-note item 7
and becomes **Stage 3a**, built **before** Stage 3's internals. Stage 3 keeps the Tasks board, the
session view and the inbox, which are the parts that need an execution layer to exist.

**Rationale — four reasons, in the order they convinced.**

1. **The shell is portfolio-layer work, and it is not gated.** Stage 3 is blocked on two owner
   decisions (§5.11, §5.12) about which repo an agent may touch and whether it may commit. The
   shell touches neither: it renders the six projects the Board already renders, from
   `buildBoard()`, which shipped in Stage 1. **Work that is ready should not sit behind a gate that
   does not apply to it.**
2. **It is the cheapest available test of D23.** D23 chose Concept B′ against the design agent's own
   recommendation, and the recorded weakness of B′ is precisely a space constraint — *"horizontal
   space forces the six names to compete with the ribbon's own controls, and severity has to survive
   at 11px."* That is answered by building it with the six real project names, not by discussion.
   Doing it **before** five surfaces mount inside the shell means the fallback (Concept C) is a
   layout change over shared components rather than a rewrite.
3. **There is no foundation today, and the second page would invent one badly.** The app is one
   route, a fifteen-line root layout that only renders `<body>`, and a **448-line `app/page.tsx`**
   holding the Board, the fix-proposal UI and the roster together, over 539 lines of global
   `board.css`. Tasks, Goals, Sessions, Inbox and Costs would each arrive with their own answer to
   the same questions. **The conventions are cheapest to set while there is one consumer.**
4. **It ships two complete screens with real data.** The portfolio home, and a watched-only project
   view — four of the six watched projects have no execution layer, so frame `C3` is fully
   buildable today. This is not a frame around nothing.

**Why this is a split rather than a new stage.** None of PRD §10's Stage 3 acceptance criteria
concern navigation, and none of the shell's concerns are execution-layer. Stage 3's criteria are
unchanged and it still cannot be called done without them.

**The risk accepted:** building a container before its main occupant, so the Kanban's real width
demand is inferred from the design rather than measured. Mitigated by §5.4 of the shell spec — the
pane is given no maximum width and the Tasks board is the first thing built after it, so the
measurement arrives one slice later rather than never. **If the ribbon does not fit, D23 named the
fallback in advance**, which is the reason it was designed.

**Consequence:** `docs/specs/stage-3a-shell.spec.md`; PRD §10 gains Stage 3a; Stage 3's build note 7
narrows to the surfaces that need an execution layer. `pnpm verify` must be **unchanged** by the
decomposition — that is the shell spec's AC-1, and it is what makes refactoring a 448-line file
covered by eleven acceptance checks a safe move rather than a brave one.

## D27 — The first real sessions target `fractal-code`, and may commit — but the seeded agent may not (2026-08-18)

**Closes both gates on `docs/specs/stage-3-execution-mvp.spec.md`** (§5.11 and §5.12), which move
that spec from `☐` to `☑`. Owner decision, taken 2026-08-18; both halves end in a write to
someone's repo, which is why neither was the agent's to make.

**Decision, in two parts.**

1. **Target repo: `fractal-code`.** PRD §12.4 requires a low-stakes watched repo and forbids
   agentic-os. `fractal-code` is the quieter of the two candidates and **has no state document**,
   so there is nothing for a stray agent to contradict — a first run cannot manufacture the exact
   drift this product exists to detect.
2. **`canCommit` ships; the seeded agent is `false`.** The capability is built, tested and on the
   `Agent` row, so AC-8 can assert commit-sha capture against a fixture that does commit. The agent
   seeded into `fractal-code` starts with `canCommit: false`, so the **first real run is observable
   before it is consequential**: the worktree, the inbox pause, the gate and the cost are all
   exercised, the diff is readable, and nothing enters the object store until the owner flips one
   flag.

**Rationale.** These are the same shape of call, and the same answer: *build the capability, seed
it timid.* The alternative to (2) — not building `canCommit` at all — would have made AC-8 untestable
and pushed the first commit-bearing run into a later slice where it would arrive alongside chains
and rails rather than alone. **The expensive thing is not an agent that commits; it is an agent that
commits for the first time inside a stage that is also proving four other mechanisms.**

**Consequence:** the spec's status glyph flips to `☑`, `projects.config.ts` gains fractal-code's
`agentos.yml` when Stage 3 seeds it, and `docs/specs/stage-3-tickets.md` can be built against a spec
with no open decisions. **The flag stays owner-only** — nothing in the execution layer may set
`canCommit` on its own agent, and the seed value is configuration, not a default in code.

## D28 — SQLite via Node's built-in `node:sqlite`, with a declared engine floor (2026-08-18)

**Decision:** the execution layer's store uses **`node:sqlite`** (`DatabaseSync`), Node's built-in
driver — **no dependency added** — and `package.json` gains `engines: { node: ">=22.13" }`, the
version where it became available unflagged.

**Rationale.** The alternative is `better-sqlite3`, which is mature and stable but needs a native
build step on every install and every Node upgrade. For a **local-only tool with one user on a
known machine** (invariant 1), a zero-dependency driver is the smaller surface, and the schema and
migrations are ours either way — the driver is one import in one file.

**The cost, stated rather than discovered later.** `node:sqlite` is marked **experimental**: it
prints `ExperimentalWarning: SQLite is an experimental feature and might change at any time` on
first use, and its API may change across Node releases. Two consequences:

- **The warning will appear in acceptance-suite output** once a suite imports `db.ts`, and this
  project cares about suite output being readable. Suppressing it must be explicit and narrow, not
  a blanket `--no-warnings`, which would also hide warnings we want.
- **An API change breaks one file.** `lib/agentos/db.ts` is the only module that touches the driver,
  which is what keeps the risk proportionate — and is the same reasoning D20 used for putting a
  `Runner` interface in front of the SDK.

**The engine floor is not optional.** Without it, an install on Node 20 fails at *runtime*, inside
the execution layer, with a confusing missing-module error. Declared, it fails at install with a
clear one. Nothing in the repo declared `engines` before this.

**Consequence:** `docs/BACKLOG.md` carries the swap condition — if the experimental API moves under
us twice, or a second machine on an older Node needs to run this, `better-sqlite3` behind the same
accessors is a contained change.

## D29 — MCP tool names use underscores, not dots (2026-08-18)

**Decision:** the four in-process MCP tools are named **`task_read`, `task_update_status`,
`task_append_activity`, `inbox_ask`** — not the dotted form
(`task.read`, `inbox.ask`, …) that `stage-3-execution-mvp.spec.md` §3.3 carried from the day it was
written until T4 was built against it.

**Why the dotted names were wrong.** They register perfectly well at the MCP protocol layer —
confirmed empirically while building T4: the server's `_registeredTools` map keeps the dot verbatim,
and nothing rejects it. But the Anthropic Messages API's own tool-definition `name` field is
documented as `^[a-zA-Z0-9_-]{1,64}$`, which excludes the dot, and nothing in the installed
`@anthropic-ai/claude-agent-sdk@0.3.233` was found to rewrite the **tool** half of the
`mcp__<server>__<tool>` pair before it reaches that API. The SDK normalizes *server* names
(`sdk.d.ts:3763`); the tool name it passes through.

**Why this was invisible, which is the part worth remembering.** §3.3's closed decision has AC-4 and
AC-5 call the tool handler and `canUseTool` **directly**, deliberately — it is the only way to prove
that the handler refuses *regardless of what let the call through* (§3.4). The consequence is that
**no check in `pnpm verify` crosses the model API boundary at all**, so the one place this
constraint is enforced is the one place the suite never reaches. The first thing to hit it would
have been AC-12, the single opt-in real session — which is precisely the role §4 assigns AC-12
("the only proof the other eighteen are testing something real"), arriving one ticket too late to be
cheap.

**Rejected: rely on the SDK sanitizing it.** It may well do so somewhere the grep missed. But
`external-API-fields-are-guilty-until-verified` is a standing rule, and the alternative — a rename
that costs four string constants and is unambiguously valid under both charsets — has no downside
to trade against an unverified assumption. The qualified names stay far inside the 64-character
limit (`mcp__agentos__task_append_activity` is 34).

**Consequence:** `AC-5b` asserts the charset structurally, over every name in
`lib/agentos/mcp/names.ts` and its qualified form, so the suite now catches this class without a
real dispatch. Verified by reverting one name to the dotted form and watching it fail. `names.ts`
is the wire-name authority; prose in the specs still uses dots where it describes the concept.

## D30 — a project is initialized by an explicit button, never by a watcher (2026-08-19)

**Decision:** an **"Initialize" button** on the Tasks page's *not initialized* pane turns a
project's `agentos.yml` into a `Project` row. Closes `stage-3b-onboarding.spec.md` §5.1; the spec
is now buildable.

**Rationale.** The button sits exactly where the confusion already is — the page has already
detected the state and explained it in a sentence, so the fix belongs beside the explanation rather
than in a command the reader has to go and find. It also keeps creation an explicit human act,
which is invariant 4's shape (*nothing is written without a click*) applied to the execution
layer's own first record.

**Rejected, and recorded so it is not re-proposed.**

- **A CLI command** (`pnpm agentos:init <slug>`) is cheaper to build and trivially scriptable, but
  it puts the first step of the product's own onboarding outside the product. The owner's stated
  goal is to exercise the cycle *through the UI*, and a first-run experience that begins in a
  terminal fails that on its own terms. A command may still be added later as a convenience; it
  must not be the only path.
- **Automatic on `agentos.yml` appearing** — a filesystem watcher that creates records. **Rejected
  on sight.** It is a process that acts without being asked, which is the exact shape D24 refused
  for dispatch and the exact failure PRD §12.1 describes. That it would be convenient is not in
  dispute; convenience is how the thing this product exists to catch gets built.

**Consequence:** the button is the only path in Stage 3b, and its refusals are stated in the UI
verbatim (no `agentos.yml`, malformed yaml, already initialized) — AC-1, AC-2 and AC-3 assert each.

## D31 — this repo opts into its own execution layer, and that is not D27 (2026-08-20)

**Decision:** `agentos.yml` is added at the root of **agentic-os itself**, making the dashboard the
first project its own execution layer is reachable in. Owner's call, 2026-08-20.

**Why it was needed at all.** `projectNav` gives a project without the file **zero tabs**, so with
no watched repo carrying one, Tasks, Goals, Inbox, Sessions and Costs rendered *nowhere* — and the
*Initialize* button D30 chose had no page to sit on. Stage 3b was complete, merged, and entirely
unreachable through the UI. The owner ran the app, found the surfaces missing, and this is the
smallest thing that makes them exist.

**What this is not.** It is **not** a change to D27. D27 chose `fractal-code` for the first real
*runs* — an agent spending real money against a real repo, with `canCommit` seeded `false` — and
that stands. This makes the surfaces reachable so they can be exercised by hand; it does not decide
where work gets executed.

**What we accept by choosing it.** The dashboard is now a project that can be dispatched into,
which is dogfooding and is the point — but it also means a session could edit the code under the
server rendering its own progress. `maxConcurrentSessions: 1` is set deliberately against that, and
`canCommit` is a per-agent setting that stays `false` until an owner turns it on.

**Why the file is committed rather than gitignored.** It is configuration that describes this repo,
it is small, and a gitignored opt-in would make "does this project have an execution layer" depend
on which checkout you are standing in — which is exactly the class of drift this product exists to
detect. The four worktrees created during Stage 3b would each have answered differently.


---

## D32 — The project rail carries a SETUP group; `configuration` stops being a single link (2026-08-21)

**Supersedes the rail half of D23. Reallocates `docs/specs/stage-4-templates-chains.spec.md` §5.8.**

**Decision:** `Agents · Templates · Environments · Repos` become four nav rows in a `SETUP` group in
the project rail, each with its own route under `/p/<slug>/config/<section>`, replacing the single
`Configuration` footer link.

**Why the cap it removes was never actually holding.** D23 fixed the rail at five work tabs *plus
`configuration` for everything else*, and [`ProjectRail.tsx`](../components/shell/ProjectRail.tsx)
records that cap in a comment as load-bearing. But the argument it inherited belongs to **Concept
C**, whose rationale note argues: *"horizontal tabs physically cap at five, which ENFORCES the
work/setup split instead of encouraging it — Agents, Templates, Environments and Repos cannot creep
into the navigation because there is nowhere to put them."*

**We shipped B′, whose rail is vertical.** There is no physical cap on a vertical list, so the
enforcement mechanism C relied on does not exist here — the split was not being enforced, it was
being observed by hand, while a comment claimed otherwise. Frame `B′2` knows this: it draws a
`SETUP` label with the four names beneath it, separated from the work rows by a divider. **The
split is a section boundary in B′, not a length limit**, and this decision makes that explicit
rather than leaving the code asserting a constraint that was not real.

**What keeps the split honest without the cap.** Two things, and the second is the durable one:

- A divider and a section label, as frame `B′2` draws them — work above, setup below.
- **The URL.** Work is `/p/<slug>/<tab>`; setup is `/p/<slug>/config/<section>`. `EXECUTION_TABS`
  stays exactly five and `[tab]`'s validation is untouched, so **Stage 3a's AC-6 keeps passing
  unmodified** and a setup surface cannot become a work tab by accident. The register survives in
  the address bar even where the visual boundary would not.

**What we accept.** Three of the four rows are placeholders when this ships — `Templates` names
Stage 4, `Environments` and `Repos` state that they are unspecced. That is the cost of making the
shape of the product visible before all of it exists, and it is the convention this repo already
uses for `/overview`. AC-7 makes *"names what will build it"* a requirement rather than a courtesy,
and AC-17 pins the table count at eight so a placeholder cannot quietly acquire a schema nobody
decided on.

**Rejected: extending `[tab]` to nine keys.** It would either break Stage 3a's AC-6 for a reason
that is not a regression, or force `[tab]` to validate against two lists — at which point the cap
stops being structural and the URL stops saying which half of the product you are in.

---

## D33 — A drop is a hand-move, and a gate refuses one (2026-08-21)

**Closes `docs/specs/stage-3-execution-mvp.spec.md` §8.4's open question**, in the direction that
spec already leaned.

**The thing that makes this a product decision rather than a technical one:**
[`lib/agentos/db.ts`](../lib/agentos/db.ts)'s `assertLegalTransition` **returns early for `human`**
— `LEGAL_TRANSITIONS` constrains `session` and `system` and nothing else. Every arrow on the board
is already legal for a person at the data layer. **There is no lower layer to defer to.**

**Decision, three parts:**

1. **A drop writes `actorType: "human"` and renders as hand-moved.** The `hand-moved` variant of
   `EvidenceLine` already exists and already renders as quoted italic naming a person — *"moved by
   hand · no session produced this"*. So a dragged card is distinguishable from an executed one
   **before either is read**, which is the property `docs/FEATURES.md` records as shipped. Drag adds
   a gesture, not a register.
2. **A gated `review` card refuses the drop to `done`.** The gate exists to force an explicit act,
   and a drag is precisely the low-friction gesture it guards against. The refusal is the API's own
   string — see D36 for whose words it uses.
3. **Dragging into `doing` does not dispatch.** `Run now` stays the only path into `dispatch()`
   (D24: *"nothing runs unless something explicitly asks for it by task id"*). A card dragged to
   `doing` means *"I am working on this"* and carries no evidence line, because nothing has happened.

**Consequence for the checks, and it is not incidental.** Because nothing underneath would catch an
illegal move, **the refusal must live in the server action and must be asserted hostile** — AC-13
calls the action directly with the request a browser never sends. A UI-only refusal would be
bypassable and the suite would not notice.

**Rejected: drag closes the gate.** Simplest and most predictable, and it makes an approval gate
clearable by the cheapest gesture in the interface. **Also rejected: adding a `human` row to
`LEGAL_TRANSITIONS`** — it would break `approveDoneAction`, whose entire purpose is a human closing
a gate.

---

## D34 — Headless primitives, not a component library (2026-08-21)

**Reaffirms Stage 3a §5.2** (CSS Modules per component) against adopting shadcn/ui.

**Decision:** `@dnd-kit/core` for drag; the **native `<dialog>` element** with `showModal()` for the
drawer. One new runtime dependency, no new styling system.

**Measured, not recalled** (`npm view`, 2026-08-21): `@dnd-kit/core@6.3.1` declares
`peerDependencies: { react: ">=16.8.0" }`, so React 19 satisfies it with no override — but **6.3.1
predates React 19, so React 19 is accepted by its range, not tested against it.** It pulls three
transitive packages (`@dnd-kit/accessibility`, `@dnd-kit/utilities`, `tslib`), all pure JS.
`@dnd-kit/sortable` is **not** taken: there is no per-column ordering to persist, and adding one
would be a schema change. The newer `@dnd-kit/react` names React 19 explicitly but is at `0.5.0`,
and a pre-1.0 rewrite is the larger risk of the two. The mitigation is that **keyboard drag is
measured by hand** (M-2) — it is both the reason the dependency was taken over hand-rolling and the
first thing that would break under a React version the library never saw.

**Why the drawer takes no dependency at all.** `<dialog>.showModal()` gives a focus trap, `Esc`, an
inert background and `::backdrop` natively — which is most of what a dialog library is for.

**Why shadcn/ui is rejected.** It requires Tailwind, which would leave this repo carrying **four
styling idioms at once**: `app/board.css` (539 lines, global), CSS Modules, the `globals.css` token
layer, and Tailwind utilities. And its visual defaults — zinc neutrals, `rounded-lg` everywhere,
transitions on everything — contradict rules already committed to here: **no motion** (Stage 3
spec §8.6), **monospace reserved for verified machine truth**, and a palette that a chroma
validator rejected twice when it was first chosen by eye. Every component would be restyled on
arrival: the cost of the library without the benefit.

**Consequence: this stage adds no new colours.** Worth stating because the validator
`app/globals.css` tells you to re-run **is not in this repo** — it is dataviz's, which
`docs/DESIGN-BRIEF.md` names correctly and `globals.css` does not. AC-18 keeps the question moot by
forbidding hex literals in component stylesheets.

---

## D35 — The rail states severity, never a delta (2026-08-21)

**A deliberate divergence from wireframe frame `B′2`, recorded rather than silently dropped.**

Frame `B′2` draws the rail's identity line as `⚠ drift · 12 days`. **There is no structured age to
render that from.** [`ProjectReport`](../lib/types.ts) has no age field, and the day count exists
only as prose inside `CheckResult.headline` (*"2 PRs behind · stale 12 days"*).

**Decision:** the rail renders `GLYPH[severity]` + `WORD[severity]` from
[`lib/severity.ts`](../lib/severity.ts) — the same mapping the ribbon and the Board share — and **no
delta**.

**Why.** Producing *"12 days"* would mean parsing that sentence or computing a second one. Either is
a **second derivation of a number the drift band already quotes**, which is invariant 5, and it is
the precise failure D23's ribbon rationale spent itself avoiding: *"the spine carries no sentence,
count or delta that could contradict the Board."* The rail is chrome; the sentence lives once.

**Nothing is lost.** When a project has drifted, the drift band sits directly below the ribbon
carrying the full sentence verbatim, with a link to the Board.

**One consequence worth stating, because it looks like an inconsistency and is not.** The line
renders at **every** severity, not only `drift` — including `◌ unverifiable` when the collectors
could not check. It gets no special "age unavailable" wording; `unverifiable` is a severity like any
other and `WORD` already has it. A line that appeared only on drift would make its own absence a
claim, which is the same argument [`Ribbon.tsx`](../components/shell/Ribbon.tsx) already carries.

---

## D36 — The gate's refusal is one source with two audiences (2026-08-21)

**Surfaced by D33 and closed before it could be built.** D33 says a refused drop shows the API's own
refusal string. Read the string
([`lib/agentos/mcp/gate.ts`](../lib/agentos/mcp/gate.ts)'s `gateRefusalReason`):

> *"task `<id>` has approvalGate=true; **a session may not move it to 'done'**. Leave it in 'review'
> … or use `inbox_ask` if you need a decision before continuing."*

**That is correct for the MCP layer and wrong for the person who just dragged the card.** They are
not a session, `inbox_ask` is not a tool they can call, and the sentence never mentions the Approve
button. It is also factually off for the human case: `approveDoneAction` has **no gate check at
all**, and says so in a comment — *"the gate exists to stop a session, never a human; a human
clicking this button is the approval itself."* So the true statement to a dragger is not *"you may
not do this"* but **"this gesture is not the approval — the button is, and it records you as the
approver."**

**Decision:** `gateRefusalReason(taskId, audience: "session" | "human" = "session")` — one function,
one place, two renderings. §8.4's *"one reason, one source"* stays **literally** true rather than
nominally; the alternative was two strings that must agree, which is the shape
`docs/LEARNINGS.md` already records as *"a second source of truth wearing a justification"*.

**A default is not a decision, and this one has to be requested.** `gateModelFor` calls
`gateRefusalReason(task.id)` — the default — and `GateModel` exposes one `refusalReason`. Handing
that to the drag path unchanged reproduces the exact defect this decision exists to fix. So
`GateModel` carries **both** renderings: the `session` string stays where the card and the MCP layer
already read it, and a `humanRefusalReason` sits beside it for the drag refusal. **AC-19 pins the
`session` rendering byte-for-byte** so the MCP contract cannot drift while the human copy is
written, and AC-12 asserts the drag refusal is the human one.

**Rejected: ship the existing string verbatim.** Simpler, and it puts a sentence about sessions in
front of a person — in the product whose entire premise is that a displayed claim must be true.

## D37 — A session commits to a named branch, created at spawn (2026-08-22)

**Spec:** [`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md) §3.2.

Today `createWorktree` runs `git worktree add --detach <path> <sha>`, and teardown runs
`git worktree remove --force`. [`lib/agentos/worktree.ts:137`](../lib/agentos/worktree.ts#L137)
documents the consequence in its own words: commits are left *"unreferenced on a detached HEAD:
recoverable only as `git branch <name> <sha>` … and eventually reclaimed by gc."*

**So the output of a successful run is a sha with a deadline on it.** That is a direct contradiction
of D19's evidence rule — everything the execution layer stores carries a session id and a commit sha
*as evidence*, and evidence a garbage collector can delete is not evidence. It is also the reason
nothing downstream can exist: you cannot push a detached HEAD without inventing a ref, and inventing
one at push time means inventing it after the worktree that produced it is gone.

**Decision:** the worktree is created with `-b agentos/<task-slug>-<short session id>`. The branch
exists **before the model is called**, so every commit is on a ref from the first one. Teardown
deletes the branch **only when the run committed nothing** (§3.4) — a ref pointing at its own base
is noise, and noise makes `git branch --list 'agentos/*'` useless, which is the whole cleanup story.

**The `agentos/` prefix is load-bearing, not cosmetic.** This repo's branches are `feat/`, `fix/`,
`chore/`, `docs/` (`CLAUDE.md`), so the namespace is unclaimed and a human can delete all of them
without reading any of them. And because the session id is *in* the name, branch → session and
session → branch are both computable with no lookup table — the second source of truth D11 forbids.

**What this also buys, unasked:** an interrupted session stops being a loss. Stage 3 §7.7's boot
sweep already reports a killed session honestly; with a branch, the honest report is also actionable
— *"interrupted at `<sha>` on `<branch>`"*. It does not make sessions survive a restart, and D20
still owns that.

**One interaction, found in review of #33 and worth stating inside the decision** because it is the
only place `-b` is not simply correct: `resumeSession` builds a fresh worktree **reusing the same
session id** after an inbox pause, so the branch already exists by then. An unconditional `-b` fails
there, and recreating from the base would silently discard whatever the paused turn committed — the
work the `inbox_ask` tool's own description instructed the agent to commit before asking. **A resume
attaches to the branch; only a first dispatch creates it.** The spec's §3.2 and AC-15 carry it.

**Rejected: create the branch at push time from the recorded sha.** It works right up until gc runs,
a crash happens before the record is written, or the worktree read fails — and every one of those is
the moment the work was most worth keeping.

---

## D38 — The base ref is declared, never inherited from the owner's checkout (2026-08-22)

**Spec:** [`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md) §3.1.

[`lib/agentos/dispatch.ts:236`](../lib/agentos/dispatch.ts#L236) hardcodes `const BASE_REF = "HEAD"`,
with an honest comment: the schema has no per-project or per-task branch column, so *"the primary
repo"* is the only ref a dispatch can mean without one.

**`HEAD` means "wherever the owner happens to be standing."** If the owner is on a feature branch,
mid-rebase, or on `main`, the agent silently branches from there. `CLAUDE.md` already records the
mirror image of this failure from the other direction — *"never provision a sub-agent worktree from
the default base"*, after four agents in a row started at a commit predating the entire build. The
lesson was that a base has to be **stated and checked**, and the execution layer does neither.

**Decision:** `Project.integrationBranch` (from `agentos.yml`, default `develop`),
`Project.defaultBaseRef` (**defaulting to `integrationBranch`**), and a nullable `Task.baseRef` that
overrides both. `dispatch` resolves task → project default → integration branch, and precondition 5
already verifies the result with `git rev-parse`, so a bad ref refuses at the gate it already has.

**The fallback must not end at `HEAD`, and the first draft of this decision said it did.** Raised in
review of #33: with `HEAD` as the default, a project that sets nothing behaves exactly as it does
today, so the decision would have been a claim about configurability rather than a change in
behaviour — and the failure mode it exists to prevent would survive untouched in the common case.
`HEAD` stays available as something a project **writes down**; what it stops being is what happens
when nobody chose.

**The second reason, which is the one that matters for Stage 4:** stacked work becomes expressible.
Every ticket file in this project says the same thing — *T2 branches off T1, never off `develop`* —
and until a task can name a base, a chain physically cannot honour it. A nine-step chain whose steps
all branch from the same sha is nine parallel attempts, not a sequence.

**Rejected: infer the base from the previous step's branch.** It is right most of the time, which is
what makes it dangerous: the times it is wrong are the times a step was re-run or skipped, and an
inferred base is not visible anywhere for a human to check. A declared one is a column.

---

## D39 — The workspace is prepared by a declared command, which may reach the network (2026-08-22)

**Spec:** [`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md) §3.5.

`git worktree add` produces a checkout with **no `node_modules`**. Nothing in the execution layer
installs anything — verified 2026-08-22 by grep: no `pnpm install` exists anywhere under `lib/` or
`app/`. So a session in this repo cannot run `pnpm verify`, `pnpm type-check`, or a single test.
`CLAUDE.md`'s own instruction for hand-made worktrees is *"`pnpm install` in it, and hand the agent
the path"* — the automated path skips the step the manual path requires.

**Decision:** `agentos.yml` gains an optional `prepare:` key, run as a child process inside the
worktree **before** the model call — on a first dispatch **and on an inbox resume**, which builds its
own fresh worktree and would otherwise reach the model with no dependencies. A non-zero exit
**refuses the dispatch** — no session row, no cost, worktree removed, **and the branch D37 created
deleted**. Absent key → skipped, and `prepareExitCode` stays `null`, never `0`.

**The command is argv with a declared timeout, not a shell string.** Two corrections from review of
#33, both of which the first person to run this would have hit: the project's child-process helper
uses `execFile`, which does not tokenize or invoke a shell, so `pnpm install --frozen-lockfile` as
one string is looked up as an executable with that whole name; and its 15-second default — right for
`git rev-parse` — would kill a cold install partway and report it as a broken repo. Argv also
removes quoting rules and any injection surface, and leaves `["sh","-c","…"]` available as something
the owner writes out on purpose rather than gets by accident.

**Refusing rather than warning, because of what proceeding costs.** A workspace with no dependencies
is one where the first command the agent runs fails for a reason that has nothing to do with the
task, and the next twenty turns are spent diagnosing *our* bug on the owner's budget. Refusing costs
nothing.

**This is inside D19's carve-out, and the boundary is who wrote the command.** Invariant 1 permits
an execution layer *the model API, and the hosts a session's environment explicitly allow-lists.* A
command typed by hand into the project's own `agentos.yml` **is** that allow-list — the owner
declaring it, in a file the owner owns, read at dispatch time. **What the product may never do is
suggest, default, or infer it.** Inferring `pnpm install` from the presence of `pnpm-lock.yaml` is
the obvious convenience and it is the line: a lockfile is not consent to execute a package manager,
and any repo that grew one would start running an install nobody authorised.

**Rejected: symlink or copy the owner's `node_modules` into the worktree.** Faster, and it hands a
session a path into the checkout the owner is actively working in — the one thing the ephemeral
worktree exists to prevent. Paying the install cost honestly is the correct trade; a content-
addressed cache is a `docs/BACKLOG.md` entry if it ever hurts enough.

---

## D40 — Verification is run by the runner, and never reported by the session (2026-08-22)

**Spec:** [`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md) §3.6.

**A session saying "the tests pass" is a claim.** This product exists because claims and reality
diverge, and Invariant 2 — *never assert without a check* — is stated to apply to the dashboard
*about itself*, not only about the projects it watches. A session's own account of its work is
exactly the class of statement the whole system refuses to take at face value from anyone else.

**Decision:** `agentos.yml` gains an optional `verify:` key, run by the runner as a child process
**after** the model call settles and **before** teardown. Its exit code and the last 40 lines of
output land on the `Session` row. The session is never asked, and nothing it says is recorded as the
answer.

**The two facts are recorded separately and neither may hide the other.** `Session.status` reports
what the *run* did; `verifyExitCode` reports what the *code* does. A session that correctly reported
a pre-existing red suite is a successful run over broken code, and collapsing the two would render
it as a crash. This is the same rule `dispatch.ts` already applies to a teardown failure, which is
appended to the reason rather than reclassifying a completed run as failed.

**AC-7 is written adversarially on purpose:** a `FakeRunner` scripted to announce success while the
verify command exits non-zero, asserting the recorded result is the child process's. A test where
the session's claim and the check agree proves nothing about which one was read — the
specimen-not-behaviour trap `docs/LEARNINGS.md` records from Stage 1's AC-2.

---

## D41 — Push and PR are one human click; merge is not the product's to make (2026-08-22)

**Spec:** [`stage-4b-delivery.spec.md`](specs/stage-4b-delivery.spec.md) §3.8.

Pushing a branch is the first thing this product does that **publishes** — that puts bytes somewhere
other people read. It is *not* the first thing that touches the network, and the first draft of this
decision said it was: D39 one entry earlier permits an owner-declared `prepare:` command to reach a
package registry, and `gh` and the model API were always permitted. Raised in review of #33, and the
distinction is the load-bearing part — **egress is not the boundary here, publication is.** Invariant
4 gates writes; D19 moved the execution layer's gate from per-write to **per-session, authorised at
spawn** — and a push is not a write inside the granted manifest. It is a shared remote that
teammates, CI, and anyone watching the repo will see.

**Decision, three parts:**

1. **Push and PR happen on one explicit human click**, on a settled session that has a branch and at
   least one commit. Never automatically on completion.
2. **One click does the whole gesture** — push, `gh pr create` against the project's
   `integrationBranch` (default `develop`), store the URL. Not three confirmations. A gate people
   learn to click through three times is one gate with worse copy; the honesty lives in the label,
   which names the branch and the base: *"Push `agentos/…` & open PR → develop"*. Same reasoning as
   Stage 2's approval copy and Stage 4 §5.3's chain gate.
3. **The product never merges.** `CLAUDE.md` is already explicit — *the agent never merges, not its
   own PR, not any PR; the agent's output is a PR, and that is where its authority ends.* Stage 4b's
   AC-11 asserts `gh pr merge` and `git merge` appear in no shipped source file.

**Why a source-level assertion for part 3, which looks crude.** It is an invariant, and an invariant
enforced only by everyone remembering not to violate it is enforced by nobody — the same argument
`local.ts` makes for forcing `WebFetch`/`WebSearch` into `disallowedTools` on every composed call
rather than trusting the seed row. The `gh` seam being an injected argv-taking function makes the
same rule checkable behaviourally as well.

**Rejected: push automatically, gate only the PR.** A pushed branch is already visible to everyone
watching the repo and already triggers CI. The moment it leaves is the moment to ask.

---

## D42 — An explicitly empty template variable is refused in `bindPrompt`, not at the form (2026-08-22)

**Spec:** [`stage-4-templates-chains.spec.md`](specs/stage-4-templates-chains.spec.md) §3.3, AC-2.
Ticket: [`stage-4-tickets.md`](specs/stage-4-tickets.md) T4, "one open question you must answer."

**The gap T2 left, correctly, and T4 made reachable.** `bindPrompt` (`lib/agentos/chain-render.ts`)
decided "missing" with `Object.prototype.hasOwnProperty` alone, because AC-2's own wording is *"with
`branchName` **omitted**"* and nothing but `scripts/verify-stage4.mts` could call the function yet —
an absent key is the only shape a suite produces without inventing one. T4 adds the instantiate form
on the Tasks board (`components/tasks/InstantiateForm.tsx`), and an HTML form submits a blank field
as `vars.branchName === ""`, not as an absent key. `hasOwnProperty` alone would have bound that to
*"create a branch named  and implement"* and let it run — spec §3.3's own example of the failure
this stage exists to prevent, reachable through the UI for the first time.

**Decision: `bindPrompt` refuses `""` the same as an absent key.** Two candidates were on the table:
(a) refuse a blank field at the form's own edge, leaving `bindPrompt` literal about "omitted"; (b)
make `bindPrompt` itself treat an explicit empty string as missing, so the rule holds regardless of
caller. **(b) is what shipped.** It is the stricter reading and it cannot be bypassed by a second
caller — a future trigger (goal, cron, webhook; `TriggerKind` already names all four) that calls
`instantiateTemplate` directly, never touching this form, gets the same protection for free. (a)
alone would leave exactly the gap this decision closes: a caller that skips its own edge check
reopens the hole `bindPrompt` was supposed to have closed at the source.

**The form also carries an HTML `required` attribute on every variable field — decoration, stated as
such.** It stops a native submit one keystroke earlier, which is worth having, but a crafted POST
bypasses it exactly as it bypasses any client-side check; `bindPrompt`'s own refusal is what
actually holds. Belt-and-suspenders was considered and rejected as *two* systemic fixes — the
`required` attribute is UX only, not a second copy of the rule, so there is no divergence to keep in
sync.

**AC-2 grew a third case rather than a new AC number.** The spec's own AC-2 already asserts "refuses
an unbound variable, no cards written"; the empty-string case is the same rule under a different
shape of "unbound," not a new behaviour, so it lives in AC-2 alongside the omitted-key case rather
than as an AC-2b. `[G]`: the guard was proven by reverting the `|| vars[name] === ""` clause,
observing AC-2 go red on the new case, and reverting.

**Rejected: silently trim and treat whitespace-only as empty too.** Tempting, and out of scope —
nothing in §3.3 discusses whitespace, and inventing a normalisation rule here would be deciding a
second, unasked question under cover of the first. If a whitespace-only prompt ever turns out to be
a real problem, that is its own decision, not a rider on this one.

---

## D43 — A `blocked` chip refuses moves; it is not a label (2026-08-22)

**Raised in review of #38, and it changes a sentence Stage 3 wrote deliberately.**

Stage 3 §7.6 introduced `Task.blockedReason` as *"a label on the card, not a fifth status value"*,
and [`types.ts`](../lib/agentos/types.ts) still says so. That was **accurate when nothing produced
one**: through Stage 3 the field was always null, so "label" described its entire behaviour.

Stage 4 produces **eight per chain**. Instantiating the seeded template writes nine cards, eight of
them blocked, and §3.2 defends that on the grounds that *"nine visible cards, eight of them blocked,
is a forecast the human can read, argue with, and cancel."* Review of #38 found that the forecast
was not binding on anything: `showsRunControl` checked only the column and the agent, so every
blocked step rendered a **Run now** button; `dropVerdict` ignored the field entirely, so step 6 could
be dragged into `doing` before step 5 had ever started; and `dispatch` refused neither.

**A label that refuses nothing is a claim the interface makes and the system does not honour** —
invariant 2, on the one surface where the product's own subject matter applies to itself.

**Decision:** `blockedReason` is enforced at three points, none of which adds a status:

1. **`dropVerdict`** returns a new `kind: "blocked"` refusal — so the drag and `moveTaskForSlug`,
   which calls it, are refused by the same shared decision (D33's rule that a drop is a hand-move
   evaluated in one place).
2. **`showsRunControl`** returns false, so the affordance stops contradicting the chip beside it.
3. **`dispatch`'s `dispatchable` precondition** refuses it, which is what makes the other two an
   honest surface over a real rule rather than the rule itself. Every start passes through §7.3
   whatever triggered it, so no other caller can route around the first two.

**It stays a label and not a status**, exactly as §7.6 intended: there is no sixth column, nothing
queries for "blocked" as a state, and the reason clears itself the moment the predecessor finishes
(`advanceChainAfterDone` nulls it *before* dispatching, which is why the chain's own advance is
unaffected by this decision).

**Rejected: leave it advisory and rely on the human reading the chip.** That is the argument for
every unenforced convention this project has already refused — and it fails worse here than usual,
because running a step early does not look like a mistake afterwards. It goes through the funnel,
records a session and a drift snapshot, and produces work that appears entirely legitimate.

**Not a decision, recorded here because it landed in the same review:** `approveDoneForSlug` now
refuses anything that is not a gated card in `review`. That is not a new rule — §7.6 and D36 are
both still right that *"the gate exists to stop a session, never a human"* — it is the action
re-deriving **what it is being asked to approve** instead of trusting that the UI only ever offered
it a legitimate card. Stage 2 established that shape when the fix-proposal action rebuilt its
proposal server-side from the claim hash rather than accepting bytes from the browser.
