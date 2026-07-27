# Spec — Stage 2: gated fix proposals

status: ☑ decisions closed — build approved. §5 answered 2026-07-27; the correction mechanism in
§3.2 and its failure mode in §3.3 were **prototyped against nadim's real HANDOFF before this spec
was closed**, not assumed.

> The first slice that **writes outside this repo.** Everything before it was read-only. Product
> context: `docs/PRD.md` §6.2, §10 Stage 2. Depends on Stage 1
> (`stage-1-reconciliation.spec.md`), which must be merged first.
>
> **Read §3.3 before building anything.** It is the reason this slice is small.

---

## §1 — Scope

**In:**

1. A **proposed correction** for drift that has a deterministic fix — today, DC1 only (§3.1).
2. A **diff view**: the state doc before and after, in context.
3. An **approval gate**. Nothing is written without a per-proposal click.
4. On approval: write the corrected file **into the working tree, uncommitted**, plus the paired
   `LEARNINGS.md` entry the session-start ritual requires.
5. **Mark verified** — `data/verified.json`, local-only (D6), keyed so it expires when the claim
   changes.
6. A **fixture-based acceptance suite** — Stage 2's tests must never touch a real repo (§4).

**Out:**

- **Generated prose.** Corrections are deterministic string edits, never model-written (§5.1 —
  this is an invariant question, not a preference).
- Committing, staging, branching, or pushing in a watched repo. The write lands as an unstaged
  working-tree change and stops there.
- Fixes for DC2–DC8 (§3.1 explains why each has none).
- The Overview, transcripts, cost.

## §2 — Behaviour (rows this ships into `docs/FEATURES.md`)

| Behaviour | Expected outcome | Verify |
|---|---|---|
| Offers a correction for DC1 drift | nadim's card shows a proposed edit `#22` → `#23` | AC-1 |
| Shows the change as a diff in context | The full line, before and after, with surrounding prose | AC-2 |
| Requires approval before any write | No file changes until the gate is clicked | **AC-3** |
| Writes exactly what was shown | The file on disk matches the previewed "after", byte for byte | AC-4 |
| Pairs the fix with a LEARNINGS entry | A dated line is appended in the same approval | AC-5 |
| Refuses if the file changed since it was read | Stale proposal is rejected with a readable reason | AC-6 |
| Leaves the change uncommitted | `git status` shows a modified, unstaged file | AC-7 |
| States plainly when no fix exists | DC3/DC4/etc. show "no automatic fix" rather than a dead button | AC-8 |
| Acknowledgements survive reload and expire on change | `data/verified.json` keyed by claim hash | AC-9 |

## §3 — How the correction works

### 3.1 Which checks can be fixed — one, today

**Only DC1.** This is not a shortcut; it is what the data supports.

| Check | Deterministic fix? | Why |
|---|---|---|
| **DC1** PR frontier | **Yes** | The claim carries a number and reality carries a number. Substituting one integer inside the matched span is unambiguous. |
| DC2 "Next up" done | No | The fix is to delete or move a line — an editorial judgement, and DC2 is only 0.6 confidence. Proposing deletions from a plan on a coin-flip is the wrong trade. |
| DC3 doc older than commit | No | Nothing in the text is *wrong*; the document is merely old. The fix is "write a session update," which is authorship, not correction. |
| DC4–DC8 | No | Not claims. Uncommitted files, aging PRs, and missing roles are facts about the world, not statements in a document. There is nothing to correct. |

**The Board must say so.** A drift with no available fix shows *"no automatic fix — this needs a
human edit"*, never a disabled button with no explanation (AC-8).

### 3.2 The edit — verified against real data

Prototyped 2026-07-27 against nadim's actual `docs/HANDOFF.md`:

```
claim   : "PRs #1 through #22 merged"      (1 match, 1 occurrence in the file)
fixed   : "PRs #1 through #23 merged"
result  : 23074 bytes → 23074 bytes, 1 line changed, markdown emphasis preserved
context : "**PRs #1 through #22 merged** (verified 2026-07-13 …)"
       →  "**PRs #1 through #23 merged** (verified 2026-07-13 …)"
```

The algorithm, in full:

1. Re-run the Stage 1 extractor to locate the claim's exact span (start offset + length).
2. Substitute **only the upper-bound integer** inside that span.
3. Splice: `doc.slice(0, start) + fixed + doc.slice(start + len)`.

Nothing else in the file is touched. No reflowing, no reformatting, no normalising. If the
matched text does not appear exactly once, **abandon the proposal** rather than guess which
occurrence to edit.

### 3.3 The failure mode this slice must not hide

Look again at the verified output above. The parenthetical `(verified 2026-07-13 via gh pr list)`
is **outside** the matched claim, so it is not touched — and after the fix it sits beside a fact
that was actually verified today. **The mechanical correction has introduced a new, smaller
inaccuracy in prose it never read.**

Three consequences, and they shape the whole design:

1. **The diff shows the full line and its surrounding context, never just the changed token.** A
   human reading the line will see the stale date. A tool editing a substring cannot.
2. **This is the argument for the gate, stated concretely.** The value is not that the machine
   writes correctly — it is that the machine proposes a minimal, reviewable edit and a human
   catches the context it cannot see. An auto-applied fix would silently degrade the document.
3. **It is also the argument against generated prose** (§5.1). A model asked to "fix this
   paragraph" would likely also rewrite the date, the branch note, and the tone — producing a
   larger, less reviewable, unverifiable diff, in exchange for network egress this product does
   not permit.

The spec accepts this limitation deliberately. It is recorded in `FEATURES.md` *Known gaps* when
Stage 2 ships, and the UI names it: *"minimal edit — check the surrounding line."*

