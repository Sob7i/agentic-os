import type { DatabaseSync } from "node:sqlite";
import {
  dbIfExists,
  getAgent,
  getChain,
  getSession,
  getTask,
  listAgentsByProject,
  listCommitShas,
  countOpenInboxByProject,
  listInboxMessagesBySession,
  listProjects,
  listSessionsByProject,
  listTaskEvents,
  listTasksByProject,
  listTemplateSteps,
  listTemplatesByProject,
  listToolCallsBySession,
  parseJsonColumn,
} from "@/lib/agentos/db";
import type {
  AgentRow,
  InboxMessageRow,
  ProjectRow,
  SessionRow,
  TaskEventRow,
  TaskRow,
} from "@/lib/agentos/types";
import type { SessionViewInput } from "./session-model";

/** One step, projected for display only — the instantiate form and the templates config section
 *  (Stage 4, T4). Never rendered as bound prompt text; that only ever exists on a chain's own tasks. */
export interface TemplateStepSummary {
  ord: number;
  name: string;
  assigneeAgentName: string;
  approvalGate: boolean;
}

/**
 * A project's template, projected for the instantiate form (`components/tasks/InstantiateForm.tsx`)
 * and the `/p/<slug>/config/templates` section — Stage 4, T4. `variables` is the parsed form of
 * `TaskTemplateRow.variablesJson` ("parse at the edge," `lib/agentos/types.ts`'s own convention);
 * this loader is that edge.
 */
export interface TemplateSummary {
  slug: string;
  name: string;
  description: string;
  variables: string[];
  steps: TemplateStepSummary[];
}

/**
 * The thin, non-pure adapter between `data/agentos.sqlite` and `lib/tasks/model.ts`'s pure
 * functions. Nothing here decides anything a check needs to assert — it only fetches and indexes
 * rows, the same role `dispatch.ts`'s own `getDb()` calls play one layer down. Card decisions stay
 * in `lib/tasks/model.ts`, where `scripts/verify-stage3.mts` can assert them without a database.
 *
 * **Resolves the execution layer's own `Project` row by `primaryRepoPath`, never by matching
 * strings a human chose twice.** The Board's slug (`lib/shell/model.ts`'s `slugFor`) and the
 * AgentOS `Project.slug` column are two independently-typed strings with no shared source of
 * truth — nothing in this codebase keeps them equal by construction, and there is (deliberately,
 * per T7's own ticket scope) no tool yet that creates a `Project` row from an `agentos.yml`
 * appearing on disk. The repo path both records is the one fact that cannot drift between them.
 */

export interface ProjectExecutionData {
  project: ProjectRow;
  tasks: TaskRow[];
  agentsById: Map<string, AgentRow>;
  sessionsById: Map<string, SessionRow>;
  eventsByTask: Map<string, TaskEventRow[]>;
  toolCallCountBySession: Map<string, number>;
  commitShasBySession: Map<string, string[]>;
  inboxMessages: InboxMessageRow[];
  /** The project's templates (Stage 4), seeded plus any it defines later — the instantiate form
   *  and the `templates` config section both read this, never `db.ts` directly. */
  templates: TemplateSummary[];
  /**
   * Display name of the template a chain was instantiated from (`Chain.templateVersionJson.
   * template.name`), keyed by `Chain.id` — Stage 4's chain-position chip needs it and a card has no
   * other way to reach it, since `Task` carries `chainId`/`chainOrd` but not the template's name.
   * Built from one `getChain` per distinct `chainId` among this project's tasks — never a full
   * `Chain` table scan, and never re-queried by a pure function downstream.
   */
  chainTemplateNameByChainId: Map<string, string>;
}

/**
 * Null means "this board project has no execution-layer `Project` row yet" — a real, currently
 * ordinary state (no watched project has ever been onboarded into `data/agentos.sqlite`), not an
 * error. Callers render that as an honest "not initialized" pane rather than a crash or a 404 —
 * the shell already decided this project *has* an execution layer (`agentos.yml` on disk, D18);
 * this is one level deeper: whether it has been connected to a database record yet.
 */
