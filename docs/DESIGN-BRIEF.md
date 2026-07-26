# Agentic OS — Design Brief

> **For:** the design agent drafting wireframe concepts
> **Status:** brief · written 2026-07-26 · **round 1 complete, round 2 open** · not a design system yet
> **Reads with:** [`PRD.md`](PRD.md) (the what and why — read §1, §6.1, §6.2, §6.8 first)
> **Round 1 output:** [`../design/wireframes.pen`](../design/wireframes.pen)

## Round status

**Round 1 — delivered.** Three Board concepts (A Ledger, B Triage, C Feed + Roster), degraded
states, fix proposal, usage panel, decision queue, dark mode.

**✅ Chosen: Concept C — "Feed + Roster"** (node `V1YpOq`), owner pick 2026-07-26. Drift is a
first-class object: a feed of full drift cards on top (CLAIMED vs VERIFIED as two labelled,
differently-styled blocks), an ambient role-coverage matrix below. Concepts A and B are retired
— keep them in the file as record, do not develop them further.

**Round 2 — this brief now asks for:** (a) the Overview (§5.5, new — the second pillar), and
(b) two corrections to Concept C (§5.1.1). Everything in §§1–4 and 6–7 still governs.
>
> This brief specifies **what the screens must do and the constraints they must respect.**
> It deliberately does *not* specify layout — that is the deliverable being asked for.
> Where a value has been verified (palette, contrast, real data), it is marked ✅ and must be
> used as given rather than re-derived.

---

## 1 · The one-sentence brief

Design the surface for a **local dashboard that continuously verifies whether each project's
state documents are still telling the truth** — and shows, at a glance, which ones are lying.

If a wireframe answers *"which of my projects is currently misleading me, and what do I do about
it?"* in under three seconds, it is working. Everything else on the screen is secondary.

---

## 2 · Who uses it, and how

**One user: Sobhi.** Solo operator running ~6 projects in parallel with AI agents. Technical,
lives in a terminal, reads dense information comfortably. No other audience — no team views, no
onboarding flow, no empty-state hand-holding for newcomers, no marketing surface.

**Three usage moments, in order of importance:**

| Moment | Duration | Need |
|---|---|---|
| **Session start** *(primary)* | 3–10 seconds | "What changed while I was away? What's stale?" Scan, act, leave. |
| **Ambient glance** | 1–2 seconds | Second monitor / background tab. Peripheral vision only: is anything red? |
| **Weekly review** | 2–5 minutes | Spend, velocity, decision backlog. Deliberate, exploratory. |

**Design consequence:** the primary moment is a *scan under time pressure*, not exploration. The
default view must be legible at a glance and from across a desk. The exploratory panels exist,
but they must never compete with the scan. **Optimize the 3-second read; let the 5-minute read
be one click deeper.**

---

## 3 · The core insight the design must carry

Two kinds of information appear on this screen, and **the design's central job is to keep them
visually separate:**

1. **Claims** — what a state document *says* ("PRs #1–#22 merged"). Written by a past session.
   A hypothesis. Possibly stale. Possibly a lie.
2. **Facts** — what git and GitHub *say is true* right now. Ground truth.

A conventional dashboard renders both as "data" in identical styling. **That would defeat the
product.** The whole value is the *distinction* between them, and the *gap* where they disagree.

> **This is the single most important thing to solve in the wireframes.** How do you show a
> claim, a fact, and the delta between them — so that the delta is the loudest element, the fact
> is trusted, and the claim is visibly provisional?
>
> Some directions worth exploring (not prescriptions): claims in a documentary/quoted treatment
> vs. facts in a system/instrument treatment; a physical gap or gutter between the two columns;
> the claim visually "aged" or faded relative to a crisp fact; strikethrough-and-correction as
> in copy-editing. Bring more than one idea here.

---

## 4 · Content to design against — real data, not lorem ipsum

Every value below was measured on 2026-07-26. **Use these exact projects and states in the
wireframes.** Realistic content exposes layout problems that placeholder text hides — especially
the long drift sentences, which are the hardest thing on the screen to typeset.

