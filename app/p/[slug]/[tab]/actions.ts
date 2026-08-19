"use server";

import { revalidatePath } from "next/cache";
import {
  answerInboxMessage,
  getDb,
  getInboxMessage,
  getSession,
  getTask,
  writeTaskTransition,
} from "@/lib/agentos/db";
import { dispatch, resumeSession } from "@/lib/agentos/dispatch";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav } from "@/lib/shell/model";
import { loadProjectExecutionData } from "@/lib/tasks/data";

/**
 * Server actions for the Tasks board and the Inbox — the thin, non-pure edge that calls the real
 * funnel T5 already built and T6 already tested. Nothing here decides anything; each function does
 * exactly one write and revalidates the page that rendered the form.
 *
 * `slug` travels as a hidden form field, not a bound argument — the same convention
 * `app/actions.ts` (the Board's own approval gate) already established, so a form here reads the
 * same way every other form in this codebase does.
 *
 * §2's behaviour rows this closes: "Creates a task and runs it now" (`runNowAction` → `dispatch`),
 * "Accepts the same transition from the human" (`approveDoneAction` → `writeTaskTransition`), and
 * "Resumes with the answer in context" (`answerInboxAction` → `resumeSession`).
 */

/** The only human identity this slice has — matches the fixture convention `verify-stage3.mts`
 *  already established (`actorId: "owner"`). A real multi-user identity is out of scope here. */
const HUMAN_ACTOR_ID = "owner";

/**
 * Resolve the execution-layer project **from the slug, server-side**, and confirm the id the form
 * supplied actually belongs to it.
 *
 * Spec §6 said this in advance — *"the `app/actions.ts` pattern where the server rebuilds the
 * request rather than trusting the browser; the reason the browser never names a path in Stage 2
 * applies unchanged to a task id"* — and T7 shipped without it. A crafted form post carrying any
 * `taskId` would dispatch or close a task in **a different project** (review of #17).
 *
 * Returns null when the pair does not check out; every caller treats null as "do nothing".
 */
async function resolveOwnedTask(slug: string, taskId: string) {
  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav) return null;
  const data = loadProjectExecutionData(nav.project.path);
  if (!data) return null;
  const task = getTask(getDb(), taskId);
  if (!task || task.projectId !== data.project.id) return null;
  return { task, project: data.project };
}

export async function runNowAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!taskId || !slug) return;
  const owned = await resolveOwnedTask(slug, taskId);
  if (!owned) {
    console.error(`runNowAction: refused — task ${taskId} does not belong to project '${slug}'`);
    return;
  }
  const result = await dispatch(taskId, "manual");
  if (!result.started) {
    // §7.3: "a refused dispatch is over; nothing is remembered and nothing retries." There is no
    // toast/banner surface in this slice to carry `result.reason` to — logged so the refusal is at
    // least visible somewhere, and the page re-renders showing the task exactly where it was.
    console.error(`runNowAction: dispatch refused (${result.refusedBy}): ${result.reason}`);
  }
  revalidatePath(`/p/${slug}/tasks`);
}

export async function approveDoneAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!taskId || !slug) return;
  const owned = await resolveOwnedTask(slug, taskId);
  if (!owned) {
    console.error(`approveDoneAction: refused — task ${taskId} does not belong to project '${slug}'`);
    return;
  }
  const db = getDb();
  // §7.6: "any -> any, human, ... recorded as hand-moved." No gate check here — the gate exists
  // to stop a *session*, never a human; a human clicking this button is the approval itself.
  writeTaskTransition(db, {
    taskId,
    toStatus: "done",
    actorType: "human",
    actorId: HUMAN_ACTOR_ID,
    reason: "approved by owner",
  });
  revalidatePath(`/p/${slug}/tasks`);
}

export async function answerInboxAction(formData: FormData): Promise<void> {
  const messageId = String(formData.get("messageId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!messageId || !sessionId || !answer || !slug) return;
  const db = getDb();

  // Same ownership check, one hop further: the message must belong to the named session, and that
  // session's task must belong to this project. Without it a crafted post could answer — and
  // resume — a session in someone else's project (review of #17).
  const message = getInboxMessage(db, messageId);
  const session = getSession(db, sessionId);
  if (!message || !session || message.sessionId !== sessionId) return;
  const owned = await resolveOwnedTask(slug, session.taskId);
  if (!owned) {
    console.error(`answerInboxAction: refused — session ${sessionId} does not belong to project '${slug}'`);
    return;
  }

  // Resume FIRST, mark answered second. The old order marked the message answered and then called
  // `resumeSession`, so a throw there — a stale worktree that will not clear, a missing agent —
  // left an `answered` message whose session never resumed: an inbox item that looks handled and
  // is not. The reverse order can at worst resume twice, which `dispatch`'s own preconditions
  // already refuse; it cannot strand a question (review of #17).
  await resumeSession(sessionId, answer);
  answerInboxMessage(db, messageId, answer, "answered");
  revalidatePath(`/p/${slug}/inbox`);
}
