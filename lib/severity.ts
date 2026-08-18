import type { Severity } from "@/lib/types";

/**
 * The severity vocabulary, declared once.
 *
 * Stage 3a §6: the ribbon must use the *same* mapping as the Board, not a second
 * copy of it. Two copies is how the shell and the Board start disagreeing about
 * a project — the exact failure D23 spent its rationale avoiding.
 */
export const GLYPH: Record<Severity, string> = {
  drift: "⚠",
  attention: "○",
  "in-sync": "✓",
  unverifiable: "◌",
};

export const WORD: Record<Severity, string> = {
  drift: "drift",
  attention: "attention",
  "in-sync": "in sync",
  unverifiable: "unverifiable",
};
