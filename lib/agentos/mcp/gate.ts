/**
 * Layer 1 of spec §3.4's two-layer gate: the SDK's own `canUseTool` runtime callback.
 *
 * The rule (§3.4): **a session may move a task to any status except `done` while `approvalGate` is
 * true.** This layer is the cheap, first pass — it declines with a `message` the agent can read and
 * adapt to (`PermissionResult`'s deny shape, `sdk.d.ts:2193`, requires exactly that field). It is
 * **not** the layer AC-5 asserts against; the tool handler (`agentos-server.ts`) is, because it is
 * the one that still holds if this layer is ever misconfigured or bypassed.
 *
 * **The trap this file exists to avoid:** `canUseTool` is handed the fully-qualified wire name
 * (`mcp__agentos__task_update_status`), not the bare tool name. Matching on the bare name would
 * make this callback never fire — a dead guard behind a green test, because layer 2 would still
 * refuse on its own and AC-5 would still pass. `qualify()` (`names.ts`) is the one place that
 * builds the qualified string; this file imports it rather than reconstructing it.
 */
import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { getTask } from "../db";
import type { SessionCtx } from "./context";
import { AGENTOS_SERVER, INBOX_ASK, TASK_UPDATE_STATUS, qualify } from "./names";

/** Shared with the handler layer (`agentos-server.ts`) so both layers state the same reason. */
export function gateRefusalReason(taskId: string): string {
  return (
    `task ${taskId} has approvalGate=true; a session may not move it to 'done'. ` +
    `Leave it in 'review' (or another non-done status) for a human to close, or use ${INBOX_ASK} ` +
    `if you need a decision before continuing.`
  );
}

/**
 * Builds the `canUseTool` callback for one session. Every tool call in the session passes through
 * this — only `task_update_status` moving to `done` on a gated task is ever declined; everything
 * else (including the same tool moving to any other status) is allowed. Constructed per session,
 * closing over `ctx.taskId` — the tool call itself carries no task id to trust (spec §3.3).
 */
export function createApprovalGate(ctx: SessionCtx): CanUseTool {
  return async (toolName, input) => {
    if (toolName !== qualify(AGENTOS_SERVER, TASK_UPDATE_STATUS)) {
      return { behavior: "allow" };
    }
    const toStatus = (input as { status?: unknown }).status;
    if (toStatus !== "done") {
      return { behavior: "allow" };
    }
    const task = getTask(ctx.db, ctx.taskId);
    if (!task || !task.approvalGate) {
      return { behavior: "allow" };
    }
    return { behavior: "deny", message: gateRefusalReason(ctx.taskId) };
  };
}
