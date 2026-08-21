"use client";

import { useState } from "react";
import type { AgentRow } from "@/lib/agentos/types";
import type { CreateTaskResult } from "@/app/p/[slug]/[tab]/actions";
import { Drawer } from "@/components/shell/Drawer";
import { TaskForm } from "./TaskForm";
import s from "./tasks.module.css";

/**
 * Owns the tasks tab's drawer open/closed state (T2). `+ Task` replaces the form that used to sit
 * inline above the board (T3's own layout) — this is the "small client wrapper per surface" T2's
 * ticket calls for, seeded closed every time since there is no server-rendered "editing" case here
 * (unlike the agents surface's `?agent=<id>`; a task is create-only from this form).
 *
 * `openCount` re-keys `TaskForm` on every open: `useActionState`'s result otherwise survives
 * close/reopen, so a second "+ Task" click would show the first task's stale success note instead
 * of a blank form (spec §7.2, T2's traps).
 */
export function TaskDrawer({
  slug,
  agents,
  action,
}: {
  slug: string;
  agents: AgentRow[];
  action: (prevState: CreateTaskResult, formData: FormData) => Promise<CreateTaskResult>;
}) {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [pending, setPending] = useState(false);

  return (
    <>
      <button
        type="button"
        className={s.addTaskTrigger}
        onClick={() => {
          setOpenCount((c) => c + 1);
          setOpen(true);
        }}
      >
        + Task
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New task" blockNativeClose={pending}>
        <TaskForm
          key={openCount}
          slug={slug}
          agents={agents}
          action={action}
          onClose={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </Drawer>
    </>
  );
}
