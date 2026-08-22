/**
 * Pure rendering helpers for chains — Stage 4 §3.1, §3.3. Ticket: docs/specs/stage-4-tickets.md T2.
 *
 * **A leaf module.** No `db` import, no `node:` builtin — `chain.ts` (which does both) calls into
 * this file, never the other way round. T4 renders `chainPositionLabel` from a client component,
 * and `verify:stage3c` AC-1 walks the client-reachable import graph asserting exactly this shape
 * (`docs/specs/stage-4-tickets.md`, "Standing constraints — every ticket"). If this file ever needs
 * `db` or a `node:` import, that work belongs in `chain.ts` instead.
 */

/** Matches `{{name}}` — the only variable syntax a template prompt uses (spec §3.3). */
const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export type BindResult = { ok: true; text: string } | { ok: false; missing: string[] };

/**
 * Binds every `{{var}}` in `template` against `vars`, or refuses.
 *
 * **An unbound variable is never an empty string** (spec §3.3, decision 5): a name with no matching
 * key in `vars` is reported in `missing`, in first-appearance order with no duplicates, and `text`
 * is not produced at all — there is no partial-binding result. A key present with an explicit empty
 * string is a value the caller supplied, not a missing one; that is `hasOwnProperty`'s job below, not
 * a truthiness check, precisely so `""` is not treated the same as "omitted" (spec AC-2's exact
 * wording is "with `branchName` **omitted**").
 */
export function bindPrompt(template: string, vars: Record<string, string>): BindResult {
  const missing: string[] = [];
  const seen = new Set<string>();
  VARIABLE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  const text = template.replace(VARIABLE_PATTERN, (_whole, name: string) => vars[name]);
  return { ok: true, text };
}

/**
 * `step 3 of 9 · compound-engineer` — a card's chain-position chip (spec §2, AC-9). `total` is
 * always read from the chain's own step count, **never hardcoded**, so a template that is not nine
 * steps long still renders correctly.
 */
export function chainPositionLabel(ord: number, total: number, templateName: string): string {
  return `step ${ord} of ${total} · ${templateName}`;
}
