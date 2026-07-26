# Spec — Stage 1: the reconciliation Board

status: ☑ decisions closed — build approved. §5 answered 2026-07-27; the D1 heuristic and the
role-detection bug in §3.3 were **verified against live data before this spec was closed**, not
assumed.

> The first buildable slice. Collectors for git, GitHub, and itqan documents; drift checks
> DC1–DC8; the Board rendering Concept C. **No transcript parsing, no cost, no charts, no
> database.** Product context: `docs/PRD.md` §6.1, §10 Stage 1. Design: `docs/DESIGN-BRIEF.md`
> §5.1 + Concept C (`design/wireframes.pen`, node `V1YpOq`).
>
> **Naming note:** this spec calls the drift checks **DC1–DC8** to avoid collision with
> `docs/DECISIONS.md` D1–D13. PRD §6.1 calls them D1–D8; same checks.

---

## §1 — Scope

**In:**

1. `projects.config.ts` — the six watched projects, explicit (DECISIONS D9).
2. Three collectors: `git`, `github` (via `gh`), `itqan-docs`.
3. Eight drift checks, DC1–DC8, each returning a typed result with a confidence.
4. One page: the Board, per Concept C — a drift feed over a role-coverage roster.
5. Degraded states: all-green, stale, and a failed collector.
6. `data/verified.json` — local-only acknowledgements (DECISIONS D6).

**Out** — deliberately, and each has a later home:

- Transcript parsing, cost, charts, SQLite → Stage 4.
- Fix proposals and any write into a watched repo → Stage 2. **Stage 1 never writes outside
  this repo.**
- The Overview → Stage 3.
- Auth, multi-user, deployment. It runs on `localhost`, for one person.

**No database.** Stage 1's inputs are git, `gh`, and a handful of markdown files — all cheap to
read on demand under D8 (on-load refresh). SQLite arrives with transcripts in Stage 4, where
170 MB across 137 files makes caching necessary. Adding it now would be machinery ahead of pain.

## §2 — Behaviour (the rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Board lists every watched project | Six rows; none missing, none auto-discovered | Load `/`; count rows against `projects.config.ts` |
| Each project shows verified git facts | Branch, dirty count, last-commit age match `git status`/`git log` | Compare a row against the same commands run by hand |
| Each project shows open PR state | Open PR numbers match `gh pr list` | Compare against `gh pr list` in that repo |
| Drift is detected and stated as claim-vs-fact | nadim shows its HANDOFF's PR claim beside GitHub reality | Load `/`; see §4 AC-1 |
| In-sync projects are shown as verified, not blank | A green row with a check timestamp | Load `/`; see §4 AC-2 |
| Role coverage is shown per project | Seven role indicators reflecting real files | Compare against `ls` in that repo; see §4 AC-3 |
| Freshness is always visible | Header states when checks last ran | Load `/`; leave open, observe it age |
| A failed collector degrades visibly | `gh` unavailable → PR data marked unavailable, git data still shown | See §4 AC-5 |
| Acknowledging a drift persists locally | "mark verified" survives reload; no file outside this repo changes | See §4 AC-6 |

## §3 — Data and sources

### 3.1 Collectors

| Collector | Method | Returns | Failure mode |
|---|---|---|---|
| `git` | `git -C <repo>` | branch, dirty count, ahead/behind, last commit (sha, ISO date) | repo missing → project marked unavailable |
| `github` | `gh pr list --json …` | open + merged PRs (number, title, updatedAt, reviewDecision) | `gh` missing/unauthenticated/offline → PR checks skipped, **git checks still run** |
| `itqan-docs` | filesystem read | role coverage; extracted claims | file absent → role marked not-instantiated (**not** an error) |

Collectors run **in parallel per project, and per project independently**: one repo failing must
never blank the other five.

### 3.2 The claim extractor — verified, and deliberately narrow

**Only high-precision patterns run.** Verified against nadim's real HANDOFF:

```js
/\bPRs?\s+#(\d+)\s+(?:through|thru|to|–|—|-)\s+#?(\d+)\s+(?:are\s+|have\s+been\s+)?(merged)\b/gi
```

