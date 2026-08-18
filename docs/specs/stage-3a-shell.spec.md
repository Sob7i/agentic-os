# Spec — Stage 3a: the app shell

status: ☑ decisions closed — **buildable now.** Nothing here is gated: it is portfolio-layer work
against data that shipped in Stage 1, and it does not touch a watched repo. Split out of Stage 3 by
**D26**, which says why it goes first.

> **The foundation the other surfaces mount into.** Today the app is one route, a fifteen-line root
> layout, and a 448-line `app/page.tsx`. Tasks, Goals, Sessions, Inbox and Costs are all specced to
> live at `/p/<slug>/…` and none of that exists.
>
> **This slice writes no execution-layer code and reads no execution-layer data.** Its entire data
> source is `buildBoard()` from Stage 1. That is what makes it buildable while Stage 3 waits on two
> owner decisions.
>
> Design: **D23**, and frames `B′1`, `B′2`, `C3`, `C4` in
> [`design/wireframes2.pen`](../../design/wireframes2.pen). Rendering rules for cards and evidence
> lines are Stage 3 §8 and are **not** in scope here.

---

## §1 — Scope

**In:**

1. **Routing** — `/` (portfolio home), `/overview` (placeholder, honest), `/p/<slug>` and its tab
   routes.
2. **The shell chrome per D23** — the always-present portfolio ribbon, the conditional drift band,
   and the project rail.
3. **The watched-only project view** (frame `C3`) — a complete screen, with real data, for the four
   projects that have no execution layer.
4. **Decomposition of `app/page.tsx`** into components the later surfaces can reuse, with no
   behaviour change.
5. **A CSS convention** for new surfaces (§5.2), decided before five pages each invent one.
6. **`pnpm verify:stage3a`** — small, and mostly about proving nothing broke.

**Out:**

- **Every execution-layer surface.** Tasks, Goals, Sessions, Inbox and Costs are Stage 3 and Stage
  5. This slice builds the rail that will hold their tabs and **nothing behind those tabs**.
- **Rewriting the fix-proposal path.** `lib/fix/` and the approval flow are covered by eleven
  acceptance checks and by D15/D17. Components move; logic does not (§5.3).
- The Overview itself (Stage 6). `/overview` renders one honest sentence saying it is not built.
- Any styling change to the Board. The Board looks the same afterwards, in both schemes.

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Keeps the Board working, unchanged | Same rows, same order, same colours, same fix proposals | **AC-1** |
| Shows the portfolio ribbon inside every project | Six projects as glyph + name, plus shared freshness and a back control | AC-2 |
| Renders ribbon and Board from one collector run | The two can never disagree, because there is one call | **AC-3** |
| Degrades the ribbon honestly | A failed collector run says so; it never shows six glyphs it cannot vouch for | **AC-4** |
| Shows the drift band only when that project has drifted | Present for nadim, absent for the rest, severity still on the ribbon | **AC-5** |
| Gives a watched-only project a real screen | The Board's view of it at full weight, plus one sentence on enabling execution | AC-6 |
| Shows no execution tabs where there is no execution layer | No Tasks/Goals/Sessions/Costs rail items | AC-6 |
| Returns to the Board from anywhere | The back control and `⌘1` both work from any project route | AC-7 |
| Refuses an unknown project | A stated not-found, never an empty shell | AC-8 |
| Says the Overview is not built | One sentence, no placeholder chrome pretending otherwise | AC-9 |

## §3 — What exists today (inventoried 2026-08-18, not assumed)

| Piece | State | Consequence for this slice |
|---|---|---|
| `app/layout.tsx` | 15 lines; renders `<body>{children}</body>` and metadata | The shell goes here or in a nested layout — nothing to preserve |
| `app/page.tsx` | **448 lines** — the Board, `FixSection`, `AckForm`, `Row`, and `porcelain()` | The decomposition target (§5.3) |
| `app/board.css` | 539 lines, global | Left alone (§5.2) |
| `app/globals.css` | 73 lines — **the full validated palette, both schemes** | **Already the foundation.** `--drift`, `--attention`, `--sync`, `--muted`, `--mono`, `--sans` are exactly D23's tokens |
| `lib/reconcile/board.ts` | `buildBoard(): Promise<BoardReport>` | **The shell's only data source**, and already a single call |
| Routing | one route | Everything below is new |

**Two findings from the inventory worth acting on.** The design tokens are in better shape than
expected — the palette that passed the dataviz validator is already declared in both schemes, so
this slice inherits it rather than establishing it. And `buildBoard()` is *already* the single entry
point AC-3 needs; the rule that the ribbon and the Board cannot disagree is therefore a matter of
not adding a second call, rather than of building a sharing mechanism.

## §4 — Acceptance

**Most of this suite proves a negative**, which is the correct shape for a slice whose main risk is
breaking a working Board.

- **AC-1 — the refactor changes nothing.** `pnpm verify` produces the **same result as before this
  slice** — the same passes, and the same single known failure (Stage 1 AC-2) for the same reason.
  Asserted by running both existing suites unmodified. **If a Stage 2 check changes its result, the
  decomposition went too far** (§5.3).
- **AC-2 — the ribbon carries the portfolio.** On any `/p/<slug>` route it renders all six projects
  with their severity glyphs, the freshness timestamp, and a back control.
- **AC-3 — one collector run per request.** `buildBoard` is invoked **exactly once** while
  rendering a project route, and the ribbon and any Board data on screen read that same result.
  Asserted by instrumenting the call, not by comparing rendered output — two calls that happen to
  agree today would pass an output comparison and fail in a week.
