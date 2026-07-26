# Agentic OS — Design Brief

> **For:** the design agent drafting first wireframe concepts
> **Status:** brief · written 2026-07-26 · not a design system yet
> **Reads with:** [`PRD.md`](PRD.md) (the what and why — read §1, §6.1, §6.2 first)
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

1. **The Board — 2–3 distinct concepts.** The main event. Each must solve §5.1's two tensions
   (row density vs. drift sentence; heterogeneous rows) and take a clear position on §3
   (claim-vs-fact separation). Show all 6 real projects from §4. Annotate the reasoning.
2. **The Board, degraded states** — one concept shown (a) all-green, (b) stale/unverified,
   (c) a collector failed (`gh` offline: PR data unavailable while git data is fine — partial
   truth must be visible as partial, never silently blank).
3. **Fix proposal (§5.2)** — one concept, showing the diff and the gate.
4. **Usage panel (§5.3)** — one concept, including the formula-on-hover affordance.
5. **Decision queue (§5.4)** — one light sketch.
6. **Dark mode** — at least the chosen Board concept, designed rather than inverted.
7. **A short rationale** — for the Board concepts, what each optimizes and what it sacrifices.

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

---

## 10 · Success criteria

A concept succeeds if:

1. A stranger shown the Board for **three seconds** can say which project needs attention.
2. **Claim and fact are never confusable** — §3, the central test.
3. The **all-green board still looks like a result**, not an empty state.
4. The **usage panel cannot be mistaken for the headline**, even though it holds the biggest
   numbers.
5. Nothing on screen makes a claim it hasn't verified — the dashboard obeys the same
   `verify-before-claim` rule as the system it watches.
