"use client";

import { useState } from "react";
import type { InstantiateResult } from "@/app/p/[slug]/[tab]/actions";
import type { TemplateSummary } from "@/lib/tasks/data";
import { Drawer } from "@/components/shell/Drawer";
import { InstantiateForm } from "./InstantiateForm";
import s from "./tasks.module.css";

/**
 * Owns the "+ From template" drawer's open/closed state (Stage 4, T4) — the same shape
 * `TaskDrawer.tsx` (T2) already established: seeded closed every time, re-keyed on `openCount` so a
 * second open never shows the previous instantiate's stale result.
 *
 * Renders nothing when the project has no templates (a fresh, un-seeded project should not be able
 * to open a drawer with nothing in it — the empty state is "no button," not "a button that opens
 * onto emptiness").
 */
export function InstantiateDrawer({
  slug,
  templates,
  action,
}: {
  slug: string;
  templates: TemplateSummary[];
  action: (prevState: InstantiateResult, formData: FormData) => Promise<InstantiateResult>;
}) {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [pending, setPending] = useState(false);

  if (templates.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className={s.addFromTemplateTrigger}
        onClick={() => {
          setOpenCount((c) => c + 1);
          setOpen(true);
        }}
      >
        + From template
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Instantiate a template" blockNativeClose={pending}>
        <InstantiateForm
          key={openCount}
          slug={slug}
          templates={templates}
          action={action}
          onClose={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </Drawer>
    </>
  );
}
