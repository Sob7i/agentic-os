"use client";

import { useActionState } from "react";
import type { AgentRow } from "@/lib/agentos/types";
import type { CreateTaskResult } from "@/app/p/[slug]/[tab]/actions";
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
 */
export function TaskForm({
  slug,
  agents,
  action,
}: {
  slug: string;
  agents: AgentRow[];
  action: (prevState: CreateTaskResult, formData: FormData) => Promise<CreateTaskResult>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

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
