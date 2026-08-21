import type { TaskRow } from "@/lib/agentos/types";

/**
 * The board's four columns, in order (spec §8.5).
 *
 * A leaf file on purpose. This lived in `lib/tasks/model.ts` until T3, and had to move because
 * `lib/tasks/dnd.ts` needs it and **cannot import that module**: `model.ts` line 2 imports
 * `gateRefusalReason` from `lib/agentos/mcp/gate.ts`, which value-imports `../db`, which imports
 * `node:sqlite`. Anything a client component reaches must not touch that chain (AC-1).
 *
 * `model.ts` re-exports it, so every existing import site keeps working and there is still exactly
 * one definition — the same shape as `lib/agentos/egress.ts`, extracted for the same reason
 * (`docs/LEARNINGS.md`, 2026-08-19: two lists that must agree are a second source of truth).
 */
export const COLUMN_ORDER: readonly TaskRow["status"][] = ["todo", "doing", "review", "done"];
