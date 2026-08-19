"use client";

import { useActionState } from "react";
import type { InitializeResult } from "@/app/p/[slug]/[tab]/actions";
import s from "./tasks.module.css";

const INITIAL_STATE: InitializeResult = { ok: false, alreadyInitialized: false, reason: null };

/**
 * The connector's one button (T1, spec §5.1/D30). Sits next to the sentence explaining the
 * *not initialized* state on `app/p/[slug]/[tab]/page.tsx`.
 *
 * `action` is a server action passed down from the page — the same convention `Board`/`Card`
 * already use for `runNowAction`/`approveDoneAction`, so this file does not import from `app/`
 * itself. AC-2's refusal has to reach the screen (T7's own actions only `console.error` theirs,
 * because it had no surface); `useActionState` is the smallest honest thing that renders one —
 * not a toast system.
 */
export function InitializeButton({
  slug,
  action,
}: {
  slug: string;
  action: (prevState: InitializeResult, formData: FormData) => Promise<InitializeResult>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className={s.initForm}>
      <input type="hidden" name="slug" value={slug} />
      <button className={s.initButton} type="submit" disabled={pending}>
        {pending ? "Initializing…" : "Initialize"}
      </button>
      {state.reason && (
        <p className={state.ok ? s.initNote : s.initError}>{state.reason}</p>
      )}
    </form>
  );
}