→ extracts `PRs #1 through #22 merged` as `{lo:1, hi:22, state:'merged', confidence:0.95}`.

**A proximity-matching pattern was written, tested, and rejected** — this is the spec's most
important finding. A pattern of the shape `PR #(\d+) .{0,40}? (merged|open)` produced, on the
same real document:

- `"PR #5 unmerged"` → captured as **merged**. The substring `merged` matches inside `unmerged`,
  inverting the claim's meaning.
- `"PR #24 to \`develop\`; merged"` → falsely paired #24 with a `merged` belonging to another
  clause.

Both would have produced confident, wrong drift reports — the precise failure mode the product
exists to prevent, shipped inside the product. **Rule adopted: no proximity matching. A pattern
must match the full claim including its verb, or it does not run.** Guards required regardless:
a negation lookbehind (`not`/`un`/`no`) and an explicit `un(?=merged)` rejection.

Unrecognized prose is **not** a drift — it is *no claim found*, which is a distinct, honest
state (§3.4).

### 3.3 Role detection — must check full-profile alternates

A role is filled if **any** of its files exist. This is not a detail; getting it wrong produced a
live error in this project's own documents (see `docs/LEARNINGS.md`, 2026-07-27):

| Role | Files (any one counts) |
|---|---|
| Router | `CLAUDE.md` |
| State | `docs/HANDOFF.md`, `COMPASS.md`, `docs/handoffs/*.md` |
| Queue | `docs/specs/*.md`, `docs/specs/` |
| Decisions | `docs/DECISIONS.md`, `DECISIONS.md` |
| Lessons | `docs/LEARNINGS.md`, `MISTAKES.md`, `KNOWLEDGE.md` |
| Behaviour | `docs/FEATURES.md` |
| Record | `CHANGELOG.md`, else git history (always present) |

**Verified 2026-07-27** — salla-apps was recorded in `docs/PRD.md` §4 as "Router only" because an
early survey checked only lite-profile paths. It actually has a 467-line `CLAUDE.md`, 13 specs,
`MISTAKES.md` + `KNOWLEDGE.md`, and a 309-line `CHANGELOG.md` — a **full-profile install missing
its State role.** Materially different, and it makes the missing State role the interesting fact
rather than a general absence.

### 3.4 Result states — four, not two

| State | Meaning | Board treatment |
|---|---|---|
| `drift` | A claim contradicts reality | ⚠ feed card, claim beside fact |
| `attention` | No contradiction; something aging or uncommitted | ○ roster row |
| `in-sync` | Checked, and everything checked agrees | ✓ roster row, with timestamp |
| `unverifiable` | **No state doc, so no claim exists to check** | roster row, stated plainly — *not* green |

**`unverifiable` is required, not a nicety.** Four of six watched projects have no state doc.
Calling them "in sync" would assert a verification that never happened — the product's own
`verify-before-claim` invariant, violated by its main screen. Design question flagged in
`docs/DESIGN-BRIEF.md` §9.5; `docs/BACKLOG.md` carries it.

### 3.5 The checks

| # | Check | Claim source | Reality | Confidence |
|---|---|---|---|---|
| DC1 | PR frontier mismatch | state-doc PR range claim | `gh pr list` | 0.95 (explicit pattern) |
| DC2 | "Next up" item already done | state doc `## Next up` referencing a PR | merged PRs | 0.6 — **shown as low** |
| DC3 | State doc older than last commit | doc mtime + dated header | `git log -1` | 1.0 (derived) |
| DC4 | Uncommitted work | — | `git status --porcelain` | 1.0 |
| DC5 | Branch ahead/behind remote | — | `git rev-list --count` | 1.0 |
| DC6 | Open PR aging without review | — | `gh` `updatedAt` + `reviewDecision` | 1.0 |
| DC7 | No commit in N days (default 14) | — | `git log -1` | 1.0 |
| DC8 | Role coverage gaps | — | §3.3 | 1.0 |

