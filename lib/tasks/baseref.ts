/**
 * Pure normalisation for the task form's optional `baseRef` field — spec §3.1,
 * docs/specs/stage-4b-tickets.md T1. A leaf module (no imports) so the suite asserts it directly
 * rather than trusting an inline ternary in `app/p/[slug]/[tab]/actions.ts`.
 */

/**
 * Blank or whitespace-only means "use the project's default" — `null`, never `""`. `createTask`
 * treats `null` as "no override" (the resolution chain falls through to the project's own
 * `defaultBaseRef`/`integrationBranch`); a stray `""` making it into the column would instead read
 * as an explicit (and empty) override the moment anything tried to resolve it.
 */
export function normalizeBaseRefInput(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}
