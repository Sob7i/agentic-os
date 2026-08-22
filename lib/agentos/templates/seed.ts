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
    createTemplate(db, {
      projectId,
      slug: t.slug,
      name: t.name,
      description: t.description,
      variables: t.variables,
      seeded: true,
      steps: t.steps,
    });
  }
}