DC1–DC2 are *claims*; DC3–DC8 are *derived* and cannot be wrong about their own inputs. Only
DC1 and DC2 can produce a false drift, which is why only they carry confidence below 1.0 and why
DC2 must render as tentative.

**DC1's reported number must be unambiguous.** For nadim the tool reports *"frontier #22; #23
merged (1 behind); unclaimed open: #24."* Prose elsewhere has called this "two PRs behind" —
counting #23 and #24 together. Both are defensible; the display states the two facts separately
rather than collapsing them into one contestable integer.

## §4 — Acceptance

Falsifiable. AC-1 and AC-2 are the PRD §10 Stage 1 gate.

- **AC-1 — it rediscovers the known drift unaided.** With nadim's HANDOFF unchanged, the Board
  shows a drift card: claim `"PRs #1 through #22 merged"` against reality `#23 merged, #24 open
  since 2026-07-14`. **Prototype-verified 2026-07-27** — the §3.2 pattern produced exactly this
  against live `gh` data before this spec was closed.
- **AC-2 — itqan shows as green**, with a visible check timestamp, and does not appear in the
  drift feed.
- **AC-3 — role coverage matches reality**, including full-profile alternates: salla-apps shows
  Router + Queue + Lessons + Record filled, State + Decisions + Behaviour empty (§3.3).
- **AC-4 — no false drift.** Every project the Board marks `drift` has a claim quotable from a
  real file at a real path. A `drift` whose cited document does not exist is a hard failure.
- **AC-5 — degraded is visible.** With `gh` unavailable (`PATH= node …` or unauthenticated),
  git-derived rows still render and PR data reads "unavailable", never "0 open".
- **AC-6 — nothing outside this repo is written.** After a full session including "mark
  verified": `git status` in all five other repos is byte-identical to before. **This is the
  invariant with the worst failure mode; test it explicitly.**
- **AC-7 — one broken repo does not blank the board.** Point one config entry at a
  non-existent path: that row degrades, the other five render.

## §5 — Decisions

All closed. Anything that surfaces beyond these stops the build and goes to
`docs/DECISIONS.md` first.

1. **Claim parsing approach?** High-precision patterns only, with negation guards; proximity
   matching prohibited (§3.2, evidence-backed). Confidence surfaced in the UI. — DECISIONS D5.
2. **Persistence?** None beyond `data/verified.json`. No SQLite until Stage 4 (§1).
3. **A project with no state doc — green or not?** Neither: a fourth state, `unverifiable`
   (§3.4). Calling it green would be an unearned assertion.
4. **`gh` failure — fail the row or the check?** The check only. Git-derived data still renders;
   PR data is marked unavailable (AC-5).
5. **Where do acknowledgements live?** `data/verified.json`, gitignored, keyed by
   `(project, check, claim-hash)` so it auto-expires when the underlying claim changes — an
   acknowledgement of a *stale* claim must not silently suppress a *new* one.
6. **Refresh?** On load, plus a manual button. No timer, no watcher. — DECISIONS D8.
7. **Which layout?** Concept C, with the §5.1.1 corrections applied: no fabricated salla-apps
   card (it is `unverifiable`, and per §3.3 not Router-only), and the feed/roster relationship
   made visible.
8. **Stalled-project threshold?** 14 days, in `projects.config.ts`, not hardcoded.

## §6 — Build notes

Suggested order — each step independently verifiable, which matters more than speed:

1. `projects.config.ts` + `lib/collectors/git.ts` → prove six rows of real git facts.
2. `lib/collectors/github.ts` → PR data, with the degraded path built *at the same time*, not
   retrofitted.
3. `lib/collectors/itqan-docs.ts` → role detection (§3.3) + claim extraction (§3.2).
4. `lib/reconcile/` → DC1–DC8 returning typed results.
5. The Board UI → Concept C, using the verified tokens in `docs/DESIGN-BRIEF.md` §6.2–6.3.
6. Degraded states, then AC-1…AC-7 end to end.

Palette and type are settled and validated — do not re-derive them
(`docs/DESIGN-BRIEF.md` §6.2–6.3). Status colours are reserved and never reused as series
colours.
