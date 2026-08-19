import type { DatabaseSync } from "node:sqlite";
import {
  getAgent,
  getDb,
  getSession,
  getTask,
  listAgentsByProject,
  listCommitShas,
  listInboxMessagesBySession,
  listProjects,
  listSessionsByProject,
  listTaskEvents,
  listTasksByProject,
  listToolCallsBySession,
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
  db: DatabaseSync = getDb(),
): ProjectExecutionData | null {
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

  return {
    project,
    tasks,
    agentsById,
    sessionsById,
    eventsByTask,
    toolCallCountBySession,
    commitShasBySession,
    inboxMessages,
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
  db: DatabaseSync = getDb(),
): SessionViewInput | null {
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
