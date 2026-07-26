# Agentic OS — Product Requirements

> **Status:** draft for owner review · written 2026-07-26 · not decision-closed
> **Owner:** Sobhi · **Harness:** [itqan](https://github.com/Sob7i/itqan) (both data model and installed framework)
>
> This document proposes. It does not authorize building. Per itqan's gate model, the
> decisions in §9 close before code starts.

---

## §1 — The problem, stated precisely

Five projects are active: **salla-apps** (the `hadaya/` directory), **nadim**, **itqan**,
**fractal-code**, **my-personal-website** — plus **agentic-os** itself (D9), which appears in its own board. Each
is worked by agents across sessions. Each carries state documents that claim where things stand.

**Those claims go stale, silently.** This is not hypothetical — it is the single most
evidenced failure mode in the existing system:

- nadim's `docs/HANDOFF.md` opens with a warning it wrote about itself: *"It was caught stale
  twice already."* Then a third catch is logged inside it.
- itqan's `rituals/session-start.md` exists because *"a state doc claimed 'no remote' while
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

| Project | Branch | Router | State | Decisions | Behaviour | Profile |
|---|---|---|---|---|---|---|
| salla-apps (`hadaya/`) | `develop` | ✅ | — | — | — | full (partial install) |
| nadim | `feat/desk-4a-prototype` | ✅ | ✅ HANDOFF | ✅ | — | lite |
| itqan | `docs/changelog` | — | — | — | — | self (framework repo) |
| fractal-code | `develop` | ✅ | — | — | — | partial |
| my-personal-website | `feature/phase-5-polish` | ✅ | — | — | — | partial |

**Consequence for the design:** only nadim is meaningfully instantiated. A dashboard that
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

**As installed framework** — agentic-os installs itqan on itself per `INSTALL.md`, filling all
seven roles from day one. Three reasons this is not ceremony:

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

## §9 — Decisions to close before building

Per itqan's gate model, these close before code starts. **D1–D3 are answered** (owner,
2026-07-26); D4–D9 are open.

| # | Decision | Status |
|---|---|---|
| **D1** | Primary job: drift reconciliation, usage secondary | ✅ **closed** — reconciler |
| **D2** | Delivery: local Next.js app + collectors | ✅ **closed** — Next.js |
| **D3** | itqan's role: data model **and** self-install | ✅ **closed** — both |
| **D4** | Parse claims from prose, or require structured markers? Prose parsing is fragile; markers require editing 5 repos. *Recommendation: heuristics + confidence, with markers as an itqan proposal if heuristics prove too noisy.* | ⬜ open |
| **D5** | Does "mark verified" write to the repo, or only to `data/verified.json`? *Recommendation: local-only, keeping the dashboard read-only until §6.2 is proven.* | ⬜ open |
| **D6** | Cost basis: API-equivalent pricing (ccusage-style) or subscription-relative? The `$`/PR number means different things under each. | ⬜ open |
| **D7** | Refresh model: on-load only, timer, or filesystem watch? | ⬜ open |
| **D8** | Scope: the 5 named projects **plus agentic-os itself** (D9), or auto-discover from transcript `cwd`? *Recommendation: explicit config; auto-discovery would surface 14 stale repos as noise.* | ⬜ open |
| **D9** | Does agentic-os get a remote and PRs, or stay local? Affects whether it appears in its own PR panel. | ✅ **closed** — remote `github.com:Sob7i/agentic-os`, `main` (owner, 2026-07-26). It appears in its own board as a sixth project. |

---

## §10 — Build order

Gated. Each stage ships and gets used before the next is justified.

**Stage 1 — Prove the reconciliation.** Collectors for git, `gh`, and itqan docs. Checks D1–D8.
The board (§6.1). No transcripts, no charts, no cost.
*Acceptance:* it independently rediscovers nadim's HANDOFF drift — the instance verified by hand
in §1 — and shows itqan as green.

**Stage 2 — Close the loop.** Fix proposals (§6.2) with the approval gate and the paired
`LEARNINGS.md` entry.
*Acceptance:* one real drift is corrected through the dashboard, and the ritual is measurably
cheaper than doing it by hand.

**Stage 3 — Transcripts and cost.** Incremental parser, SQLite cache, usage panel (§6.3).
*Acceptance:* totals cross-check against `ccusage` within a stated tolerance; every derived
metric exposes its formula.

**Stage 4 — Decision queue** (§6.4). Ships when the drift board is in daily use and the
question shifts from "what's stale" to "what's blocked on me."

**Stage 5+ — Skills, sessions, behaviour drift** (§6.5–6.7). Each waits for its pain.

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