### 3.4 Safety

| Guard | Behaviour |
|---|---|
| **Content hash** | The file's SHA-256 is captured when the proposal is built and re-checked immediately before writing. Any change → refuse, with a readable reason (AC-6). |
| **Exactly-once match** | If the claim text does not occur exactly once, no proposal is offered. |
| **Never commit or stage** | The write is `fs.writeFile` only. No `git add`, no commit, no branch, no push (AC-7). |
| **Path confinement** | Writes are permitted only to files inside a configured project's directory, and only to the state doc or its `LEARNINGS.md`. Any resolved path outside → refuse. |
| **Already-dirty file** | Allowed, but the UI says so before approval — it is the owner's tree, and refusing would be paternalistic. Undo is `git checkout -- <file>`. |
| **No LEARNINGS role** | If the project has no lessons file, the paired entry is skipped and the UI says it was skipped. It is never created from nothing. |

### 3.5 The paired LEARNINGS entry

itqan's session-start ritual step 4 requires that found staleness produces a lesson, so the fix
and the lesson land in one approval (`paired-docs-update-together`). The appended line is
templated, not generated:

```
- (2026-07-27) HANDOFF's PR frontier was stale — claimed "PRs #1 through #22 merged" while #23
  was merged and #24 open. Caught by agentic-os.
```

It appends under an existing heading if one matches (`## Workflow`, `## Docs`), otherwise at the
end of the file. **Both files appear in the same diff and are approved together** — approving a
correction without its lesson would defeat the ritual the correction exists to serve.

## §4 — Acceptance

**All acceptance tests run against a generated fixture repo in a temp directory.** Stage 1's AC-6
guaranteed that no watched repo is ever written to; Stage 2 introduces writes, so its tests must
never point at a real project. A test that mutates nadim to prove it can mutate nadim has
destroyed the thing it was verifying.

- **AC-1** — Given a fixture whose state doc claims `PRs #1 through #22 merged` and a stubbed
  reality of `#23 merged, #24 open`, a proposal is produced changing `#22` → `#23`.
- **AC-2** — The proposal exposes before/after **for the whole line**, not the token alone.
- **AC-3 — nothing is written without approval.** Build a proposal, do not approve, assert the
  fixture is byte-identical. *The single most important test in this slice.*
- **AC-4** — After approval, the file on disk equals the previewed "after" exactly.
- **AC-5** — `LEARNINGS.md` gains one dated line; a fixture without one is left untouched and
  reports the skip.
- **AC-6** — Mutate the fixture between proposal and approval; the write is refused with a
  reason, and the file is unchanged.
- **AC-7** — After approval, `git status --porcelain` in the fixture shows the file modified and
  **unstaged**; `git log` is unchanged.
- **AC-8** — A DC3 drift produces no proposal and an explicit "no automatic fix" state.
- **AC-9** — An acknowledgement persists across a reload, and stops applying once the underlying
  claim text changes.
- **AC-10** — Path confinement: a proposal whose resolved target is outside the project directory
  is refused.
- **AC-11 — Stage 1's AC-6 still passes.** Merely *viewing* the Board, with proposals rendered
  and unapproved, changes no watched repo.

## §5 — Decisions

All closed. Anything further stops the build and goes to `docs/DECISIONS.md` first.

1. **Are corrections generated or computed?** **Computed — deterministic string edits only.**
   This is forced, not chosen: `CLAUDE.md` §Invariants 1 and PRD §3.6 permit no network egress
   beyond `gh`, so a model-drafted rewrite is out of scope by invariant. It is also the better
   engineering answer (§3.3). **Recorded as `docs/DECISIONS.md` D15** (promoted 2026-07-27) — it
   constrains every future fix, not just this one.
   **⚠ Build against the `Fix Proposal v2 — Fixable (DC1)` frame in `design/wireframes.pen`, not
   the frame named `Fix Proposal`.** The latter is a superseded round-1 sketch proposing a
   multi-line prose rewrite, which this decision forbids. See `docs/LEARNINGS.md`.
2. **Which checks get fixes?** DC1 only (§3.1). Others state plainly that no automatic fix
   exists.
3. **Where does the write land?** Working tree, unstaged, uncommitted. The commit stays the
   owner's — `no-self-merge` generalised one step earlier.
4. **What if the file changed after the proposal was built?** Refuse and re-read. Content hash,
   captured at build and re-checked at write (§3.4).
5. **Is the LEARNINGS entry optional?** No — it is part of the same approval, shown in the same
   diff. Skipped only when the project has no lessons file.
6. **Does approving mark the drift resolved?** No. The next reconciliation re-reads the file and
   decides. **The dashboard does not get to grade its own work** — that would be a claim about
   reality substituted for a check of it.
7. **Where do tests run?** A temp fixture repo, never a watched project (§4).
8. **Undo?** None in-app. The change is unstaged, so `git checkout -- <file>` restores it. The UI
   says exactly that. Building an undo would mean tracking prior state — a second source of
   truth (D11).

## §6 — Build notes

1. `lib/fix/propose.ts` — build a proposal from a `CheckResult` (pure, no I/O beyond reading).
2. `lib/fix/apply.ts` — the guarded write: hash re-check, path confinement, unstaged write.
3. Fixture harness + AC-1…AC-11 **before** the UI. Writes are the risk here; prove them headless
   first.
4. UI: diff view and the gate on the drift card.
5. `data/verified.json` and the acknowledge control.

**The gate is a design problem, not just a button** — `docs/DESIGN-BRIEF.md` §5.2. It must read
as consequential without being so heavy the fix never gets made. Build the mechanism first; the
wireframe can land in parallel.
