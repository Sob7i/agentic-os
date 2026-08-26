"use client";

import { useActionState, useState } from "react";
import type { PushResult } from "@/app/p/[slug]/[tab]/actions";
import s from "./tasks.module.css";

const INITIAL_STATE: PushResult = { ok: false, reason: null, prUrl: null };

/**
 * The push-and-open-PR control (Stage 4b T4, spec §3.8 / D41) — one click, on the session card of
 * a settled session with a branch and at least one commit. **Copies `InstantiateForm.tsx`'s own
 * pattern**: the server action arrives as a prop and the file `import type`s `PushResult` only.
 *
 * `verify:stage3c` AC-1 walks every `"use client"` file's *value* imports transitively and does
 * not special-case `"use server"` — a client component that value-imported `actions.ts` directly
 * would reach `node:child_process` (via `lib/agentos/push.ts`) and `lib/agentos/db` through it,
 * failing the guard (docs/specs/stage-4b-tickets.md T4, finding 5).
 *
 * **One click, not three (D41 part 2).** The ordinary path is a single button. The exception —
 * `verifyFailed` — adds one checkbox that must be ticked *before* the button enables, so the
 * confirmation and the click still land in the same POST rather than a second round-trip.
 */
export function PushControl({
  slug,
  sessionId,
  label,
  verifyFailed,
  verifyNote,
  action,
}: {
  slug: string;
  sessionId: string;
  label: string;
  /** `verifyStatusText`'s rendering of this session's verify result, composed server-side so this
   *  component never maps an exit code to words itself (D36). The sentinel for "did not complete"
   *  reached this checkbox as the bare string "exited -1" before review of #43. */
  verifyNote: string;
  /** True when this session's `verifyExitCode` is non-null and non-zero — real failure or
   *  `dispatch.ts`'s `VERIFY_DID_NOT_COMPLETE` sentinel alike. Renders the confirm checkbox. */
  verifyFailed: boolean;
  action: (prevState: PushResult, formData: FormData) => Promise<PushResult>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [confirmed, setConfirmed] = useState(false);

  if (state.ok && state.prUrl) {
    return (
      <p className={s.note}>
        Pushed & opened{" "}
        <a className={s.pushLink} href={state.prUrl} target="_blank" rel="noreferrer">
          {state.prUrl}
        </a>
      </p>
    );
  }

  return (
    <form action={formAction} className={s.pushForm}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sessionId" value={sessionId} />

      {verifyFailed && (
        <label className={s.checkboxField}>
          <input
            type="checkbox"
            name="confirmDespiteVerifyFailure"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {`Push anyway — verify: ${verifyNote}`}
        </label>
      )}

      <button type="submit" className={s.submit} disabled={pending || (verifyFailed && !confirmed)}>
        {pending ? "Pushing…" : label}
      </button>

      {state.reason && <p className={s.error}>{state.reason}</p>}
    </form>
  );
}
