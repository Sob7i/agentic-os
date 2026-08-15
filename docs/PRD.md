# Agentic OS — Product Requirements

> **Status:** written 2026-07-26 · **decision-closed 2026-07-27** — every decision in §9 is
> answered; nothing is blocked on one. Building may start.
> **Owner:** Sobhi · **Harness:** [itqan](https://github.com/Sob7i/itqan) — data model **and**
> installed framework (installed 2026-07-27; see [`DECISIONS.md`](DECISIONS.md) D1).
> **Paired doc:** [`DESIGN-BRIEF.md`](DESIGN-BRIEF.md) — the wireframe brief for §6.1–6.4 and §6.8.
> Changes to the feature set here update that brief in the same PR (`paired-docs-update-together`).
> Round-1 wireframes: [`../design/wireframes.pen`](../design/wireframes.pen) — Concept C chosen.
>
> **Decision state lives in [`DECISIONS.md`](DECISIONS.md), not here.** §9 is a routing table
> to it. This document holds the problem, the features, and the build order.

---

## §1 — The problem, stated precisely

Five projects are active: **salla-apps** (the `hadaya/` directory), **nadim**, **itqan**,
**fractal-code**, **my-personal-website** — plus **agentic-os** itself (D9), which appears in its own board. Each
is worked by agents across sessions. Each carries state documents that claim where things stand.

**Those claims go stale, silently.** This is not hypothetical — it is the single most
evidenced failure mode in the existing system:

- nadim's `docs/HANDOFF.md` opens with a warning it wrote about itself: *"It was caught stale
  twice already."* Then a third catch is logged inside it.
- itqan's session-start ritual (in the itqan repo) exists because *"a state doc claimed 'no remote' while
  four PRs sat merged on GitHub."*
- **Verified live while writing this PRD (2026-07-26):** nadim's HANDOFF states *"PRs #1
  through #22 merged"* and describes #22 as the frontier. Reality on GitHub: **#23 is merged
  and #24 has been open since 2026-07-14.** The document is two PRs behind, and has been for
  twelve days.

That last item matters more than the others: it was found *by hand*, in about four seconds of
`gh pr list`, by following a ritual that is written down and works. The ritual is sound. The
problem is that it is **manual, per-repo, and only runs when a session starts.** Five repos ×
every session is a tax paid in attention, and drift that appears between sessions is invisible
until someone happens to look.

**The one-line diagnosis:** the system already knows how to verify claims against reality; it
just has no standing surface that does it continuously. Agents are cheap enough to run all five
projects at once, but a human's ability to know *which claim is currently a lie* has not scaled
with them.

### What this is not

It is not a usage dashboard. The reference screenshot (Devin's usage/billing view: PRs created,
merge rate, `$`/PR, spend over time) is a **retrospective metrics** product — it tells you what
a quarter cost. That view is worth having and is included, but it is demoted to a secondary
panel, because knowing you merged 420 PRs at $30.31 each does not tell you that nadim's HANDOFF
is lying to the next agent that reads it. Cost is a number you review monthly. Drift is a fact
that corrupts the next session's premise.

---

## §2 — The product, in one paragraph

**Agentic OS is a local dashboard that continuously runs itqan's session-start ritual across
every project at once, and shows only what disagrees with reality.** It reads what your state
documents *claim* (HANDOFF/COMPASS "next up", PR states, feature status, open decisions) and
what git, GitHub, and the filesystem *say is true*, then ranks the gaps by how badly they would
mislead the next agent to read them. Everything else it knows — spend, sessions, skills,
velocity — sits behind that headline, because it is context, not a call to action.

**It has two pillars, and the second depends on the first.** The **Board** (§6.1) *verifies* —
it looks backward and asks "is what the docs say still true?" The **Overview** (§6.8) *plans* —
it looks forward and asks "what do the docs say we're doing, and what's blocking it?" They read
the same seven roles from the same files. The order matters: **a plan derived from a document
that is twelve days stale is not a plan, it is a guess.** Which is why the Overview inherits its
trustworthiness from the Board, and says so on every item — see §6.8.1, the one thing this
product can do that a general-purpose planning tool structurally cannot.

> **Re-scoped 2026-08-15 — a third pillar, one layer down.** Everything above describes the
> **portfolio layer**, and remains true of it. Beneath it there is now an **execution layer**: per
> project, opt-in, an AgentOS that runs the work rather than watching it — agents, tasks, goals,
> inbox, sessions, templates, costs. **§12 is the section to read for it**, and §§1–11 should be
> read as describing the layer above. The two are not rivals: verification is what makes execution
> safe to leave alone, which is the argument §12.1 makes in full. Decisions: **D18–D22**.

---

## §3 — Design principles

1. **A green row is worth as much as a red one.** "itqan: docs in sync, verified 4 seconds ago"
   is the product's core value — it converts *unverified* into *verified*. A dashboard that only
   shows problems makes you wonder whether it ran.
2. **Never assert without a check.** The dashboard is itself bound by `verify-before-claim`. Every
   cell shows what was checked and when; nothing is cached past its staleness horizon without
   being visibly marked as such.
3. **Reality wins, and the doc is a hypothesis.** Git and GitHub are ground truth. State docs are
   *last-known claims by a session that is not this one*. The UI must never present a doc's claim
   with the same visual weight as a verified fact.
4. **Read-only by default; writes are gated.** The dashboard observes. Where it can fix drift
   (§6.2), the fix is *proposed as a diff and requires a click* — never auto-applied. This is
   `never-silently-tag` and `no-self-merge` generalized: the system does not edit the owner's
   record without approval.
5. **Zero ceremony to run.** If checking it costs more than the ritual it replaces, it will not
   get used. One command, always-on, no login.
6. **Local-first, no egress.** Session transcripts contain source code, keys, and business logic.
   Everything is parsed on-machine. No telemetry, no cloud, no exceptions.
7. **Pain-gated growth.** Ship P0 alone. Every later panel waits for its pain to be *felt*,
   per itqan's principle 6 — comprehensive systems are avoidance.

---

## §4 — The data model: itqan's seven roles

The dashboard does not invent a schema. It reads the **seven-role spine** from `docs/SPEC.md`
§3, which every itqan-instantiated project fills at any scale. This is what makes it work
across five heterogeneous repos without per-repo configuration.

| Role | Question | Lite source | Full source | Dashboard use |
|---|---|---|---|---|
| **Router** | where is everything | `CLAUDE.md` | `CLAUDE.md` | Discover which docs to read; verify commands |
| **State** | where are we, what's next | `docs/HANDOFF.md` | `COMPASS.md` + `handoffs/` | **Primary drift subject** |
| **Queue** | what's decided and ready | "Next up" list | `docs/specs/*.spec.md` | What should be in flight |
| **Decisions** | why we chose X | `docs/DECISIONS.md` | + COMPASS ledger | Open vs. closed count; the real bottleneck |
| **Lessons** | what not to re-buy | `docs/LEARNINGS.md` | `MISTAKES.md`→`KNOWLEDGE.md` | Distillation backlog depth |
| **Behaviour** | what it does *today* | `docs/FEATURES.md` | + `docs/releases/` | Behaviour-map staleness vs. shipped code |
| **Record** | what changed, when | git history | `CHANGELOG.md` | Ground truth for the diff |

**Current adoption is partial, and the dashboard must tolerate that.** Measured 2026-07-26:

**Corrected 2026-07-27** — an earlier version of this table checked only lite-profile paths and
under-reported salla-apps as "Router only". Role detection must check full-profile alternates
(`MISTAKES.md`/`KNOWLEDGE.md` for Lessons, `docs/specs/` for Queue, `COMPASS.md` for State) —
see `docs/specs/stage-1-reconciliation.spec.md` §3.3.

| Project | Router | State | Queue | Decisions | Lessons | Behaviour | Record | Profile |
|---|---|---|---|---|---|---|---|---|
| salla-apps (`hadaya/`) | ✅ | — | ✅ 13 specs | — | ✅ split | — | ✅ | full, **missing State** |
| nadim | ✅ | ✅ HANDOFF | ✅ | ✅ | ✅ | — | git | lite |
| itqan | — | — | — | — | — | — | ✅ | framework repo (not an instance) |
| fractal-code | ✅ | — | — | — | — | — | git | router only |
| my-personal-website | ✅ | — | — | — | — | — | git | router only |
| **agentic-os** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | git | lite + `docs/specs/` (2026-07-27) |

**Consequence for the design:** only nadim and this project fill the State role — and **State is
the primary drift subject.** A project without it cannot produce a claim-vs-fact drift at all,
which makes `unverifiable` a required fourth result state, distinct from in-sync (spec §3.4).
salla-apps is the sharpest case: 13 specs and a 516-line knowledge base, and no document saying
where it stands.

**Branch and dirty-count data is deliberately not in this table.** It changed materially within
24 hours of first being recorded (fractal-code moved branch; salla-apps' commit age shifted).
Live facts belong on the Board, computed; a document that hardcodes them is drift waiting to
happen — as this table already demonstrated. A dashboard that
requires the full spine would show one row and four blanks. So role coverage is itself a
first-class metric — the **Adoption** column (§6.1) shows which roles each project fills, making
the gaps visible and turning the dashboard into an install driver rather than an install
prerequisite. Every panel degrades gracefully: absent role → "not instantiated," never an error.

---

## §5 — Data sources

All local. All read-only.

| Source | Path / command | Provides | Cost |
|---|---|---|---|
| Session transcripts | `~/.claude/projects/**/*.jsonl` | tokens, model, cost, cwd, branch, timestamps, PR links | 170 MB / 137 files — needs incremental parsing |
| Git | `git -C <repo>` | branch, dirty count, ahead/behind, last commit, tags | cheap |
| GitHub | `gh` CLI (authenticated as `Sob7i`) | PR state, review decision, CI, merged-at | rate-limited — cache |
| itqan docs | repo markdown per §4 | the *claims* to reconcile | cheap |
| Skills | `~/.claude/skills/` (42), plugins, project `.claude/` | inventory, last-modified | cheap |
| Settings | `~/.claude/settings.json` | model, effort, enabled plugins | trivial |

**Transcript schema, verified against a real file:**

```jsonc
// ~/.claude/projects/<slug>/<session-uuid>.jsonl — one JSON object per line
{ "type": "assistant", "timestamp": "…", "sessionId": "…",
  "message": { "model": "claude-sonnet-4-6",
    "usage": { "input_tokens": 3, "output_tokens": 400,
               "cache_creation_input_tokens": 16538,
               "cache_read_input_tokens": 11546,
               "service_tier": "standard" } } }
{ "type": "user", "cwd": "/Users/…/hadaya", "gitBranch": "develop",
  "version": "2.1.177", "isSidechain": false, … }
```

Other observed `type` values: `pr-link` (PRs opened per session — the direct join between a
session and its output), `ai-title` (human-readable session names), `queue-operation`,
`attachment`, `file-history-snapshot`, `last-prompt`. `isSidechain: true` marks sub-agent
turns, enabling a delegation-cost split. `cwd` + `gitBranch` attribute every session to a
project and branch **without any configuration.**

**Prior art worth borrowing rather than reinventing** (all parse these same JSONL files):
[ccusage](https://github.com/ryoppippi/ccusage) — the reference cost-attribution CLI, including
5-hour block accounting; [claude-code-stats](https://github.com/AeternaLabsHQ/claude-code-stats)
— self-contained HTML report generation; [claude-usage](https://github.com/phuryn/claude-usage)
— localhost dashboard with model filters and bookmarkable date ranges;
[ccusage-graphs](https://github.com/jeremyeder/ccusage-graphs) — SQLite backend and Grafana
export. **Recommendation:** take pricing tables and block accounting from ccusage's approach
rather than hand-rolling cost math (it is the part most likely to be subtly wrong), and own the
reconciliation layer, which is what none of them do.

---

## §6 — Features

Priority reflects itqan's pain-gating: **P0 is the product.** P1 and P2 wait for felt pain.

### 6.1 · P0 — The reconciliation board *(the headline)*

One row per project, sorted by severity. The whole point is that this is the first and often
only thing you read.

```
AGENTIC OS                                    5 projects · verified 4s ago  ⟳

⚠  nadim              HANDOFF claims "PRs #1–#22 merged" → #23 merged, #24 open 12d
   feat/desk-4a-prototype · 1 dirty · doc stale 12d
   Roles: Router ✅  State ✅  Queue ✅  Decisions ✅  Lessons ✅  Behaviour —  Record ✅
   → [review diff]  [open PR #24]  [mark verified]

⚠  salla-apps         9 uncommitted files · develop last commit 21h ago
   No state doc — Router only. 1 PR open.
   Roles: Router ✅  State —  Queue —  Decisions —  Lessons —  Behaviour —  Record ✅
   → [install itqan state role]

○  my-personal-website  feature/phase-5-polish · 7 dirty · 3w since last commit
   Roles: Router ✅  · 1 PR open, no review

○  fractal-code       develop · 5 dirty · 2d ago · 1 PR open
   Roles: Router ✅

✓  itqan              docs/changelog · in sync · 1 dirty
   Roles: self (framework repo) · 0 PRs open
```

**Drift checks (P0 set).** Each is a falsifiable comparison, not a heuristic:

| # | Check | Claim source | Reality source | Severity |
|---|---|---|---|---|
| D1 | PR status mismatch | state doc PR references | `gh pr list` | ⚠ high |
| D2 | "Next up" already done | state doc next-action | git log / merged PRs | ⚠ high |
| D3 | State doc older than last commit | doc mtime / dated header | `git log -1` | ⚠ high |
| D4 | Uncommitted work | — | `git status --porcelain` | ○ medium |
| D5 | Branch ahead/behind remote | — | `git rev-list` | ○ medium |
| D6 | Open PR with no review, aging | — | `gh pr list` + `updatedAt` | ○ medium |
| D7 | Stalled: no commit in N days | — | `git log -1` | ○ low |
| D8 | Role coverage gaps | — | file existence per §4 | ○ low |

Every row states **what was checked and when.** Green rows carry the same weight as red — a
verified-in-sync project is a delivered result, not an empty state.

### 6.2 · P0 — Fix proposals *(gated)*

When drift is detected, the dashboard drafts the correction — a markdown diff to the stale
state doc — and **waits.** Approve to write; the write goes into the working tree as an
uncommitted change, and the commit remains the owner's. Rejecting logs nothing. Approving
appends the dated `LEARNINGS.md` line that `session-start.md` step 4 requires, in the same
change, satisfying `paired-docs-update-together`.

This is the feature that turns the dashboard from a nag into a tool: seeing that nadim's
HANDOFF is twelve days stale is useful; being handed the corrected paragraph is what makes
the fix actually happen.

### 6.3 · P1 — Usage and cost *(the screenshot's territory)*

Behind the headline, collapsed by default. Everything here is derivable from §5's transcript
schema:

- **PR funnel** — created / merged / merge rate / **$ per merged PR**, from `pr-link` entries
  joined to `gh` state. This is the screenshot's top row, and the join is exact rather than
  estimated, because the transcript records which session opened which PR.
- **Spend over time** — stacked bars by project or model, daily/weekly/monthly, matching the
  screenshot's chart form.
- **Cache efficiency** — `cache_read` vs. `cache_creation` vs. fresh input. Given the observed
  ratio (11.5k read / 16.5k created / 3 fresh in a single message), this is where real money
  is, and no dashboard in §5's prior art foregrounds it.
- **Delegation split** — `isSidechain` separates sub-agent spend from lead spend, making
  itqan's model-tiering guardrail measurable rather than aspirational.
- **Model mix** — per-project distribution against the tiering rule.

> **A caution to record now:** the screenshot reports "Merge time reduction: −403%" and "Bugs
> caught: 0". Both are almost certainly artifacts of a metric nobody validated. Any derived
> metric here ships with its formula visible on hover, or it does not ship — a dashboard that
> confidently displays a wrong number is worse than one that omits it.

### 6.4 · P1 — Decision queue *(the actual bottleneck)*

itqan's central claim is that **decision availability, not build capacity, is the constraint.**
If true, the highest-value panel after drift is the one showing where the system is *waiting on
Sobhi*:

- Open decisions across all `DECISIONS.md` files, with age.
- Specs in `docs/specs/` that are **not** decision-closed — the queue blocked upstream of code.
- Human gates currently pending: PRs awaiting merge approval, proposed version bumps awaiting
  the `never-silently-tag` approval, `BLOCKED` pages.
- **Time-to-close distribution** — the one number that says whether the bottleneck is real.

### 6.5 · P2 — Skills and capability inventory

42 global skills, plus plugins and per-project `.claude/`. Surface: what exists, which were
actually *invoked* (greppable from transcripts), last-modified, and unused-since. Answers "what
have I built and forgotten," and prunes.

### 6.6 · P2 — Session and activity stream

Recent sessions with AI titles, duration, cost, project, branch, PRs opened. Filterable. The
forensic layer for "what did that expensive Tuesday actually produce."

### 6.7 · P2 — Behaviour-map drift

For projects with `FEATURES.md`: compare the behaviour map's last update against merged PRs
that touched application code. Directly enforces itqan's highest-stakes paired-doc rule — the
one the framework calls out by name.

### 6.8 · P1 — The Overview *(the second pillar)*

**The question it answers:** across all projects — what's in flight, what's ready to build,
what's blocked on me, what shipped recently, and what does the coming week look like?

Today that answer requires opening five repos and reading `HANDOFF.md`, `ROADMAP.md`,
`BACKLOG.md`, `docs/specs/*.md`, and `CHANGELOG.md` in each. The information exists and is
well-maintained; it is simply **scattered across 5 repos × 6 file types**, so the portfolio-level
view — the one that decides what to work on next — exists nowhere.

#### 6.8.1 · Verified provenance — why this belongs in *this* product

Linear, Jira, and Notion all render a nicer board than this will. **None of them can do the one
thing that matters here:** their board is a set of statuses a human remembered to update, and
nothing checks them. This product already computes, per project, whether the source documents
agree with git — so every item on the Overview can carry that provenance:

| Provenance | Meaning | Presentation |
|---|---|---|
| **verified** | drawn from a doc the Board confirms is in sync | stated plainly |
| **suspect** | drawn from a doc with active drift | shown, visibly qualified, with the drift linked |
| **derived** | computed from git/GitHub directly, not a doc | stated plainly (strongest source) |

**Consequence:** nadim's roadmap items are currently **suspect** — its HANDOFF is 12 days stale,
so "next up" may already be done. The Overview must not launder that into a confident plan.
Every other planning tool would show those items as fact. **This is the feature's entire reason
to exist inside Agentic OS rather than as a separate tool.**

#### 6.8.2 · Data sources ✅ verified to exist

Measured across the real repos on 2026-07-26 — this is not a hypothetical schema:

| Band | itqan role | Source | Evidence found |
|---|---|---|---|
| **In flight** | State / Record | open PRs; specs marked *build in progress* | 4 open PRs; `monorepo-step-1` = "build in progress" |
| **Ready** | Queue | `docs/specs/*.md` with `☑` status | **8 of 13** hadaya specs are `☑` decision-closed |
| **Blocked** | Decisions | `☐` specs + open decisions + human gates | **5 of 13** are `☐` design-closed-but-gated |
| **Shipped** | Behaviour / Record | merged PRs, `CHANGELOG.md`, tags | hadaya `v0.5.2`, `v0.5.1`, `v0.5.0`; 309-line changelog |
| **Deferred** | — | `BACKLOG.md`, each with `Unblocked by:` | nadim: 10 entries, all with explicit unblock conditions |
| **Milestones** | Record | git tags + CHANGELOG headings | hadaya tagged; nadim deliberately untagged |

**The status glyph is the machine-readable contract.** Hadaya's specs open with a `status:` line
whose leading glyph is reliable — `☑` = decisions closed / buildable, `☐` = design closed but
gated. The **prose after the glyph is not** reliable: observed variants include "decisions closed
— build approved", "IMPLEMENTED & GREEN", "CLOSED (spec-closed)", and "DESIGN-CLOSED —
build-GATED". So: **parse the glyph, display the prose verbatim, never parse the prose.** This is
`external-API-fields-are-guilty-until-verified` applied to your own documents.

`BACKLOG.md`'s `Unblocked by:` convention is similarly load-bearing — nadim uses it on all 10
entries. It converts a backlog from a graveyard into a queue with entry conditions, and the
Overview should surface it as *the* reason an item is not moving.

#### 6.8.3 · The time axis — honest about the fact that you don't run sprints

The ask was "what the week/sprint looks like." **There are no sprints in this system, and
inventing them would be a lie the dashboard then has to maintain.** itqan is gate-driven: work
moves when a decision closes or an owner approves, not when a fortnight elapses. Burndown charts,
velocity points, and sprint boundaries would all be fabricated ceremony — and PRD §6.3 already
commits to not shipping metrics nobody validated.

**What is real and time-shaped**, and what the week view should therefore be built from:

- **Movement** — PRs opened/merged, commits, specs that changed status, tags cut, in the last 7
  days. All derived from git. Fully trustworthy.
- **Age as pressure** — how long each blocked item has been blocked. nadim's HANDOFF has been
  stale 12 days; some decisions are older. *Age is the honest substitute for a deadline* in a
  system with no deadlines.
- **Stated intent** — the "Next up" list in each state doc. Real, but only as trustworthy as the
  doc (§6.8.1).

So the week view is a **retrospective of what moved + a queue ordered by what's been waiting
longest**, not a forecast. If a forecast is ever wanted, it must be gated on evidence that
estimates would be accurate — and nothing in the current data suggests that.

#### 6.8.4 · Scope boundary

The Overview is **read-only, like the Board.** It does not create tasks, assign work, set due
dates, or track effort. The moment it accepts input that lives nowhere else, it becomes a second
source of truth that can itself drift — and this product exists because of drift. **Every item on
the Overview traces to a file in a repo.** Editing happens in those files, by an agent or by you,
through the normal ritual.

---

## §7 — Architecture

```
agentic-os/
├── CLAUDE.md                    # router (itqan installs onto this project itself)
├── docs/
│   ├── PRD.md                   # this file
│   ├── HANDOFF.md               # state role
│   ├── DECISIONS.md             # decisions role
│   ├── LEARNINGS.md             # lessons role
│   └── FEATURES.md              # behaviour role
├── app/                         # Next.js App Router — dashboard UI
├── lib/
│   ├── collectors/
│   │   ├── transcripts.ts       # ~/.claude/projects/*.jsonl (incremental)
│   │   ├── git.ts               # per-repo git state
│   │   ├── github.ts            # gh CLI, cached
│   │   ├── itqan-docs.ts        # seven-role parser
│   │   └── skills.ts            # skill/plugin inventory
│   ├── reconcile/               # ← the product; drift checks D1–D8
│   └── cost/                    # pricing + 5-hour block accounting
├── data/
│   ├── cache.sqlite             # parsed transcripts, incremental by mtime+offset
│   └── verified.json            # owner "mark verified" acknowledgements
└── projects.config.ts           # the 5 repos; explicit, not auto-discovered
```

**Stack:** Next.js (matches every other project you run), TypeScript, SQLite cache, server-side
collectors. Charts: a lightweight library, applying the `dataviz` skill's conventions.

**Performance.** 170 MB across 137 transcripts cannot be re-parsed per request. Parse
incrementally — track `(file, byte-offset, mtime)`, append new lines only — into SQLite.
Cold build seconds; warm refresh milliseconds. Git and `gh` collectors run on a short TTL with
`gh` results cached hardest (rate limits).

**Freshness.** Drift checks re-run on load and on a timer. Every panel shows its own
last-verified timestamp; stale panels visibly gray out rather than showing confident stale
numbers — principle 2, applied to the dashboard's own claims.

**Security.** Everything local; no network egress except `gh` to GitHub's API. Transcripts
contain secrets and source; they never leave the machine. `data/` is gitignored.

---

## §8 — Itqan as harness, in both senses

**As data model** — §4. The seven roles are the schema; the dashboard is a reader of itqan
instances.

**As installed framework** — agentic-os has itqan installed on itself per `INSTALL.md`
(**done 2026-07-27**, lite profile + `docs/specs/`; see `docs/DECISIONS.md` D1). Three reasons
this is not ceremony:

1. **Dogfooding finds the gaps.** A tool that reads the spine, built by a project that fills
   the spine, will surface every ambiguity in the templates. itqan is at Stage 2 with one cold
   install (nadim #9) behind it; this is the second real install, and `INSTALL.md` gets tested
   in anger.
2. **The dashboard must appear in its own board.** If agentic-os cannot show itself as a green
   row, it does not work. Self-inclusion is the acceptance test.
3. **The rules already fit.** `verify-before-claim` *is* the product thesis. `paired-docs-update-
   together` is check D3 generalized. The framework's standing rules are this product's
   requirements, restated.

**A gap to feed back upstream:** itqan's rituals are written for a human or agent to *execute*.
Nothing in the spec anticipates a *continuous* reader of instantiated state. If this works, the
finding for itqan is that the seven-role spine has a machine-readable contract hiding in it —
and that contract would benefit from small, deliberate conventions (a dated header format, a
canonical PR-reference syntax) that make reconciliation exact rather than heuristic. That is a
proposal for itqan, gated on this project proving the value first.

---

## §9 — Decisions

> **Superseded 2026-07-27.** Decision state now lives in [`DECISIONS.md`](DECISIONS.md), which
> is authoritative. This section is a routing table only — it records where each PRD decision
> went, so a reader of this document can follow the trail. **Do not record decision state here
> again**; two files holding the same status is precisely the drift this product exists to
> catch.

**All decisions are closed.** D1–D3 answered by the owner 2026-07-26; D4–D11 answered
2026-07-27. Nothing is blocked on a decision.

| Was (PRD) | Decision | Now |
|---|---|---|
| D1 | Primary job: drift reconciliation, usage secondary | [D2](DECISIONS.md) |
| D2 | Delivery: local Next.js app + collectors | [D3](DECISIONS.md) |
| D3 | itqan as data model **and** self-install | [D4](DECISIONS.md) |
| D4 | Claim parsing: heuristics + confidence, not required markers | [D5](DECISIONS.md) |
| D5 | "Mark verified" writes locally only | [D6](DECISIONS.md) |
| D6 | Cost basis: compute both; API-equivalent is the headline | [D7](DECISIONS.md) |
| D7 | Refresh: on-load only | [D8](DECISIONS.md) |
| D8 | Scope: the named projects only | [D9](DECISIONS.md) |
| D9 | Remote and PRs; agentic-os watches itself | [D10](DECISIONS.md) |
| D10 | The Overview stays strictly read-only | [D11](DECISIONS.md) |
| D11 | The decision queue folds into the Overview | [D12](DECISIONS.md) |
| — | Profile: lite + `docs/specs/` *(install ADR)* | [D1](DECISIONS.md) |
| — | Branch model: feature → develop → main | [D13](DECISIONS.md) |

Two of these changed the product's shape rather than just settling a detail: **D7** (cost) now
ships both bases with API-equivalent leading, and **D11** (decision queue) folds §6.4 into the
Overview's *Blocked* band rather than being its own screen.

---

## §10 — Build order

Gated. Each stage ships and gets used before the next is justified.

**Stage 1 — Prove the reconciliation.** Collectors for git, `gh`, and itqan docs. Checks D1–D8.
The board (§6.1). No transcripts, no charts, no cost.
*Acceptance:* it independently rediscovers nadim's HANDOFF drift — the instance verified by hand
in §1 — and shows itqan as green.
**Shipped 2026-07-27** — acceptance met; `pnpm verify:stage1`.

**Stage 2 — Close the loop.** Fix proposals (§6.2) with the approval gate and the paired
`LEARNINGS.md` entry.
*Acceptance:* one real drift is corrected through the dashboard, and the ritual is measurably
cheaper than doing it by hand.
**Built 2026-07-27 — acceptance NOT yet met.** The mechanism is verified against fixture repos
(11 checks, `pnpm verify:stage2`) and nadim's proposal renders live, but **no real drift has been
corrected through it**: approving a write into a watched repo is an owner gate, so the stage's
own acceptance criterion is the owner's to satisfy, not the agent's. Recorded rather than
rounded up — this document does not get to claim a verification that has not run.

> **Re-ordered 2026-08-15 (D18–D22).** Stages 3+ are renumbered because the execution layer
> (§12) lands between the shipped Board and everything that was queued behind it. Where the old
> stages went: **old Stage 3 (Overview) → new Stage 6**, rewritten against D22 to read two
> sources; **old Stage 4 (transcripts/cost) → new Stage 7**; **old Stage 5 (decision queue)** was
> already folded into the Overview by D12 and stays there; **old Stage 6+** is unchanged at the
> back. Nothing was dropped, and the re-order has one reason: **the Overview cannot be built
> before the thing half its rows will come from.**

**Stage 3 — The execution MVP: one thread, one project** (§12.4). Create a task, assign an agent,
spawn a local session in an ephemeral worktree, watch its tool calls, answer its inbox question,
see it commit and destroy itself. Per-session cost recorded. One project, opted in.
*Acceptance:* a task moves `todo → doing → review` under agent control and **cannot** be moved to
`done` by the session token when gated; the session's worktree does not exist afterwards and the
next run re-clones; the inbox reply resumes the paused session with the answer in context; the
commit sha and cost land on the session row. **Aimed at a low-stakes watched repo, never at this
one** — §12.4 says why.

**Stage 4 — Templates, gates, chains** (§12.5). `TaskTemplate` + instantiate; approval gates
enforced in the API, not by convention; the follow-up chain scheduler; the nine-step
compound-engineer workflow seeded.
*Acceptance:* instantiating the template creates nine cards; step 2 does not start until a human
marks step 1 `done`; an agent session token attempting that transition is refused with a reason.

**Stage 5 — Goals** (§12.6). Definition of done, human approval of it, the orchestrator that runs
after every session, and all three safety rails.
*Acceptance:* a two-item DoD completes by spawning at least two specialist sessions; a goal will
not spawn before its DoD is approved; a spend cap of `$0.00` refuses to spawn; a `stuckThreshold`
of 2 stops after two no-progress iterations. **Plus one this product owns and the source spec does
not:** a goal whose primary repo is in `⚠ drift` warns before spawning, and says which document.

**Stage 6 — The Overview, rewritten** (§6.8, amended by D22). The portfolio's forward view, now
reading **both** sources — tasks and goals where an execution layer exists, documents and git
where it does not.
*Acceptance:* it correctly shows hadaya's 8 `☑` ready specs and 5 `☐` gated ones; it marks every
nadim item **suspect** while nadim's HANDOFF is drifted; and an item produced by a real session
renders `▶ executed` carrying its session id and commit sha. The second and third are the ones
that matter — together they are the whole differentiator.

**Stage 7 — Transcripts and portfolio cost** (§6.3). Incremental parser, SQLite cache, usage
panel. Per-session cost already exists from Stage 3; this is the cross-project retrospective.
*Acceptance:* totals cross-check against `ccusage` within a stated tolerance; every derived metric
exposes its formula; session-recorded cost and transcript-derived cost agree for the same session,
or the discrepancy is shown rather than reconciled away.

**Stage 8+ — Triggers, automations, YAML + CLI, PWA and push** (§12.7). Each waits for its pain,
and each is genuinely optional: the MVP loop is complete without any of them.

**Still pain-gated at the back — skills, session stream, behaviour drift** (§6.5–6.7).

---

## §11 — How success is judged

1. **Session-start gets shorter.** The manual per-repo ritual is replaced by one glance.
   Failure looks like: still running `gh pr list` by hand.
2. **Drift is caught between sessions, not at the start of one.** nadim's HANDOFF was stale for
   12 days; the next such instance should be caught in under a day.
3. **It is opened without being prompted.** If it is not open daily within two weeks of Stage 2,
   the premise was wrong — record that as a lesson and stop, rather than adding panels.
4. **Green rows are trusted.** The owner acts on "in sync" without re-checking by hand. This is
   the real bar: a verification tool nobody trusts is strictly worse than none.

**A stated risk.** A dashboard is an appealing thing to build and an easy thing to abandon — it
produces a satisfying artifact without shipping product. The mitigation is the gate structure:
Stage 1 is small, has a falsifiable acceptance test, and if it fails to change behavior, §11.3
says stop. That instruction is written here, before enthusiasm, on purpose.

---

## §12 — The execution layer *(added 2026-08-15 · D18–D22)*

> **Source:** [`specs/AgentOS-spec.md`](specs/AgentOS-spec.md) — a reconstruction of Danny
> Postma's AgentOS talk. **It is a reconstruction**: its prompts, its stack, and its fourth
> plan-reviewer are explicitly guesses (its own §23 lists them). Treat it as a strong design
> reference, never as a settled contract. Where it and this section disagree, this section wins.

### 12.1 · Why this product should own an executor at all

The honest version of the argument is not "it would be nice to run agents from the dashboard." It
is that **the source spec has a blind spot that this project is uniquely built to close.**

AgentOS-spec §11 describes the daily loop: write a spec in the morning, hand it to the goal
system, walk away, collect a PR at six. Its safety rails are real and well chosen — a spend cap,
a maximum duration, and a stuck detector that stops after nineteen identical iterations. **All
three measure the loop. None measures its premise.** A goal spawned from a specification drafted
against a HANDOFF that is twelve days stale will run cleanly for five hours, cost real money,
produce a coherent PR, and trip nothing. It was never stuck. It was wrong at line one.

That failure is not hypothetical here. It is the documented, three-times-caught, twelve-day
instance in §1 that this entire product was built to find — and Stage 1 already finds it,
unaided, against real repos. **A verification layer is worth more guarding a spend than guarding
a read.** That is the whole case, and it is why the two layers belong in one system rather than
two.

### 12.2 · The shape

```
PORTFOLIO LAYER          all projects · read-only · derived · no stored state
  ├── Board              claims vs. git/GitHub reality          [§6.1–6.2, shipped]
  └── Overview           in flight · ready · blocked · shipped  [§6.8, Stage 6]
        │
        │  drift state flows down: a goal sourced from a drifted
        │  document is marked before it is allowed to spend
        ▼
EXECUTION LAYER          per project · opt-in · read-write · stores state with evidence
        Tasks · Goals · Inbox · Sessions · Costs                [Stages 3–5]
        Agents · Templates            (configuration, not daily work)
```

**Opt-in per project.** A project has an `agentos.yml` or it does not (D18). Of the six watched
projects, itqan is a framework repo and two are router-only; none of them wants an agent roster.
A project without one appears in the portfolio exactly as it does today — the same graceful
degradation already applied to unfilled roles.

**The boundary is enforced, not decorative** (D19). The portfolio stores no state and its data
path may not read the execution layer's store. The execution layer may store state, and every
status it stores carries the session id and commit sha that produced it. A status that cannot
name its session is a claim, and renders as one.

### 12.3 · What is adopted, changed, and dropped

| AgentOS-spec | Here | Why |
|---|---|---|
| Project as YAML unit | **Adopted**, 1:N repos with one primary (D21) | The Board needs one declared state-doc source |
| Agents with per-agent grants | **Adopted** | §5's default-deny is the right model and matches this codebase's existing guard discipline |
| Task Kanban, gates, chains | **Adopted** | The gate pattern already exists in `lib/fix/apply.ts` |
| Goals + orchestrator + rails | **Adopted**, plus a **drift pre-flight** the source lacks | §12.1 |
| Inbox as the only interrupt channel | **Adopted wholesale** | It is the spec's best idea and it is what makes walking away safe |
| Sessions, ephemeral, destroyed | **Adopted**; container → **git worktree** (D20) | Preserves §6's "no warm dirty workspace" rule on a local disk |
| Cloud runner, R2, Secret Manager | **Deferred** behind §16's `Runner` interface (D20) | Local-first narrows the egress carve-out to one host |
| Least privilege at network layer | **Weakened** — MCP/tool layer only, no container | Stated honestly → `docs/BACKLOG.md`, not pretended |
| Triggers, cron automations | **Deferred** to Stage 8 | The loop is complete without them |
| YAML push/pull + CLI | **Deferred** to Stage 8 | Useful, not load-bearing |
| PWA + web push | **Deferred** to Stage 8 | Depends on the inbox being worth being paged about |
| Multi-tenant / teams / billing | **Dropped** | Single operator, as both products already assume |

### 12.4 · The MVP: one vertical thread

Seven features were named as important — agents, tasks, goals, inbox, sessions, templates, costs.
Built together they are four of the source spec's phases and would produce nothing runnable for a
long time. **Stage 3 is instead the single thread that proves the system is real:**

> Create a task → assign an agent → spawn a local session in an ephemeral worktree → watch its
> tool calls stream → the agent hits a question it cannot answer and uses the Inbox → you answer →
> the session resumes with your answer in context → it commits → the worktree is destroyed →
> the card carries the commit sha and what the run cost.

Everything after Stage 3 is a composition of that thread. Templates are the thread sequenced with
gates; goals are the thread in a loop with an orchestrator; costs are a column that already exists
by then.

**One safety decision, stated here because it is easy to get wrong under enthusiasm:** the first
sessions are aimed at a **low-stakes watched repo** — `my-personal-website` or `fractal-code` —
and **not** at agentic-os itself. Self-hosting is this project's established acceptance pattern
(D4) and it should still be the destination, but the MVP thread ends in an agent committing to a
repo, and the control plane is the worst possible first target for that. Self-host once the loop
is proven, not before.

### 12.5 · Templates before goals

Templates land at Stage 4 and goals at Stage 5, in that order, for a concrete reason: a template
chain is **approval gates plus sequencing**, and the approval gate already exists in this codebase
— built, guarded four ways, and covered by eleven acceptance checks. Goals are the only genuinely
novel control loop in the whole design, and they deserve to be built on machinery that has already
run.

The nine-step compound-engineer workflow (AgentOS-spec §10) ships as the seeded template. Its two
human gates — spec approval at step 1 and PR review at step 9 — are the same gesture this product
has been making since Stage 2, and they are enforced in the API rather than by prompt.

### 12.6 · Goals, and the rail the source spec is missing

Goals get the spec's three rails unchanged: spend cap (required by default, confirmable away),
maximum duration, and stuck-at-N. They also get a fourth that no other agent platform can offer:

> **A goal will not silently spawn against a drifted premise.** Before the first session, the
> orchestrator reads the Board's state for the goal's primary repo. If that repo is in `⚠ drift`,
> the goal says which document and which claim, and waits for an explicit acknowledgement.

This is §6.8.1's provenance model moved from *planning* to *spending*, and it is the single
clearest answer to "why build this here instead of using his."

### 12.7 · Deferred, with the condition that unblocks each

Triggers and cron automations, the YAML round-trip and CLI, the PWA and web push, the cloud
runner, and the R2-style filesystem MCP are all **deferred, not dropped**. Each has an entry with
an unblock condition in `docs/BACKLOG.md`. None of them is required for the loop in §12.4 to work,
and the source spec's own phase order agrees.

### 12.8 · What the execution layer may never do

1. **Store a status it cannot attribute.** Every stored transition names a session or a human. No
   third category (D19).
2. **Let an agent close its own gate.** Approval-gated transitions are refused for session tokens
   at the API, not discouraged in a prompt (AgentOS-spec §5.9).
3. **Reach the network beyond its declared allow-list** — the model API and whatever the
   environment names, and nothing else. No telemetry, no analytics, no cloud sync (D19).
4. **Survive a session.** Nothing persists but commits and files written through a granted path.
   No warm workspaces, ever (D20).
5. **Answer a question the portfolio already answers.** No per-project Overview, no per-project
   drift board (D22). One question, one surface.
6. **Page you for progress.** The inbox exists for decisions and blockage. An agent that messages
   to report that it is working has misused the only interrupt channel there is.
