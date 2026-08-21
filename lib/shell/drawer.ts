/**
 * The drawer's close decision (T2, docs/specs/stage-3c-tickets.md — T2 section).
 * Spec: docs/specs/stage-3c-board-and-rail.spec.md §4 AC-9/AC-10/AC-11, §7.2.
 *
 * `components/shell/Drawer.tsx` is presentational and controlled — it owns no form state and
 * makes no close decision (CLAUDE.md: shell logic is pure, shell components are dumb). The
 * decision that could be *wrong* — does this `useActionState` result mean the sheet should close —
 * lives here instead, where `scripts/verify-stage3c.mts` can assert it without rendering a form.
 *
 * `TaskForm` and `AgentForm` each keep their own `useActionState` wiring verbatim and call
 * `drawerOutcome` themselves; neither Drawer.tsx nor a wrapper component re-derives the decision
 * from `state.ok` directly (AC-10).
 */

/** The shape both `CreateTaskResult` and `AgentFormResult` already satisfy structurally. */
export interface ActionResultShape {
  ok: boolean;
  reason: string | null;
}

export type DrawerOutcome =
  | { close: true }
  | { close: false; keepOpenBecause: "pending" | "refused" | "note" };

/**
 * `ok: true` is not sufficient to close (spec §7.2, T2's traps).
 *
 * `createAgentForSlug` returns `{ok: true, reason: "…denied by the egress floor…"}` on a
 * *successful* create (`app/p/[slug]/config/actions.ts:105-110`) — Stage 3b AC-5 requires that
 * note stay on screen, so a clean `ok: true` and a `ok: true` carrying a note are different
 * outcomes here even though both are the "positive" case. This is AC-9's third case, and the one
 * a `return {close: state.ok}` simplification would silently drop.
 */
export function drawerOutcome(state: ActionResultShape, pending: boolean): DrawerOutcome {
  if (pending) return { close: false, keepOpenBecause: "pending" };
  if (!state.ok) return { close: false, keepOpenBecause: "refused" };
  if (state.reason !== null) return { close: false, keepOpenBecause: "note" };
  return { close: true };
}

export type InitialDrawer =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; agentId: string };

/**
 * Seeds the agents drawer's initial state from `?agent=<id>` (server-rendered, T2's hand-off from
 * T1's `[section]/page.tsx`).
 *
 * An **unknown** id closes rather than opening an empty edit sheet — a sheet with no agent loaded
 * into it would silently claim an agent exists that does not (AC-11). `knownAgentIds` comes from
 * the same `loadProjectExecutionData` read the page already does; this function does not read the
 * store itself.
 */
export function initialDrawerFor(
  params: { agent?: string },
  knownAgentIds: Set<string>,
): InitialDrawer {
  const { agent } = params;
  if (!agent) return { open: false };
  if (!knownAgentIds.has(agent)) return { open: false };
  return { open: true, mode: "edit", agentId: agent };
}
