import type { AgentRow, InboxMessageRow, SessionRow, TaskRow } from "@/lib/agentos/types";
import { parseJsonColumn } from "@/lib/agentos/db";
import { shortSessionId } from "./model";

/**
 * The Inbox (design brief §6.4): "the only interrupt channel... answering resumes a paused session
 * with the answer in context." §5's rule: this is **the one legitimate counter** in the product —
 * open questions — so `InboxModel.openCount` is the single badge value this codebase is allowed to
 * render as a counter, everywhere else a count is a plain number (§8.5).
 */

export interface InboxItemModel {
  id: string;
  sessionId: string;
  shortSessionId: string;
  taskId: string;
  taskName: string;
  agentName: string;
  body: string;
  /** Null for a free-text ask. */
  choices: string[] | null;
  status: InboxMessageRow["status"];
  askedAtISO: string;
  answer: string | null;
  answeredAtISO: string | null;
}

export interface InboxModel {
  openCount: number;
  /** Open first (askedAtISO ascending — oldest blocker first), then answered, newest first. */
  items: InboxItemModel[];
}

export interface InboxModelInput {
  messages: InboxMessageRow[];
  sessionsById: Map<string, SessionRow>;
  tasksById: Map<string, TaskRow>;
  agentsById: Map<string, AgentRow>;
}

function itemFor(
  m: InboxMessageRow,
  input: InboxModelInput,
): InboxItemModel | null {
  const task = input.tasksById.get(m.taskId);
  if (!task) return null; // defensive: an orphaned message names no task
  const session = input.sessionsById.get(m.sessionId);
  const agent = session ? input.agentsById.get(session.agentId) : undefined;
  return {
    id: m.id,
    sessionId: m.sessionId,
    shortSessionId: shortSessionId(m.sessionId),
    taskId: task.id,
    taskName: task.name,
    agentName: agent?.name ?? "unknown agent",
    body: m.body,
    choices: m.choicesJson ? parseJsonColumn<string[]>(m.choicesJson) : null,
    status: m.status,
    askedAtISO: m.askedAtISO,
    answer: m.answer,
    answeredAtISO: m.answeredAtISO,
  };
}

export function inboxModel(input: InboxModelInput): InboxModel {
  const items = input.messages
    .map((m) => itemFor(m, input))
    .filter((i): i is InboxItemModel => i !== null);

  const open = items.filter((i) => i.status === "open").sort((a, b) => (a.askedAtISO < b.askedAtISO ? -1 : 1));
  const answered = items
    .filter((i) => i.status !== "open")
    .sort((a, b) => (a.askedAtISO > b.askedAtISO ? -1 : 1));

  return { openCount: open.length, items: [...open, ...answered] };
}
