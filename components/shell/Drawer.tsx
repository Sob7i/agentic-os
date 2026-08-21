"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import s from "./drawer.module.css";

/**
 * The drawer (T2, D34 — native `<dialog>`, no component library). Presentational and controlled:
 * it owns no form state and makes no decision about *whether* to close — that lives in
 * `lib/shell/drawer.ts`'s `drawerOutcome`, called by whichever form is inside it. This component
 * only opens and closes the element in response to `open`, and renders a title and a close
 * control (CLAUDE.md: shell components are dumb).
 *
 * `showModal()` is what buys the focus trap, `::backdrop` and the inert background — the reason
 * D34 rejected a component library. It must run from an effect, never during render, and it is
 * not the same as the `open` attribute: `<dialog open>` alone gives a non-modal dialog with none
 * of those properties (spec §7.2).
 *
 * `blockNativeClose` guards one specific race, not a general close decision: the browser's own
 * Esc/`cancel` gesture can fire while a submission is still pending, and a refusal or the
 * egress-floor note arriving ~300ms later would then have nowhere to land (spec §7.2, T2's
 * traps). The caller (a form's own `pending`, from its own `useActionState`) is the only place
 * that value exists — Drawer does not compute it, it only respects it, the same way it respects
 * `open`. `showModal`, `::backdrop` and the focus trap itself are the browser's promise and are
 * measured by hand (M-3), not asserted here (`docs/LEARNINGS.md`, 2026-08-18: assert what you own).
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  blockNativeClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** While true, Esc and the close control are refused rather than acted on (default false). */
  blockNativeClose?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={s.drawer}
      aria-label={title}
      onClose={onClose}
      onCancel={(event) => {
        if (blockNativeClose) event.preventDefault();
      }}
    >
      <div className={s.header}>
        <h2 className={s.title}>{title}</h2>
        <button
          type="button"
          className={s.closeButton}
          aria-label="Close"
          onClick={() => {
            if (!blockNativeClose) onClose();
          }}
        >
          ×
        </button>
      </div>
      <div className={s.content}>{children}</div>
    </dialog>
  );
}
