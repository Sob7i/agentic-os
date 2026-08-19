"use server";

import { revalidatePath } from "next/cache";
import { answerInboxMessage, getDb, writeTaskTransition } from "@/lib/agentos/db";
import { dispatch, resumeSession } from "@/lib/agentos/dispatch";

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

export async function runNowAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!taskId || !slug) return;
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
  answerInboxMessage(db, messageId, answer, "answered");
  await resumeSession(sessionId, answer);
  revalidatePath(`/p/${slug}/inbox`);
}
