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