- **AC-4 — a failed collector does not produce a confident ribbon.** With the collectors degraded
  (Stage 1 AC-5's technique), the ribbon states that it could not check, and renders **no** severity
  glyphs. A ribbon showing six `✓` because a call failed is invariant 2 violated in the one
  component that is always on screen.
- **AC-5 — the band is conditional, the ribbon is not.** For a drifted project the drift band
  renders, quoting the claim verbatim from the check. For an in-sync project the band is **absent**
  and the ribbon still shows that project's severity with the shared timestamp — which is the whole
  of D23's argument, asserted rather than argued.
- **AC-6 — a watched-only project is a complete screen.** For a project with no `agentos.yml`: the
  Board's findings for it render at full weight, one sentence explains it is watched only, and the
  rail offers **no** Tasks/Goals/Sessions/Costs items.
- **AC-7 — leaving is one action from anywhere.** The back control and the `⌘1` binding both return
  to `/` from every project route.
- **AC-8 — an unknown slug is refused.** `/p/does-not-exist` renders a stated not-found, not an
  empty shell with a working ribbon.
- **AC-9 — `/overview` is honest.** One sentence naming Stage 6; no tabs, no empty table, no
  skeleton implying data is loading.

**AC-10 is a measurement, not an automated check, and is recorded as such.** At 1280px with the six
real project names, the ribbon must carry glyph + name for all six, the freshness line, and the back
control **without truncating a project name**. This is the D23 space question, and the honest way to
answer it is to look at it. **If it fails, D23 named the fallback in advance** — Concept C, a
persistent spine — and §5.4 keeps that a layout change rather than a rewrite. Record the outcome in
`docs/FEATURES.md` either way; a measurement that is taken and not written down has to be taken
again.

## §5 — Decisions

Closed. If a new one surfaces mid-build, **stop** and close it in `docs/DECISIONS.md` first.

1. **Does the Board move into the shell, or stay at `/`?** It moves, and `/` becomes the shell's
   portfolio home. Two Boards — one bare, one framed — is the duplication D22 already refused inside
   a project, and there is no reason it becomes acceptable at the top level.
2. **CSS strategy for new surfaces?** **CSS Modules per component; `board.css` is left exactly as
   it is.** Rewriting 539 lines of working, dark-mode-verified CSS to prove a convention would risk
   AC-1 for no behavioural gain. New surfaces get modules, the Board keeps its stylesheet, and both
   read the same tokens from `globals.css` — which is where the shared vocabulary actually lives.
   A single mixed-strategy stylesheet layer is a smaller cost than a big-bang restyle.
3. **How much of `app/page.tsx` is decomposed?** **Move, do not rewrite.** `Row`, `FixSection` and
   `AckForm` become components under `components/board/`; `porcelain()` moves to the collectors it
   belongs with; the server action and every guard in `lib/fix/` are untouched. The line that must
   not be crossed: **no change to what any Stage 2 acceptance check observes** (AC-1). A refactor
   that improves the fix path is a different slice with its own reason to exist.
4. **How does the pane avoid being sized for the wrong occupant?** The pane gets **no maximum
   width**, and the Tasks board is the first thing built after this slice. D26 accepts that the
   Kanban's real demand is measured one slice later; giving the pane a fixed width now would bake in
   a guess and make the D23 fallback expensive.
5. **What does `/p/<slug>` render on its own?** A redirect to the project's first available tab —
   `tasks` where an execution layer exists, the watched-only view where it does not. No landing page
   of its own, because a project overview is exactly what D22 refused.
6. **Does the ribbon show anything the Board does not?** No — glyph and name only, no counts, no
   sentences, no deltas (D23). The sentence lives on the Board so the two cannot disagree, and AC-3
   makes that structural rather than a matter of care.
7. **Is `⌘1` a client component?** Yes, one small one, for the key binding only. The rest of the
   shell stays server-rendered — D8's "on load plus a manual refresh" is unchanged by this slice,
   and a reload must keep re-running the collectors as it does today.

## §6 — Build notes

1. **Extract components with the Board still at `/`.** Run `pnpm verify` after this step alone —
   it is the whole of AC-1, and doing it before any routing exists means a failure has exactly one
   possible cause.
2. **Routing and the nested layout** — `/`, `/overview`, `/p/[slug]`, `/p/[slug]/[tab]`.
3. **The ribbon and the drift band**, reading the single `buildBoard()` result (AC-3, AC-4).
4. **The watched-only view** (frame `C3`, AC-6).
5. **`scripts/verify-stage3a.mts`** — AC-1…AC-9. Then take the AC-10 measurement and record it.

**Reuse rather than re-derive:** `buildBoard()`, the palette in `globals.css`, and the severity
glyph and colour mapping the Board already implements — the ribbon must use the *same* mapping, not
a second copy of it.

**The rule that outranks the rest of this spec:** the Board is the surface the owner actually uses,
and it works. **Any step of this slice that leaves it worse has failed, regardless of what it
improves for later stages.**

## §7 — Test seams

| Seam | What it substitutes | Used by |
|---|---|---|
| **`buildBoard`** | the whole collector layer — instrumented for call count, stubbed for degraded state | AC-3, AC-4, AC-5 |
| **the existing suites** | nothing — run unmodified, as a regression oracle | AC-1 |

**One new seam, and it is the same one Stage 1 already degrades** (AC-5's `PATH` technique). AC-1's
seam is unusual and deliberate: the existing acceptance suites are used **as a fixture**, not
extended. Their value here is precisely that they were written before this refactor and know nothing
about it.
