"use server";

import type { DatabaseSync } from "node:sqlite";
import { revalidatePath } from "next/cache";
import {
  createAgent as createAgentRow,
  getAgent,
  getDb,
  listSessionsByProject,
  updateAgent,
} from "@/lib/agentos/db";
import type { CreateAgentInput } from "@/lib/agentos/db";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav } from "@/lib/shell/model";
import { loadProjectExecutionData } from "@/lib/tasks/data";
import {
  agentEditRefusal,
  buildAgentInput,
  egressFloorNote,
  findLiveSession,
  type RawAgentFormValues,
} from "@/lib/agentos/agent-form";

/**
 * Server actions for the configuration surface — T2, docs/specs/stage-3b-tickets.md.
 * Spec: docs/specs/stage-3b-onboarding.spec.md §1.2, §5.2, §5.3, §5.4, §6 note 2.
 *
 * Same shape as `app/p/[slug]/[tab]/actions.ts`: a thin, non-pure edge. Every decision that could
 * be *wrong* — which tool grants survive, whether an edit is refused and why — lives in
 * `lib/agentos/agent-form.ts` and is asserted there without a database. This file only resolves
 * ownership, calls the pure functions, and does the one write.
 *
 * `createAgentForSlug` / `updateAgentForSlug` are split from their bound `*Action` counterparts so
 * `scripts/verify-stage3b.mts` can call them directly with an injected `db`, the same pattern
 * `initializeProject` / `initializeProjectAction` already established in the sibling file —
 * `revalidatePath` throws outside a real Next.js request, so only the bound action touches it.
 */

/**
 * The one place in this file that reads the board. `verify:stage3a`'s AC-3 asserts at most one
 * board-read call site per module — routed through this helper rather than reading the board
 * directly, the same convention `app/p/[slug]/[tab]/actions.ts`'s own `resolveNav` established.
 */
async function resolveNav(slug: string) {
  const board = await boardOnce();
  return projectNav(board, slug);
}

/**
 * Resolves the execution-layer project **from the slug, server-side** — never from a form field —
 * and refuses a slug that does not resolve to an initialized project. Same posture as
 * `app/p/[slug]/[tab]/actions.ts`'s `resolveOwnedTask`: every action here rebuilds the request
 * from the slug rather than trusting anything the browser posted about which project it means.
 */
async function resolveOwnedProject(slug: string, db: DatabaseSync) {
  const nav = await resolveNav(slug);
  if (!nav) return null;
  const data = loadProjectExecutionData(nav.project.path, db);
  if (!data) return null;
  return { project: data.project, nav };
}

function readRawAgentForm(formData: FormData): RawAgentFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    monogram: String(formData.get("monogram") ?? ""),
    model: String(formData.get("model") ?? ""),
    rolePrompt: String(formData.get("rolePrompt") ?? ""),
    requestedTools: formData.getAll("tools").map(String),
    canCommit: formData.get("canCommit") === "on",
    maxTurns: String(formData.get("maxTurns") ?? ""),
    maxBudgetUsd: String(formData.get("maxBudgetUsd") ?? ""),
  };
}

/** What both the create and edit forms, and `scripts/verify-stage3b.mts`, read back. */
export interface AgentFormResult {
  ok: boolean;
  /** The stated reason — a refusal, a validation error, or the egress floor's own note. Null on
   *  a clean success. AC-5 and AC-8 both require this to reach the screen, not just the row. */
  reason: string | null;
  agentId: string | null;
  /** Tool names the egress floor stripped from this submission, if any (AC-5). */
  deniedByFloor: string[];
}

const EMPTY_RESULT: AgentFormResult = { ok: false, reason: null, agentId: null, deniedByFloor: [] };

/** The create form's testable core (T2). Injectable `db` for `scripts/verify-stage3b.mts`. */
export async function createAgentForSlug(
  slug: string,
  formData: FormData,
  deps: { db?: DatabaseSync } = {},
): Promise<AgentFormResult> {
  const db = deps.db ?? getDb();
  const owned = await resolveOwnedProject(slug, db);
  if (!owned) {
    return { ...EMPTY_RESULT, reason: `no such project '${slug}', or it has not been initialized` };
  }

  const built = buildAgentInput(readRawAgentForm(formData));
  if (!built.ok) return { ...EMPTY_RESULT, reason: built.error };

  const row = createAgentRow(db, { projectId: owned.project.id, ...built.input });
  return {
    ok: true,
    reason: egressFloorNote(built.deniedByFloor),
    agentId: row.id,
    deniedByFloor: built.deniedByFloor,
  };
}

export async function createAgentAction(
  _prevState: AgentFormResult,
  formData: FormData,
): Promise<AgentFormResult> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { ...EMPTY_RESULT, reason: "missing project slug" };
  const result = await createAgentForSlug(slug, formData);
  revalidatePath(`/p/${slug}/config/agents`);
  return result;
}

/**
 * The edit form's testable core (T2, AC-8). Confirms the agent id the form supplied actually
 * belongs to the project resolved from the slug — `app/p/[slug]/[tab]/actions.ts`'s
 * `resolveOwnedTask` comment explains why this check exists: a crafted post carrying any agent id
 * would otherwise let one project edit another's agent. Then refuses while a session on that agent
 * is live (§5.3), before validating or writing anything else.
 */
export async function updateAgentForSlug(
  slug: string,
  agentId: string,
  formData: FormData,
  deps: { db?: DatabaseSync } = {},
): Promise<AgentFormResult> {
  const db = deps.db ?? getDb();
  const owned = await resolveOwnedProject(slug, db);
  if (!owned) {
    return { ...EMPTY_RESULT, reason: `no such project '${slug}', or it has not been initialized` };
  }

  const agent = getAgent(db, agentId);
  if (!agent || agent.projectId !== owned.project.id) {
    return { ...EMPTY_RESULT, reason: `agent ${agentId} does not belong to project '${slug}'` };
  }

  const agentSessions = listSessionsByProject(db, owned.project.id).filter((s) => s.agentId === agentId);
  const refusal = agentEditRefusal(agent.name, findLiveSession(agentSessions));
  if (refusal) return { ok: false, reason: refusal, agentId: agent.id, deniedByFloor: [] };

  const built = buildAgentInput(readRawAgentForm(formData));
  if (!built.ok) return { ok: false, reason: built.error, agentId: agent.id, deniedByFloor: [] };

  updateAgent(db, agentId, built.input);
  return {
    ok: true,
    reason: egressFloorNote(built.deniedByFloor),
    agentId: agent.id,
    deniedByFloor: built.deniedByFloor,
  };
}

export async function updateAgentAction(
  _prevState: AgentFormResult,
  formData: FormData,
): Promise<AgentFormResult> {
  const slug = String(formData.get("slug") ?? "");
  const agentId = String(formData.get("agentId") ?? "");
  if (!slug || !agentId) return { ...EMPTY_RESULT, reason: "missing project slug or agent id" };
  const result = await updateAgentForSlug(slug, agentId, formData);
  revalidatePath(`/p/${slug}/config/agents`);
  return result;
}
