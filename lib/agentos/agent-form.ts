/**
 * Pure logic for the agent create/edit form — T2, docs/specs/stage-3b-tickets.md.
 * Spec: docs/specs/stage-3b-onboarding.spec.md §1.2, §4 (AC-4, AC-5, AC-8), §5.3, §5.4.
 *
 * Anything that could be *wrong* about an agent submission — which tool grants survive the
 * egress floor, whether an edit is refused and why — lives here as a pure function that
 * `scripts/verify-stage3b.mts` can assert without rendering a route or opening a database.
 * `lib/shell/model.ts` is the precedent for this split (CLAUDE.md §Conventions).
 */

import type { CreateAgentInput } from "./db";
import type { SessionRow } from "./types";
import { EGRESS_DENIED_TOOLS, isEgressDenied } from "./egress";

// ---------------------------------------------------------------------------
// Tool grants — §5.4: a fixed checkbox list, never free text.
// ---------------------------------------------------------------------------

/**
 * Every tool a real form may offer as a checkbox. WebFetch and WebSearch are deliberately
 * **absent** — the egress floor below denies them unconditionally, so offering a checkbox for a
 * grant that can never take effect would be a UI that lies about what it does. They are still
 * handled by `resolveToolGrants` below, independent of this list, because a hostile POST does not
 * have to respect what the honest form renders (AC-5's own fixture — see its comment).
 */
export const TOOL_GRANT_OPTIONS = ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "NotebookEdit"] as const;

export type ToolGrantOption = (typeof TOOL_GRANT_OPTIONS)[number];

/**
 * The egress floor, re-enforced at the moment an `Agent` row is **written**.
 *
 * `lib/agentos/runner/local.ts`'s `composeOptions` enforces the same floor at *spawn* — and that
 * is not what AC-5 tests. An invariant enforced only by the fact that nobody has ever stored a row
 * asking for these is enforced by nobody (spec §4). Two enforcement points, **one list**: T2
 * originally declared a second copy here, which review replaced with the shared constant in
 * `lib/agentos/egress.ts` — a security boundary with two definitions is a second source of truth
 * whose divergence is silent (invariant 5).
 */
export { EGRESS_DENIED_TOOLS } from "./egress";

export interface ToolGrantResolution {
  /** Survives both the egress floor and the fixed-list filter. */
  allowed: string[];
  /** Always exactly the egress-denied set — this form exposes no separate "disallow" field. */
  disallowed: string[];
  /** Which of the *requested* tools the egress floor itself stripped — the "asked for, denied"
   *  set AC-5's UI message is built from. Distinct from a request that was simply not on the
   *  fixed list, which is dropped with no message (the same posture as a checkbox that was never
   *  offered — there is nothing to explain). */
  deniedByFloor: string[];
}

/**
 * Turns whatever tool names a submission asked for into what actually gets stored.
 *
 * Order matters: the egress floor is checked **before** the fixed-list filter, so a request for
 * `WebFetch`/`WebSearch` is caught and reported even though neither name appears in
 * `TOOL_GRANT_OPTIONS` — a crafted POST does not get to route around the floor just by asking for
 * something the honest form never offers as a checkbox.
 */
export function resolveToolGrants(requested: readonly string[]): ToolGrantResolution {
  const deniedByFloor = requested.filter(isEgressDenied);
  const pastFloor = requested.filter((t) => !isEgressDenied(t));
  // Anything not on the fixed list is unrecognized — silently dropped, same as a checkbox that
  // was never rendered. §5.4: "a free-text field invites a typo that silently grants nothing —
  // or, worse, silently grants something"; this is the "grants nothing" half, enforced here too
  // so a crafted POST cannot do what a typo in a free-text field could never have done anyway.
  const allowed = pastFloor.filter((t) => (TOOL_GRANT_OPTIONS as readonly string[]).includes(t));
  const disallowed = Array.from(new Set<string>(EGRESS_DENIED_TOOLS));
  return { allowed, disallowed, deniedByFloor };
}

// ---------------------------------------------------------------------------
// Form → CreateAgentInput
// ---------------------------------------------------------------------------

