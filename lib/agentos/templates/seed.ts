/**
 * Seeds this project's built-in templates — idempotent on `(projectId, slug)`.
 * Spec: docs/specs/stage-4-templates-chains.spec.md §3.1. Ticket: docs/specs/stage-4-tickets.md T1.
 *
 * Called from `initializeProject` (`app/p/[slug]/[tab]/actions.ts`) on **every** call, not only the
 * row-creating one: a project that opted in before this stage shipped takes the "already
 * initialized" branch on every subsequent click and would otherwise never get a template row at
 * all. Re-seeding an already-seeded project must be a no-op, never a second row — that guard is
 * the whole of this file.
 */
import type { DatabaseSync } from "node:sqlite";
import { createTemplate, getTemplateBySlug } from "../db";
import { COMPOUND_ENGINEER_TEMPLATE } from "./compound-engineer";

/** Every built-in template this product ships. One entry today; Stage 4 adds no second one. */
const BUILT_IN_TEMPLATES = [COMPOUND_ENGINEER_TEMPLATE];

/**
 * Idempotent on `(projectId, slug)` — [G]: the existence check below is the only thing standing
 * between a second click and a second `TaskTemplate` row (AC-0c). Delete it and re-seeding
 * duplicates every built-in template once per call.
 */
export function seedBuiltInTemplates(db: DatabaseSync, projectId: string): void {
  for (const t of BUILT_IN_TEMPLATES) {
    const existing = getTemplateBySlug(db, projectId, t.slug); // [G]
    if (existing) continue; // [G]
    try {
      createTemplate(db, {
        projectId,
        slug: t.slug,
        name: t.name,
        description: t.description,
        variables: t.variables,
        seeded: true,
        steps: t.steps,
      });
    } catch (err) {
      /**
       * The read above and this insert are two statements, so two concurrent callers can both read
       * "missing" and both try to insert. Migration 3's UNIQUE index on `(projectId, slug)` is what
       * actually guarantees one row; this catch is what stops the loser of that race from throwing
       * in a user's face for a condition that is, from their point of view, already satisfied —
       * the template exists, which is all `seedBuiltInTemplates` ever promised. Raised in review of
       * #34 and #37.
       *
       * Narrow on purpose: only a uniqueness violation is swallowed. Any other failure is a real
       * one and must still surface.
       */
      const message = err instanceof Error ? err.message : String(err);
      if (!/UNIQUE constraint failed/i.test(message)) throw err;
    }
  }
}
