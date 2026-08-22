/**
 * Pure rendering helpers for chains — Stage 4 §3.1, §3.3, §3.4. Ticket:
 * docs/specs/stage-4-tickets.md T2 (binding, position) and T4 (the gate label, AC-6).
 *
 * **A leaf module.** No `db` import, no `node:` builtin — `chain.ts` (which does both) calls into
 * this file, never the other way round. T4 renders `chainPositionLabel` and `gateApprovalLabel` from
 * a client component, and `verify:stage3c` AC-1 walks the client-reachable import graph asserting
 * exactly this shape (`docs/specs/stage-4-tickets.md`, "Standing constraints — every ticket"). If
 * this file ever needs `db` or a `node:` import, that work belongs in `chain.ts` instead.
 */

/** Matches `{{name}}` — the only variable syntax a template prompt uses (spec §3.3). */
const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export type BindResult = { ok: true; text: string } | { ok: false; missing: string[] };

/**
 * Binds every `{{var}}` in `template` against `vars`, or refuses.
 *
 * **An unbound variable is never an empty string** (spec §3.3, decision 5): a name with no matching
 * key in `vars`, **or one whose value is `""`**, is reported in `missing`, in first-appearance order
 * with no duplicates, and `text` is not produced at all — there is no partial-binding result.
 *
 * **T4, docs/specs/stage-4-tickets.md T4 Step 3 — closed here, not left to the caller.** T2 wrote
 * this function against `hasOwnProperty` alone, correctly, because AC-2's wording is "with
 * `branchName` **omitted**" and nothing but the suite could call it yet. T4 adds the instantiate
 * form on the Tasks board, and an HTML form submits a blank field as `""`, not as an absent key — so
 * `{ branchName: "" }` became reachable for the first time, and `hasOwnProperty` alone would have
 * bound it to a prompt reading "create a branch named  and implement" and let it run. Refusing `""`
 * here, in the one function every caller shares, closes that for good rather than trusting each
 * caller (the form, and any future one) to refuse it first — a second caller that skips its own edge
 * check would otherwise reopen exactly this hole. The form also carries an HTML `required` attribute
 * on each variable field, which is UX only: it stops a native submit one step earlier, but a crafted
 * POST bypasses it, and this check is what actually holds.
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
    if (!Object.prototype.hasOwnProperty.call(vars, name) || vars[name] === "") {
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

/**
 * The step and assignee an approval will start — what `gateApprovalLabel` (T4) renders on a gated
 * card's own button (never a second, separate line). `assigneeLabel` arrives pre-formatted
 * (`@plan`, or the literal `human`) because deciding *which* it is needs `agentsById`, which this
 * leaf module does not have and must not import — that lookup happens in `lib/tasks/model.ts`.
 */
export interface NextChainStep {
  ord: number;
  assigneeLabel: string;
}

/**
 * `Approve & start step 2 (@plan)` — the approval control's own label (spec §5 decision 3, AC-6),
 * never a bare "Approve": *"a chain whose steps need a second click to start is not a chain… the
 * gate is honest about what it does, rather than being made safe by adding friction people learn to
 * click through."* `next` is null for a gated task with no chain, or with no following step (the
 * chain's own last gate) — falling back to `Approve & mark done`, the label a hand-made task's gate
 * has always shown.
 */
export function gateApprovalLabel(next: NextChainStep | null): string {
  if (!next) return "Approve & mark done";
  return `Approve & start step ${next.ord} (${next.assigneeLabel})`;
}