export interface RawAgentFormValues {
  name: string;
  monogram: string;
  model: string;
  rolePrompt: string;
  /** Raw checkbox values as submitted — filtered by `resolveToolGrants`, never trusted as-is. */
  requestedTools: readonly string[];
  canCommit: boolean;
  /** Raw text from a number input; `""` means "not set". */
  maxTurns: string;
  maxBudgetUsd: string;
}

export type AgentFormResult =
  | { ok: true; input: Omit<CreateAgentInput, "projectId">; deniedByFloor: string[] }
  | { ok: false; error: string };

/**
 * Validates and normalizes a raw form submission into the shape `createAgent` (and this ticket's
 * own `updateAgentRow`) writes. Every field the form exposes is produced here — nothing is
 * defaulted or invented downstream — so a check reading the written row is actually reading what
 * this function decided, not a value some caller filled in behind its back.
 */
export function buildAgentInput(raw: RawAgentFormValues): AgentFormResult {
  const name = raw.name.trim();
  const monogram = raw.monogram.trim();
  const model = raw.model.trim();
  const rolePrompt = raw.rolePrompt.trim();
  if (!name) return { ok: false, error: "name is required" };
  if (!monogram) return { ok: false, error: "monogram is required" };
  if (!model) return { ok: false, error: "model is required" };
  if (!rolePrompt) return { ok: false, error: "role prompt is required" };

  const { allowed, disallowed, deniedByFloor } = resolveToolGrants(raw.requestedTools);

  const maxTurnsText = raw.maxTurns.trim();
  // A positive **integer**: `Agent.maxTurns` is an INTEGER column, and SQLite would coerce a
  // fractional value silently. The honest form sends `step={1}`, but a crafted post does not have
  // to. Review of #21.
  const maxTurns = maxTurnsText === "" ? null : Number(maxTurnsText);
  if (maxTurns !== null && (!Number.isInteger(maxTurns) || maxTurns <= 0)) {
    return { ok: false, error: `max turns must be a positive whole number, got "${maxTurnsText}"` };
  }

  const maxBudgetText = raw.maxBudgetUsd.trim();
  const maxBudgetUsd = maxBudgetText === "" ? null : Number(maxBudgetText);
  if (maxBudgetUsd !== null && (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0)) {
    return { ok: false, error: `max budget must be a positive number, got "${maxBudgetText}"` };
  }

  return {
    ok: true,
    input: {
      name,
      monogram,
      model,
      rolePrompt,
      allowedTools: allowed,
      disallowedTools: disallowed,
      canCommit: raw.canCommit,
      maxTurns,
      maxBudgetUsd,
    },
    deniedByFloor,
  };
}

/** The UI-facing sentence for AC-5's "and that the UI said so" — never silent about a denial. */
export function egressFloorNote(deniedByFloor: string[]): string | null {
  if (deniedByFloor.length === 0) return null;
  const list = deniedByFloor.join(", ");
  const verb = deniedByFloor.length === 1 ? "was" : "were";
  return `${list} ${verb} denied — WebFetch and WebSearch can never be granted (the egress floor).`;
}

// ---------------------------------------------------------------------------
// Editing while a session is live — §5.3, AC-8.
// ---------------------------------------------------------------------------

/**
 * §5.3: a session composes its SDK options from the `Agent` row **at spawn** and records nothing
 * about what that row said, so editing underneath a live session would make the session's own
 * record unreadable after the fact. "Live" is exactly the pair `lib/agentos/dispatch.ts` treats as
 * live (its own `taskLive` check) — matched here rather than re-defined, per this ticket's brief.
 */
const LIVE_SESSION_STATUSES: ReadonlySet<SessionRow["status"]> = new Set(["running", "waiting-inbox"]);

/** Pure: given an agent's own sessions, which one (if any) makes it un-editable right now. */
export function findLiveSession(sessions: readonly SessionRow[]): SessionRow | null {
  return sessions.find((s) => LIVE_SESSION_STATUSES.has(s.status)) ?? null;
}

/** Pure: the stated reason AC-8 requires, naming the session — or `null` when editing is fine. */
export function agentEditRefusal(agentName: string, liveSession: SessionRow | null): string | null {
  if (!liveSession) return null;
  return `agent "${agentName}" cannot be edited while session ${liveSession.id} is ${liveSession.status}`;
}
