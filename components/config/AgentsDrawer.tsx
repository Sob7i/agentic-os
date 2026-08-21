"use client";

import { useState } from "react";
import type { AgentRow } from "@/lib/agentos/types";
import type { AgentFormResult } from "@/app/p/[slug]/config/actions";
import type { InitialDrawer } from "@/lib/shell/drawer";
import { Drawer } from "@/components/shell/Drawer";
import { AgentForm } from "./AgentForm";
import s from "./config.module.css";

/**
 * Owns the agents drawer's open/closed state for `/config/agents` (T2). Two ways in:
 *
 * - The `+ Agent` trigger, always a fresh create.
 * - The server-rendered `?agent=<id>` edit case, seeded through `initial`
 *   (`lib/shell/drawer.ts`'s `initialDrawerFor`, computed by the page from the same
 *   `loadProjectExecutionData` read it already does).
 *
 * `app/p/[slug]/config/[section]/page.tsx` keys this component by the edit id so a change in
 * `?agent=` — a new server render, not a client state update this component could see any other
 * way — remounts it with a fresh `initial` rather than reconciling stale local state against a new
 * prop.
 *
 * `openCount` re-keys `AgentForm` on every open the same way `TaskDrawer` does, so a stale
 * `useActionState` result from a previous open never bleeds into the next one (spec §7.2).
 */
export function AgentsDrawer({
  slug,
  agentsById,
  initial,
  createAction,
  updateAction,
}: {
  slug: string;
  agentsById: Map<string, AgentRow>;
  initial: InitialDrawer;
  createAction: (prevState: AgentFormResult, formData: FormData) => Promise<AgentFormResult>;
  updateAction: (prevState: AgentFormResult, formData: FormData) => Promise<AgentFormResult>;
}) {
  const [open, setOpen] = useState(initial.open);
  const [mode, setMode] = useState<InitialDrawer>(initial);
  const [openCount, setOpenCount] = useState(0);
  const [pending, setPending] = useState(false);

  const agent = mode.open && mode.mode === "edit" ? agentsById.get(mode.agentId) ?? null : null;

  return (
    <>
      <button
        type="button"
        className={s.addAgentTrigger}
        onClick={() => {
          setMode({ open: true, mode: "create" });
          setOpenCount((c) => c + 1);
          setOpen(true);
        }}
      >
        + Agent
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={agent ? `Edit ${agent.name}` : "New agent"}
        blockNativeClose={pending}
      >
        <AgentForm
          key={openCount}
          slug={slug}
          agent={agent}
          createAction={createAction}
          updateAction={updateAction}
          onClose={() => setOpen(false)}
          onPendingChange={setPending}
        />
      </Drawer>
    </>
  );
}