export function loadProjectExecutionData(
  primaryRepoPath: string,
  dbOverride?: DatabaseSync,
): ProjectExecutionData | null {
  // Never `getDb()` here — it would CREATE the store just because someone opened the page. Same
  // side effect the boot hook was fixed for; review of #17 found the page path still had it.
  const db = dbOverride ?? dbIfExists();
  if (!db) return null;
  const project = listProjects(db).find((p) => p.primaryRepoPath === primaryRepoPath);
  if (!project) return null;

  const tasks = listTasksByProject(db, project.id);
  const agentsById = new Map(listAgentsByProject(db, project.id).map((a) => [a.id, a]));
  const sessions = listSessionsByProject(db, project.id);
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));

  const eventsByTask = new Map<string, TaskEventRow[]>();
  for (const t of tasks) eventsByTask.set(t.id, listTaskEvents(db, t.id));

  const toolCallCountBySession = new Map<string, number>();
  const commitShasBySession = new Map<string, string[]>();
  const inboxMessages: InboxMessageRow[] = [];
  for (const s of sessions) {
    toolCallCountBySession.set(s.id, listToolCallsBySession(db, s.id).length);
    commitShasBySession.set(
      s.id,
      listCommitShas(db, s.id).map((r) => r.sha),
    );
    inboxMessages.push(...listInboxMessagesBySession(db, s.id));
  }

  const templates: TemplateSummary[] = listTemplatesByProject(db, project.id).map((t) => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
    variables: parseJsonColumn<string[]>(t.variablesJson),
    steps: listTemplateSteps(db, t.id).map((s) => ({
      ord: s.ord,
      name: s.name,
      assigneeAgentName: s.assigneeAgentName,
      approvalGate: s.approvalGate,
    })),
  }));

  // One `getChain` per distinct `chainId` this project's tasks name — not every `Chain` row that
  // exists (a chain with zero surviving tasks, which nothing in this product produces, would be
  // silently skipped, correctly: there is no card left to label).
  const chainTemplateNameByChainId = new Map<string, string>();
  for (const t of tasks) {
    if (!t.chainId || chainTemplateNameByChainId.has(t.chainId)) continue;
    const chain = getChain(db, t.chainId);
    if (!chain) continue;
    const version = parseJsonColumn<{ template: { name: string } }>(chain.templateVersionJson);
    chainTemplateNameByChainId.set(t.chainId, version.template.name);
  }

  return {
    project,
    tasks,
    agentsById,
    sessionsById,
    eventsByTask,
    toolCallCountBySession,
    commitShasBySession,
    inboxMessages,
    templates,
    chainTemplateNameByChainId,
  };
}

/**
 * The session view's own loader. Null covers three cases the route must not tell apart with a
 * different message (a session id is either this project's or it is not — leaking which reason
 * would be a minor information disclosure for no benefit): no session, no task, or a session that
 * belongs to a different project's task entirely.
 */
export function loadSessionDetail(
  primaryRepoPath: string,
  sessionId: string,
  dbOverride?: DatabaseSync,
): SessionViewInput | null {
  const db = dbOverride ?? dbIfExists();
  if (!db) return null;
  const project = listProjects(db).find((p) => p.primaryRepoPath === primaryRepoPath);
  if (!project) return null;
  const session = getSession(db, sessionId);
  if (!session) return null;
  const task = getTask(db, session.taskId);
  if (!task || task.projectId !== project.id) return null;
  const agent = getAgent(db, session.agentId);
  if (!agent) return null;
  return {
    session,
    task,
    agent,
    toolCalls: listToolCallsBySession(db, session.id),
    commitShas: listCommitShas(db, session.id).map((r) => r.sha),
  };
}

/**
 * The rail's Inbox count, or `null`.
 *
 * **`null` is not `0`.** Null means the question was never asked — no store on
 * disk, or no `Project` row for this repo path. Zero means it was asked and the
 * answer was none. Collapsing them would put a confident "no open questions"
 * in the rail for a project that has never been initialized, which is
 * invariant 2 in the one component that is always on screen (AC-3).
 *
 * Same null contract as `loadProjectExecutionData` above, for the same reason,
 * and it never calls `getDb()` — opening a page must not create the store.
 */
export function openInboxCount(
  primaryRepoPath: string,
  dbOverride?: DatabaseSync,
): number | null {
  const db = dbOverride ?? dbIfExists();
  if (!db) return null;
  const project = listProjects(db).find((p) => p.primaryRepoPath === primaryRepoPath);
  if (!project) return null;
  return countOpenInboxByProject(db, project.id);
}
