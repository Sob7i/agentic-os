"use client";

import { useActionState, useEffect } from "react";
import type { AgentRow } from "@/lib/agentos/types";
import type { CreateTaskResult } from "@/app/p/[slug]/[tab]/actions";
import { drawerOutcome } from "@/lib/shell/drawer";
import s from "./tasks.module.css";

const INITIAL_STATE: CreateTaskResult = { ok: false, reason: null, taskId: null };

/** The select's own value for "no agent — deliberately human" (spec §7.1). Never `undefined`,
 *  never a real agent id — `createTaskForSlug` treats exactly this string as "resolve to null." */
const HUMAN_ONLY_VALUE = "";

/**
 * The task create form (T3, spec §1.3/§6 note 3). Title, description, an assignee select offering
 * every agent in the project **plus an explicit human-only option**, and an approval-gate toggle.
 *
 * Reuses the board's existing card model — creating a task here writes a row that
 * `lib/tasks/model.ts`'s `cardModel` already knows how to render; this file adds no new render
 * path for the card itself, only the form that produces one.
 *
 * `useActionState` + the result rendered beside the button is `InitializeButton`'s and
 * `AgentForm`'s own established pattern — not a toast system.
 *
 * T2: now rendered inside `components/tasks/TaskDrawer.tsx`'s `Drawer`. The `useActionState`
 * wiring is unchanged from T3 (CLAUDE.md hand-off); the only addition is the effect below, which
 * hands the result to `drawerOutcome` (`lib/shell/drawer.ts`) rather than the drawer deciding to
 * close from `state.ok` itself (AC-10). `onClose`/`onPendingChange` are optional so this form has
 * no hard dependency on being inside a drawer.
 */
export function TaskForm({
  slug,
  agents,
  action,
  onClose,
  onPendingChange,
}: {
  slug: string;
  agents: AgentRow[];
  action: (prevState: CreateTaskResult, formData: FormData) => Promise<CreateTaskResult>;
  /** Called once `drawerOutcome` says the result is a clean success. */
  onClose?: () => void;
  /** Mirrors `useActionState`'s own `pending` up to the drawer, which has no other way to see it
   *  — it is what lets the drawer refuse an Esc mid-submit (spec §7.2). */
  onPendingChange?: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (onClose && drawerOutcome(state, pending).close) onClose();
    // `onClose` is intentionally excluded: the wrapper passes a fresh closure each render, and
    // re-running this effect only cares about the result and pending actually changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  return (
    <form action={formAction} className={s.taskForm}>
      <input type="hidden" name="slug" value={slug} />

      <label className={s.field}>
        Title
        <input name="name" required />
      </label>

      <label className={s.field}>
        Description
        <textarea name="description" rows={3} />
      </label>

      <label className={s.field}>
        Assignee
        <select name="assigneeAgentId" defaultValue={HUMAN_ONLY_VALUE}>
          <option value={HUMAN_ONLY_VALUE}>Human only — no agent will run this</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.monogram} — {agent.name}
            </option>
          ))}
        </select>
      </label>

      <label className={s.checkboxField}>
        <input type="checkbox" name="approvalGate" />
        Require approval before done
      </label>

      <button type="submit" className={s.submit} disabled={pending}>
        {pending ? "Creating…" : "Create task"}
      </button>

      {state.reason && <p className={state.ok ? s.note : s.error}>{state.reason}</p>}
    </form>
  );
}
