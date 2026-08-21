"use client";

import { useActionState, useEffect } from "react";
import type { AgentRow } from "@/lib/agentos/types";
import { TOOL_GRANT_OPTIONS } from "@/lib/agentos/agent-form";
import type { AgentFormResult } from "@/app/p/[slug]/config/actions";
import { drawerOutcome } from "@/lib/shell/drawer";
import s from "./config.module.css";

const INITIAL_STATE: AgentFormResult = { ok: false, reason: null, agentId: null, deniedByFloor: [] };

/**
 * The agent create/edit form (T2, spec §1.2/§5.4). One component for both modes: `agent` present
 * means edit (pre-filled, posts to `updateAction`), absent means create (posts to `createAction`).
 *
 * Tool grants are the fixed checkbox list from `lib/agentos/agent-form.ts` — never free text
 * (§5.4) — and WebFetch/WebSearch are not offered at all, because the egress floor denies them on
 * every save regardless of what is submitted; the note below says so rather than leaving the
 * absence unexplained.
 *
 * `useActionState` + the result rendered beside the button is `InitializeButton`'s own pattern
 * (T1) — the established way a refusal reaches the screen in this codebase, not a toast system.
 *
 * T2: now rendered inside `components/config/AgentsDrawer.tsx`'s `Drawer`. The `useActionState`
 * wiring is unchanged (CLAUDE.md hand-off); the effect below hands the result to `drawerOutcome`
 * (`lib/shell/drawer.ts`), which is also where `createAgentForSlug`'s `ok: true` egress-floor note
 * is kept on screen instead of the drawer closing on any `ok: true` (AC-9). `onClose`/
 * `onPendingChange` are optional so this form has no hard dependency on being inside a drawer.
 */
export function AgentForm({
  slug,
  agent,
  createAction,
  updateAction,
  onClose,
  onPendingChange,
}: {
  slug: string;
  agent: AgentRow | null;
  createAction: (prevState: AgentFormResult, formData: FormData) => Promise<AgentFormResult>;
  updateAction: (prevState: AgentFormResult, formData: FormData) => Promise<AgentFormResult>;
  /** Called once `drawerOutcome` says the result is a clean success (never on the egress-floor
   *  note case — that has to stay readable, per Stage 3b AC-5). */
  onClose?: () => void;
  /** Mirrors `useActionState`'s own `pending` up to the drawer, which has no other way to see it
   *  — it is what lets the drawer refuse an Esc mid-submit (spec §7.2). */
  onPendingChange?: (pending: boolean) => void;
}) {
  const action = agent ? updateAction : createAction;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const allowedNow: string[] = agent ? (JSON.parse(agent.allowedToolsJson) as string[]) : [];

  // **Set synchronously on submit, not only from the effect below.** `useActionState` flips
  // `pending` during the transition, but the effect that mirrors it up to the drawer runs after
  // paint — and `<dialog>`'s `cancel` event does not wait for paint. That gap is small and it is
  // exactly the gap this guard exists to close: an `Esc` inside it closes the drawer while the
  // submit is still in flight, and the refusal that arrives a moment later has nowhere to land
  // (spec §7.2). Raised in review of #29.
  //
  // The `onSubmit` handler is safe against the form's own `required` fields: a form that fails
  // native validation never fires `submit`, so `pending` is never stranded true.
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (onClose && drawerOutcome(state, pending).close) onClose();
    // `onClose` is intentionally excluded — see the identical note in TaskForm.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  return (
    <form action={formAction} className={s.form} onSubmit={() => onPendingChange?.(true)}>
      <input type="hidden" name="slug" value={slug} />
      {agent && <input type="hidden" name="agentId" value={agent.id} />}

      <label className={s.field}>
        Name
        <input name="name" defaultValue={agent?.name ?? ""} required />
      </label>

      <label className={s.field}>
        Monogram
        <input name="monogram" defaultValue={agent?.monogram ?? ""} maxLength={3} required />
      </label>

      <label className={s.field}>
        Model
        <input name="model" defaultValue={agent?.model ?? "claude-opus-5"} required />
      </label>

      <label className={s.field}>
        Role prompt
        <textarea name="rolePrompt" defaultValue={agent?.rolePrompt ?? ""} rows={4} required />
      </label>

      <fieldset className={s.tools}>
        <legend>Tool grants</legend>
        {TOOL_GRANT_OPTIONS.map((tool) => (
          <label key={tool} className={s.toolOption}>
            <input type="checkbox" name="tools" value={tool} defaultChecked={allowedNow.includes(tool)} />
            {tool}
          </label>
        ))}
        <p className={s.floorNote}>
          WebFetch and WebSearch are not offered here — the egress floor denies both on every save
          (invariant 1), so there is no grant this form could give them.
        </p>
      </fieldset>

      <label className={s.checkboxField}>
        <input type="checkbox" name="canCommit" defaultChecked={agent?.canCommit ?? false} />
        Can commit
      </label>

      <label className={s.field}>
        Max turns
        <input name="maxTurns" type="number" min={1} step={1} defaultValue={agent?.maxTurns ?? ""} />
      </label>

      <label className={s.field}>
        Max budget (USD)
        <input name="maxBudgetUsd" type="number" min={0.01} step="0.01" defaultValue={agent?.maxBudgetUsd ?? ""} />
      </label>

      <button type="submit" className={s.submit} disabled={pending}>
        {pending ? "Saving…" : agent ? "Save changes" : "Create agent"}
      </button>

      {state.reason && <p className={state.ok ? s.note : s.error}>{state.reason}</p>}
    </form>
  );
}
