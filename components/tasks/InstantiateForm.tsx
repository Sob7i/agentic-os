"use client";

import { useActionState, useEffect, useState } from "react";
import type { InstantiateResult } from "@/app/p/[slug]/[tab]/actions";
import type { TemplateSummary } from "@/lib/tasks/data";
import { drawerOutcome } from "@/lib/shell/drawer";
import s from "./tasks.module.css";

const INITIAL_STATE: InstantiateResult = { ok: false, reason: null, chainId: null };

/**
 * The instantiate form (Stage 4, T4, spec §5.8 / §3.3). A template select, its own variables
 * rendered as plain text fields, and a submit that turns a click into N real task cards or a
 * refusal naming exactly what did not resolve — instantiate is all-or-nothing (§3.3), so there is no
 * partial-success state for this form to render.
 *
 * **Every variable field carries `required`** — a native-submit nicety only. The actual refusal a
 * blank field produces comes from `bindPrompt` (`lib/agentos/chain-render.ts`), which treats an
 * explicit `""` the same as an omitted variable (Step 3's decision, this ticket): `required` stops
 * the common case one round-trip earlier, but a crafted POST bypasses it, and `bindPrompt` is what
 * actually holds against one.
 *
 * Same `useActionState` + `drawerOutcome` wiring `TaskForm.tsx` (T3) established — copied rather
 * than abstracted, per that file's own comment: each form's wiring is small enough that a shared
 * hook would cost more to read than it would save.
 */
export function InstantiateForm({
  slug,
  templates,
  action,
  onClose,
  onPendingChange,
}: {
  slug: string;
  templates: TemplateSummary[];
  action: (prevState: InstantiateResult, formData: FormData) => Promise<InstantiateResult>;
  /** Called once `drawerOutcome` says the result is a clean success. */
  onClose?: () => void;
  /** Mirrors `useActionState`'s own `pending` up to the drawer (spec §7.2's Esc-mid-submit guard). */
  onPendingChange?: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug ?? "");
  const selected = templates.find((t) => t.slug === templateSlug) ?? templates[0];

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (onClose && drawerOutcome(state, pending).close) onClose();
    // `onClose` is intentionally excluded — see `TaskForm.tsx`'s identical comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  return (
    <form action={formAction} className={s.taskForm} onSubmit={() => onPendingChange?.(true)}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="templateSlug" value={templateSlug} />

      <label className={s.field}>
        Template
        <select value={templateSlug} onChange={(e) => setTemplateSlug(e.target.value)}>
          {templates.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name} — {t.steps.length} steps
            </option>
          ))}
        </select>
      </label>

      {selected?.description && <p className={s.note}>{selected.description}</p>}

      {(selected?.variables ?? []).map((name) => (
        <label className={s.field} key={name}>
          {name}
          <input name={`variable_${name}`} required />
        </label>
      ))}

      <button type="submit" className={s.submit} disabled={pending}>
        {pending ? "Instantiating…" : "Instantiate"}
      </button>

      {state.reason && <p className={state.ok ? s.note : s.error}>{state.reason}</p>}
    </form>
  );
}
