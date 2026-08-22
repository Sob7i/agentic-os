import type { TaskRow } from "@/lib/agentos/types";
import { COLUMN_ORDER } from "./columns";

/**
 * The drop rule (T3, D33) — one function, called twice.
 *
 * Once in the browser, so a refused drag is refused instantly and never becomes a request; and
 * once inside the server action, which **never trusts that the first call happened**. §3.2 is why
 * the second one is not optional: `assertLegalTransition` in `lib/agentos/db.ts` returns early for
 * `human`, so `LEGAL_TRANSITIONS` constrains sessions and the system and nothing else. There is no
 * layer beneath the action that would catch an illegal human move.
 *
 * **This file is a leaf and must stay one.** It imports types and `COLUMN_ORDER`, and nothing
 * else. `lib/tasks/model.ts` cannot be used here: its line 2 imports `gateRefusalReason` from
 * `lib/agentos/mcp/gate.ts`, whose own line 17 is a *value* import of `../db`, which imports
 * `node:sqlite` — so a client component importing the tasks model pulls the SQLite driver into the
 * browser bundle. It is invisible today only because every consumer is a server component, and
 * `next.config.mjs`'s `externals` guard covers the edge runtime, not this. AC-1 asserts it
 * structurally; the symptom otherwise is every route 500-ing under `pnpm dev` while `pnpm build`
 * passes (`docs/LEARNINGS.md`, 2026-08-19).
 *
 * The gate's refusal therefore arrives as **data** — a string the server already computed from
 * `gateModelFor` — rather than by importing the function that produces it. §8.4's *"one reason,
 * one source"* stays literally true: the string is passed, never copied.
 */

/**
 * The minimum both callers can produce: the client from a `CardModel` plus its column, the server
 * from a `TaskRow` plus its gate.
 */
export interface DropCandidate {
  taskId: string;
  from: TaskRow["status"];
  /**
   * `gateModelFor(task)`'s output, narrowed to what a drop needs — or null for an ungated card.
   *
   * `humanRefusalReason` is the **human** rendering (D36), not the default. The session rendering
   * says *"a session may not move it to 'done'"* and points at `inbox_ask`; the person dragging
   * the card is not a session and cannot call that tool.
   */
  gate: { humanRefusalReason: string } | null;
  /**
   * `Task.blockedReason` — non-null while a chain step is waiting on its predecessor (Stage 4 §3.2).
   *
   * Optional so every pre-Stage-4 caller keeps compiling; absent and `null` both mean "not blocked".
   */
  blockedReason?: string | null;
}

export type DropVerdict =
  | { ok: true; from: TaskRow["status"]; to: TaskRow["status"] }
  | { ok: false; kind: "gate" | "unknown-column" | "same-column" | "blocked"; reason: string };

function isColumn(value: string): value is TaskRow["status"] {
  return (COLUMN_ORDER as readonly string[]).includes(value);
}

/**
 * Whether this card may be dropped on this column, and why not when it may not.
 *
 * `unknown-column` is checked **first and at runtime**, before anything reads the card. The
 * parameter is typed `string` rather than `TaskRow["status"]` deliberately: this runs at a server
 * boundary, and a TypeScript signature is not a runtime allowlist. Without this branch an
 * arbitrary destination reaches `writeTaskTransition`, trips SQLite's status `CHECK`, and surfaces
 * as an unhandled action error instead of a refusal — a crash where a "no" belongs.
 *
 * `same-column` is a named case rather than an early `return null` because React 19's StrictMode
 * double-invokes effects in development: a duplicated `onDragEnd` must be a no-op that writes
 * nothing, and it is this branch that makes that true.
 */
export function dropVerdict(card: DropCandidate, to: string): DropVerdict {
  if (!isColumn(to)) {
    return {
      ok: false,
      kind: "unknown-column",
      reason: `'${to}' is not a column on this board`,
    };
  }
  if (to === card.from) {
    return { ok: false, kind: "same-column", reason: `already in '${to}'` };
  }
  if (to === "done" && card.gate) {
    return { ok: false, kind: "gate", reason: card.gate.humanRefusalReason };
  }
  /**
   * **A `blocked` chip has to block something.** Raised in review of #38.
   *
   * Stage 3 §7.6 called `blockedReason` "a label on the card, not a fifth status value", and that
   * was accurate when nothing produced one. Stage 4 produces eight of them per chain, and a label
   * that refuses nothing is a claim the UI makes and the system does not honour — the exact shape
   * this product exists to catch. Dragging step 6 to `doing` while step 5 has never run reorders a
   * sequence the human was shown as a forecast (§3.2).
   *
   * It stays a label, not a status: this refuses the *move*, and the chip clears by itself the
   * moment the predecessor finishes (`advanceChainAfterDone`). Nothing here needs a sixth column.
   */
  if (card.blockedReason) {
    return {
      ok: false,
      kind: "blocked",
      reason: `${card.blockedReason} — finish that step first, or delete this card`,
    };
  }
  return { ok: true, from: card.from, to };
}

/**
 * Build the `DropCandidate` a card hands to the drag layer.
 *
 * **This lives in `lib/` because it is a decision that can be wrong, and it was.** It sat in
 * `components/tasks/Board.tsx` and silently omitted `blockedReason`, so D43's refusal — real,
 * tested, and asserted by AC-3b — never fired on the actual board: every blocked card dragged
 * cleanly and was caught only by the server. A suite that cannot see this function cannot catch
 * that, which is exactly what `CLAUDE.md`'s "every decision that can be wrong goes in `lib/`" rule
 * exists to prevent. Raised in review of #38; AC-3c asserts it here.
 *
 * Structurally typed rather than importing `CardModel`, which would pull `lib/tasks/model.ts` —
 * and through it `db` — into this leaf.
 */
export function dropCandidateFor(
  card: { id: string; gate: { humanRefusalReason: string } | null; blockedReason: string | null },
  columnKey: TaskRow["status"],
): DropCandidate {
  return {
    taskId: card.id,
    from: columnKey,
    // The gate's **human** rendering is what crosses the boundary (D36) — never the session string,
    // which tells the reader a session may not do this and points at a tool they cannot call.
    gate: card.gate ? { humanRefusalReason: card.gate.humanRefusalReason } : null,
    blockedReason: card.blockedReason,
  };
}

export interface DropTarget {
  key: TaskRow["status"];
  accepts: boolean;
  /** Null when it accepts; otherwise the same string `dropVerdict` would refuse with. */
  reason: string | null;
}

/**
 * `dropVerdict` mapped across every column, so the board's accept/refuse styling and the refusal
 * text come from one function rather than two that must agree.
 *
 * The card's own column is reported as `accepts: false` (`same-column`) rather than omitted —
 * a drop back where it started is a no-op, not an error, and the caller decides how to show that.
 */
export function dropTargets(card: DropCandidate): DropTarget[] {
  return COLUMN_ORDER.map((key) => {
    const verdict = dropVerdict(card, key);
    return { key, accepts: verdict.ok, reason: verdict.ok ? null : verdict.reason };
  });
}

/**
 * The `TaskEvent.reason` a dragged card is recorded with (D33).
 *
 * A drop is a **hand-move**: it writes `actorType: "human"` and renders in the quoted-italic
 * register the card already has for one, so a dragged card is distinguishable from an executed one
 * before either is read. Drag adds a gesture, not a new kind of evidence — which is why this
 * function exists rather than each caller composing its own sentence.
 */
export function handMoveReason(from: TaskRow["status"], to: TaskRow["status"]): string {
  return `moved by hand from '${from}' to '${to}'`;
}
