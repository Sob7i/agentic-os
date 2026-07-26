# Specs — the queue

One file per buildable slice: `<slice>.spec.md`. A spec is the **queue role** — it holds work
that is decided and ready. Nothing is built from a spec that is not decision-closed.

## The status line — the machine-readable contract

Every spec's second line is a `status:` line whose **leading glyph is the contract**:

| Glyph | Means | Buildable? |
|---|---|---|
| `☑` | Decisions closed — every question §6 raises is answered | **Yes** |
| `☐` | Design closed, but gated — a decision, dependency, or approval is outstanding | **No** |

**Only the glyph is parsed. The prose after it is authored, free-form, and displayed verbatim.**

This is deliberate, and it is a constraint this project imposed on itself for a reason: the
Overview (`docs/PRD.md` §6.8.2) reads exactly this format out of *sibling* repos, where the
observed prose ranges from `decisions closed — build approved (owner, 2026-07-16)` to
`IMPLEMENTED & GREEN` to `DESIGN-CLOSED — build-GATED`. Parsing that prose would be guessing.
**If this project's own specs cannot be read by its own parser, the parser is wrong** — these
files are the fixture.

## Shape of a spec

```markdown
# Spec — <slice name>

status: ☐ design closed — <what is still gating it, and who clears it>

## §1 Scope          — what this builds, and explicitly what it does not
## §2 Behaviour      — the rows that land in docs/FEATURES.md when this ships
## §3 Data & sources — inputs, their real shapes, and what is verified vs assumed
## §4 Acceptance     — falsifiable checks; how we know it works
## §5 Decisions      — every question this raised, each answered or listed as gating
```

`§5` is what flips the glyph. When every question in it is answered, the status becomes `☑` and
the slice is buildable. If a decision surfaces mid-build, **stop** — close it in
`docs/DECISIONS.md`, update the spec, then continue. That gate is the point.

## Deliberately not here yet

The full **SPEC-CONTRACT** template (itqan's §5–§7 gate sections) is deferred — no feature has
been rebuilt because a decision surfaced mid-build, so there is no churn to mine gate findings
from. See `docs/DECISIONS.md` D1 and `docs/BACKLOG.md`.