| Project | Branch | Dirty | Last commit | Open PRs | itqan roles filled | Status |
|---|---|---|---|---|---|---|
| **nadim** | `feat/desk-4a-prototype` | 1 | 12 days | 1 (#24) | Router, State, Queue, Decisions, Lessons | ⚠ **drift** |
| **salla-apps** | `develop` | 9 | 21 hours | 1 | Router only | ⚠ **drift** |
| **my-personal-website** | `feature/phase-5-polish` | 7 | 3 weeks | 1 | Router only | ○ attention |
| **fractal-code** | `develop` | 5 | 2 days | 1 | Router only | ○ attention |
| **itqan** | `docs/changelog` | 1 | 5 days | 0 | (framework repo) | ✓ in sync |
| **agentic-os** | `main` | 0 | today | 0 | all seven (self-installed) | ✓ in sync |

**The headline drift, verbatim — design for this exact string:**

> nadim's `docs/HANDOFF.md` claims **"PRs #1 through #22 merged"** and describes #22 as the
> frontier. Reality: **#23 is merged; #24 has been open since 2026-07-14.** The document is two
> PRs behind, and has been for 12 days.

Note the shape: a **quoted claim**, a **verified reality**, and an **age**. Nearly every drift
row will have those three parts. That is your core component.

**Severity has exactly three levels** (never more — see §7):

- ⚠ **drift** — a document contradicts reality. Actionable now.
- ○ **attention** — no contradiction, but something is aging or uncommitted. Informational.
- ✓ **in sync** — verified true, with a timestamp.

**Design the ✓ state as carefully as the ⚠ state.** A verified-green row is the product's actual
output — proof the check ran — not an empty state. If green reads as "nothing here," the
dashboard fails its own trust test (PRD §11.4). Resist the instinct to gray it into invisibility.

**Scale bounds:** 6 projects today, realistically ≤ 12 ever. **Do not design for infinite scroll
or pagination.** All rows should fit one screen without scrolling at 1440×900. This is a fixed
small-N display — an instrument panel, not a feed.

---

## 5 · Screens to wireframe

### 5.1 · The Board *(primary — spend most of the effort here)*

The default and often only view. Requirements:

- All 6 projects visible simultaneously, **no scrolling**, sorted by severity.
- Per project: name, branch, severity, the drift statement (when present), git facts (dirty
  count, last commit age), PR state, itqan role coverage, and per-row actions.
- **A global freshness indicator** — when did the whole board last verify? This is
  load-bearing: a stale dashboard reporting stale docs is a trust collapse. Explore how it
  behaves as it ages (fresh → aging → visibly stale).
- Role coverage (7 roles × 6 projects) must be scannable — the gaps are meaningful (they drive
  itqan installs), but this is *supporting* detail and must not out-shout the drift line.
- Row actions: `review diff` · `open PR` · `mark verified`.

**Two known layout tensions to solve — this is the real design problem:**

1. **Row density vs. the drift sentence.** Compact rows scan best, but the drift statement is a
   full sentence with a quoted claim and a fact. Options: two-tier rows (dense line + expandable
   detail), a fixed multi-line row, or drift as a distinct card breaking the row rhythm.
   **Show at least two approaches.**
2. **Heterogeneous rows.** nadim has 5 roles, a drift, and an open PR. itqan has almost nothing
   to say. If every row reserves space for the maximum, five rows look broken; if rows size to
   content, the table loses its scan-line. **Solve this explicitly.**

#### 5.1.1 · Round-2 corrections to Concept C

Two fixes before Concept C is developed further. The first is a content accuracy bug; the second
is a structural gap the concept's own rationale identified.

**(a) The salla-apps drift card is fabricated — replace it.** The card cites `docs/STATE.md`
claiming *"Working tree clean; ready to ship."* **No such file exists.** salla-apps is
Router-only — its own roster row in the same wireframe correctly shows one filled dot and six
empty. So the wireframe contradicts itself, and invents a document to do it.

This matters more than a normal content error: a dashboard whose purpose is catching unverified
claims must not itself display one. Per §4, salla-apps has **no state doc**, so it cannot produce
a claim-vs-fact drift at all — it is `○ attention` (9 uncommitted files, 21h), not `⚠ drift`.

*The correction is also a design opportunity.* With only one real drift, the feed shows a single
card — which is the honest picture, and raises the question §9.5 asked: **what does the feed look
like when a Router-only project has nothing to claim?** Answer it explicitly. Options: the feed
holds only real drift (often one card), and Router-only projects appear solely in the roster
with an "install state role" affordance; or the feed carries a distinct secondary card type for
"cannot verify — no state doc," which is a different thing from "verified in sync."

**(b) Solve the duplication the rationale admits.** Concept C's own note lists *"a project
appears twice (feed + roster)"* as its sacrifice. With nadim in both, the eye must reconcile
them. Show how the two zones relate — a visual link on hover, a roster row that reads as the
"collapsed" form of its card, or a marker on rostered projects that have a card above. Small
detail, disproportionate effect on whether the screen reads as one instrument or two stacked
widgets.

### 5.2 · Fix proposal *(the gated action — PRD §6.2)*

When drift is detected, the dashboard drafts the corrected markdown and **waits for approval.**
Wireframe: the proposed diff (before/after on the state doc), the `LEARNINGS.md` line that ships
with it, and an unmistakable approve/reject gate.

**The gate must feel like a gate.** This writes to the user's repo. It must not be
mistakable for a passive "OK" — but it also must not be so heavy that the fix never happens.
That tension is the design problem here. Modal, inline expansion, or side panel — your call,
with reasoning.

### 5.3 · Usage & cost *(secondary — PRD §6.3)*

The reference screenshot's territory, deliberately demoted to a collapsed panel. Contents: PR
funnel (created / merged / merge rate / $ per merged PR), spend over time by project or model,
cache efficiency, delegation split (lead vs. sub-agent), model mix.

**Constraint — every derived metric shows its formula on hover.** The reference screenshot
displays "Merge time reduction: −403%" and "Bugs caught: 0," both plainly broken metrics that
shipped anyway. Design the affordance that prevents that: where does the formula live, and how
is a low-confidence number marked?

### 5.4 · Decision queue *(P1, wireframe lightly — PRD §6.4)*

Where the system waits on Sobhi: open decisions with age, specs not yet decision-closed, pending
human gates. One concept sketch is enough at this stage.

### 5.5 · The Overview *(NEW in round 2 — the second pillar · PRD §6.8)*

**Give this roughly the effort of §5.1.** It is the other half of the product, not a subpanel.

**The question it answers:** across all projects — what's in flight, what's ready to build,
what's blocked on me, what shipped recently, and what does the coming week look like?

**Its relationship to the Board is the design problem.** The Board *verifies* (backward: "is
this doc still true?"). The Overview *plans* (forward: "what does this doc say we're doing?").
Same seven roles, same files, opposite direction. Are they two tabs, two zones of one page, or
two modes? Take a position. The Board is the more urgent surface and must not lose its
primacy — but the Overview is where more total time will be spent.

#### 5.5.1 · The thing that makes this not-Linear — design it first

Every item shows **where it came from and whether that source is trustworthy**:

| Provenance | Meaning | Frequency in real data |
|---|---|---|
| **derived** | computed from git/GitHub directly | strongest — most "shipped"/"in flight" items |
| **verified** | from a doc the Board confirms in sync | e.g. all hadaya specs |
| **suspect** | from a doc with active drift | **every nadim item today** — its HANDOFF is 12 days stale |

A general planning tool renders all three identically, because it cannot tell them apart. **This
one can, and the design must show it** — or the feature is a worse Linear.

**Design constraint:** *suspect* must be visible without becoming alarming. These items are
probably fine — just unconfirmed. If suspect items read as errors, the Overview becomes a wall
of warnings and gets ignored; if they read as identical to verified, the differentiator is
lost. Find the middle. Note the vocabulary problem too: `⚠ drift` on the Board is *"this is
wrong."* Suspect is *"this may be out of date."* Reusing the drift red would overstate it.

#### 5.5.2 · Content — real data, verified 2026-07-26

Five bands. **Use these actual numbers.**

| Band | Source | Real content |
|---|---|---|
| **In flight** | open PRs + specs "build in progress" | 4 open PRs (nadim #24, salla-apps, fractal-code, my-personal-website); `monorepo-step-1.spec.md` in progress |
| **Ready** | specs with `☑` | **8 of 13** hadaya specs decision-closed, e.g. `hadaya-shell-adoption` ("build approved, owner 2026-07-16"), `umnia-import`, `widget-product-capture-and-currency` ("ready for a builder (Sonnet)") |
| **Blocked** | specs with `☐` + open decisions + gates | **5 of 13**, e.g. `scheduled-loop-harness` ("DESIGN-CLOSED — build-GATED… may not build until §8 build-gates clear"); nadim's D15 dogfood gate blocking all features |
| **Shipped** | merged PRs, CHANGELOG, tags | hadaya `v0.5.2` · `v0.5.1` · `v0.5.0`; nadim PRs #1–#23 merged, deliberately untagged |
| **Deferred** | `BACKLOG.md`, each with `Unblocked by:` | nadim: **10 entries**, e.g. *"Exercise the live reflection round-trip — Unblocked by: Sobhi pasting a real key into `.env.local`"* |

**Two content properties that should shape the layout:**

1. **`Unblocked by:` is the most valuable string on the screen.** Every nadim backlog entry has
   one, and it converts a graveyard into a queue with entry conditions. Many name *Sobhi* as the
   unblocker — that is itqan's core thesis (decision availability is the bottleneck) appearing
   as literal data. **Consider making "blocked on you" its own visual treatment**, distinct from
   "blocked on a gate."
2. **Status prose is long and inconsistent, and must be shown verbatim.** Real values range from
   `☑ decisions closed — build approved (owner, 2026-07-16)` to `☐ DESIGN-CLOSED — build-GATED. §6
   decisions closed 2026-07-23 (values inherited from AGENTIC_SYSTEM_PLAYBOOK.md §4 Stage 6)`.
   Only the leading glyph is machine-readable; the prose is authored and may not be normalized
   or truncated into a fake status chip. **Design for a variable-length authored string** — the
   §5.1 density problem again, in a new place.

#### 5.5.3 · The week view — no sprints, and don't invent them

The ask was "what the week/sprint looks like." **This system has no sprints.** It is gate-driven:
work moves when a decision closes or an owner approves, never because a fortnight ended. Sprint
boundaries, burndowns, velocity, and story points would all be fabricated — and PRD §6.3 already
forbids shipping metrics nobody validated.

**Design instead from what is real and time-shaped:**

- **Movement (last 7 days)** — PRs opened/merged, commits, specs that changed status, tags cut.
  All git-derived, fully trustworthy, genuinely useful.
- **Age as pressure** — how long each blocked item has waited. *Age is the honest substitute for
  a deadline* in a system that has none. nadim's HANDOFF: 12 days. Some gates are older.
- **Stated intent** — each state doc's "Next up," carrying its provenance per §5.5.1.

So the week view is **a retrospective of what moved, plus a queue ordered by what has waited
longest.** Not a forecast. If it reads as a burndown, it is wrong.

#### 5.5.4 · Explicit non-goals for this screen

No task creation, assignment, due dates, effort estimates, drag-to-reorder, or status toggles.
It is **read-only** (PRD §6.8.4): anything editable here becomes a second source of truth that
can drift, and drift is the problem this product exists to solve. Every item traces to a file in
a repo; editing happens there. **If a wireframe includes a "+ New" button, it has misread the
brief.**

**Do not wireframe** skills inventory, session stream, or behaviour drift (PRD §6.5–6.7). They
are gated behind felt pain and would be speculative now.

---

## 6 · Visual direction

### 6.1 · The register

**An instrument, not an app.** Closer to a flight panel, a monitoring console, or a well-set
reference table than to a SaaS dashboard. It is consulted, believed, and closed.

Anchor: itqan's own `docs/dashboard.html` — a warm-neutral, restrained, self-contained document
surface, generous with whitespace and typographic hierarchy, near-zero chrome. Agentic OS is its
instrument sibling: same material, more density, live data.

**Explicitly not:** the aesthetic of nadim (`docs/DESIGN-SYSTEM.md`). That project is a
metaphor-driven consumer app — books, mirrors, parchment, brass. It is excellent and completely
wrong here. **Agentic OS has no metaphor.** It is a truth surface: the design's honesty *is* the
concept. If a wireframe needs a metaphor to justify a layout, that layout is wrong.

**Tone words:** verified · legible · calm · dense-but-not-cramped · trustworthy.
**Anti-tone:** playful · gamified · celebratory · "AI-ish" (no gradients-on-everything, no glow,
no purple-blue tech sheen, no rounded-pill everything).

### 6.2 · Inherited tokens ✅ verified

Inherit itqan's surface/text tokens directly — this makes the two surfaces read as one family.

```css
/* light */
--bg:#faf8f5;  --surface:#ffffff;  --surface-2:#f2eee8;  --line:#e0d9cf;
--text:#1c1a17; --muted:#6b645c;   --radius:10px;
/* dark */
--bg:#131211;  --surface:#1b1917;  --surface-2:#232019;  --line:#322d27;
--text:#ece8e2; --muted:#9a938a;
```

✅ **Text contrast verified (WCAG AA+):** light text 16.38:1, light muted 5.50:1, dark text
15.33:1, dark muted 6.16:1 on their respective backgrounds. Use these pairings as given.

**Type:** itqan's stack — system sans for prose, `ui-monospace / SF Mono / Menlo` for all machine
facts (branches, SHAs, counts, PR numbers, timestamps). **Monospace is a semantic signal here,
not decoration: it marks verified machine truth.** Consider whether *claims* (§3) should
therefore be set in the sans face — the typographic split doing the epistemic work.

**Dark mode is required, not optional** — ambient-glance usage (§2) often means a dark second
monitor. Both modes must be designed, not auto-flipped.

### 6.3 · Status palette ✅ verified — use exactly these

itqan's accent trio was **tested with the `dataviz` validator and failed twice** as a chart
palette: the light teal `#0f766e` falls below the chroma floor (0.086 < 0.10 — it reads gray to
some viewers), and all three dark values sit outside the dark lightness band. Minimally corrected
values, re-tested until passing:

| Role | Light ✅ | Dark ✅ | Meaning |
|---|---|---|---|
| **in sync** | `#007d64` | `#0faaaa` | verified true |
| **attention** | `#a1620a` | `#c3871e` | aging / uncommitted |
| **drift** | `#9f1239` | `#eb5f73` | doc contradicts reality |

Both trios pass all six checks (lightness band, chroma floor, CVD separation, normal-vision
floor, contrast ≥ 3:1) against their surfaces. **Do not substitute by eye** — any change must be
re-run through `dataviz`'s `scripts/validate_palette.js`.

**Status is never carried by color alone** — always color **+** glyph (⚠ / ○ / ✓) **+** text
label. Non-negotiable: accessibility, and it survives grayscale and peripheral vision.

**These three are reserved for status and may never be reused as chart series colors.** Charts in
§5.3 need their own categorical palette, validated separately.

### 6.4 · Charts

Follow the `dataviz` skill for §5.3 (thin marks, one axis — never dual, legend for ≥2 series,
recessive gridlines, hover by default). Charts are secondary furniture here; they must not set
the page's visual tone.

---

## 7 · Constraints and anti-goals

**Hard constraints**

1. **No scrolling on the Board** at 1440×900 with 6 projects.
2. **Three severity levels only.** A five-level scale would be more precise and strictly worse —
   nothing is more precise if it can't be read in three seconds.
3. **Every fact shows its verification age.** No naked numbers.
4. **No destructive action without an explicit gate** (§5.2).
5. **Color never carries meaning alone** (§6.3).
6. **Local-only.** No avatars, no share/export, no notification bell, no account UI, no team
   presence. Nothing that implies a server or a second user.

**Anti-goals — do not design these**

- A KPI wall of big numbers. Impressive, low-information, exactly the trap the reference
  screenshot fell into.
- Sparklines or trend arrows on the Board. Drift is binary — a doc is true or it isn't. Trend
  decoration implies a gradient that does not exist.
- Notifications, badges, streaks, or any engagement mechanic. This tool should be opened *less*
  as things improve.
- Configuration UI. Projects are declared in `projects.config.ts`; there is no settings screen.
- Onboarding, tours, or empty-state illustrations.

---

## 8 · Deliverables

### Round 1 — ✅ complete

Three Board concepts + degraded states + fix proposal + usage panel + decision queue + dark mode,
delivered in `design/wireframes.pen`. Concept C chosen.

### Round 2 — requested now

1. **The Overview — 2–3 distinct concepts** (§5.5). The main effort this round. Each must take a
   position on: its relationship to the Board (tabs / zones / modes), how **provenance** is
   expressed (§5.5.1), and how the five bands are arranged. Use the real content in §5.5.2.
2. **The week view** (§5.5.3) — movement + age-ordered queue. May be part of an Overview
   concept or a separate zone; say which and why. **Must not read as a sprint burndown.**
3. **Concept C, corrected** (§5.1.1) — fabricated salla-apps card replaced, feed/roster
   duplication addressed.
4. **Overview dark mode** — the chosen direction, designed rather than inverted.
5. **A short rationale per Overview concept** — what it optimizes, what it sacrifices. The
   round-1 rationale notes were genuinely useful; keep that habit.

**Not requested:** further Board concepts (C is chosen), and no revisions to the fix proposal,
usage panel, or decision queue unless the Overview forces a change — in which case note it.

**Fidelity: wireframe.** Structure, hierarchy, density, and states. Use the real palette and type
where they carry meaning (§6.2–6.3), but do not polish — this round decides *layout and
information architecture*, and a beautiful wrong layout is harder to reject.

---

## 9 · Open questions for the design agent

These are genuinely undecided. **Take a position and show it** rather than asking back.

1. **Table or cards?** A table scans better across 6 rows; cards hold the variable-length drift
   statement better. Is there a hybrid that keeps the scan-line?
2. **Where does role coverage live?** Seven indicators per row is a lot of pixels for
   supporting data. Inline dots, a separate column, on-hover, or a distinct matrix view?
3. **How is "verified 4s ago" expressed** without becoming a nervous ticking clock that
   undermines the calm register?
4. **Is drift ever shown as a first-class object** — a "drift feed" independent of projects —
   or always as a property of a project row?
5. **What does a project with no state doc look like?** Four of six repos are Router-only. Is
   that an absence, a prompt to install, or simply quiet?
6. **Does the ambient glance (§2) deserve its own mode** — a zoomed, minimal variant readable
   across a room — or must the Board serve both?

**Round 2 adds:**

7. **Board and Overview — one surface or two?** Tabs, scroll zones, or modes. The Board owns the
   3-second scan; the Overview owns the longer session. Whatever you choose must not cost the
   Board its primacy.
8. **How is *suspect* provenance shown** (§5.5.1) without reading as an error? It must be
   distinct from the Board's `⚠ drift` red, which means something stronger.
9. **Do the five bands (§5.5.2) group by band or by project?** By band answers "what's ready
   anywhere"; by project answers "where does nadim stand." Both are real questions — is one
   primary, or is it a toggle?
10. **Where does "blocked on Sobhi" live?** It is the system's declared bottleneck and appears
    literally in `Unblocked by:` strings. Its own band, a filter, or a marker?

---

## 10 · Success criteria

A concept succeeds if:

1. A stranger shown the Board for **three seconds** can say which project needs attention.
2. **Claim and fact are never confusable** — §3, the central test.
3. The **all-green board still looks like a result**, not an empty state.
4. The **usage panel cannot be mistaken for the headline**, even though it holds the biggest
   numbers.
5. Nothing on screen makes a claim it hasn't verified — the dashboard obeys the same
   `verify-before-claim` rule as the system it watches. *(Round 1 failed this once: see
   §5.1.1a.)*

**For the Overview (§5.5):**

6. **Provenance is legible at a glance** — a stranger can tell which items are git-derived and
   which come from a document that may be stale. Fail this and it is a worse Linear.
7. **"What should I work on next" is answerable in under 15 seconds**, across all six projects.
8. **"What is blocked on me" is unmissable** — it is the system's declared bottleneck.
9. **The week view is not mistakable for a sprint board.** No burndown, no velocity, no
   fabricated deadlines — only real movement and honest age.
10. **The Board keeps its primacy.** Adding the Overview must not slow the 3-second drift scan.
