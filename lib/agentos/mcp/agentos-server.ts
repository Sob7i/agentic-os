/**
 * The `agentos` MCP server — spec §3.3's table: `task_read`, `task_update_status`,
 * `task_append_activity` (D29 renamed them from the spec's dotted form — see `names.ts`). In-process (`createSdkMcpServer`), constructed per session, closing over
 * that session's `taskId` — no tool here takes a task id parameter, so the agent has no way to name
 * a *different* task to act on (§3.3, §7.1's guard-derives-its-own-bounds lesson applied a layer
 * up).
 *
 * The tool-building functions (`createTaskReadTool` etc.) are exported separately from
 * `createAgentosServer` so a test can call a tool's `.handler` directly — the shape §3.3 (closed
 * 2026-08-18) requires for AC-4/AC-5: "the fake does not simulate SDK tool dispatch... calling both
 * layers directly is the only way to assert **which** one refused."
 */
import { z } from "zod";
import { createSdkMcpServer, tool, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { getTask, updateSession, writeTaskTransition } from "../db";
import type { TaskStatus } from "../types";
import { gateRefusalReason } from "./gate";
import type { SessionCtx } from "./context";
import { AGENTOS_SERVER, INBOX_ASK, TASK_APPEND_ACTIVITY, TASK_READ, TASK_UPDATE_STATUS } from "./names";

const TASK_STATUSES: [TaskStatus, ...TaskStatus[]] = ["todo", "doing", "review", "done"];

// ---------------------------------------------------------------------------
// task_read
// ---------------------------------------------------------------------------

export function createTaskReadTool(ctx: SessionCtx) {
  return tool(
    TASK_READ,
    "Read the current state of the task this session is running against. Takes no input — the " +
      "task is fixed for the lifetime of this session. Returns its status, description, and " +
      "whether it is gated for human approval before it can be closed as done.",
    {},
    async () => {
      const task = getTask(ctx.db, ctx.taskId);
      if (!task) {
        return {
          content: [{ type: "text" as const, text: `no such task: ${ctx.taskId}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              id: task.id,
              name: task.name,
              description: task.description,
              status: task.status,
              blockedReason: task.blockedReason,
              approvalGate: task.approvalGate,
            }),
          },
        ],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// task_update_status — where spec §3.4's gate lives (layer 2)
// ---------------------------------------------------------------------------

export function createTaskUpdateStatusTool(ctx: SessionCtx) {
  return tool(
    TASK_UPDATE_STATUS,
    "Move this session's task to a new status ('todo' | 'doing' | 'review' | 'done'). A task with " +
      "approvalGate=true can be moved to any status except 'done' — a session can never close a " +
      "gated task itself; leave it in 'review' for a human. Provide 'reason' to explain the move.",
    {
      status: z.enum(TASK_STATUSES),
      reason: z.string().optional(),
    },
    async (args) => {
      const task = getTask(ctx.db, ctx.taskId);
      if (!task) {
        return {
          content: [{ type: "text" as const, text: `no such task: ${ctx.taskId}` }],
          isError: true,
        };
      }

      // Layer 2 (§3.4): refuses regardless of what let the call through — this is the layer
      // AC-5 asserts, because it is the one that still holds if canUseTool (layer 1, gate.ts) is
      // ever misconfigured. Independent of layer 1: this re-derives its own bounds from the DB
      // rather than trusting that the call was already vetted.
      if (args.status === "done" && task.approvalGate) {
        const reason = gateRefusalReason(ctx.taskId);
        // §5's reading of "records the refusal on the session": Session.failureReason, via
        // updateSession, without touching Session.status — the session is still running, a
        // refusal is not a failure. Known limitation, stated rather than fixed: a later genuine
        // failure overwrites this same column.
        updateSession(ctx.db, ctx.sessionId, { failureReason: reason });
        return {
          content: [{ type: "text" as const, text: reason }],
          isError: true,
        };
      }

      // T5 made `writeTaskTransition` throw on an arrow outside §7.6's table (AC-19's data-layer
      // enforcement). An agent asking for one — `review -> todo`, say — is making an ordinary
      // mistake, not crashing the system, and an uncaught throw here would take down the whole
      // session over it. Caught and returned as a tool error instead, matching how both refusals
      // above already behave: the agent reads the reason and adapts, which is the entire point of
      // handing it a message rather than a stack trace. Raised in review of #14; AC-19c covers it.
      try {
        writeTaskTransition(ctx.db, {
          taskId: ctx.taskId,
          toStatus: args.status,
          actorType: "session",
          actorId: ctx.sessionId,
          reason: args.reason ?? null,
        });
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `cannot move task ${ctx.taskId} from '${task.status}' to '${args.status}': ` +
                `${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          { type: "text" as const, text: `task ${ctx.taskId} moved to '${args.status}'` },
        ],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// task_append_activity — no table of its own (spec §8.6 forbids an activity feed). Every tool
// call already becomes a ToolCall row (AC-3), written by the caller from onMessage, so the
// tool-call log *is* the record here: this handler validates its input and acknowledges without
// a write of its own.
// ---------------------------------------------------------------------------

export function createTaskAppendActivityTool(ctx: SessionCtx) {
  return tool(
    TASK_APPEND_ACTIVITY,
    "Log a short progress note for this task. This is for routine progress only — it does not " +
      `notify a human and nothing reads it back to you. Use ${INBOX_ASK} instead if you actually ` +
      "need a human's input to continue.",
    { note: z.string() },
    async (args) => {
      return {
        content: [{ type: "text" as const, text: `logged: ${args.note}` }],
      };
    },
  );
}

export function createAgentosServer(ctx: SessionCtx): McpServerConfig {
  return createSdkMcpServer({
    name: AGENTOS_SERVER,
    tools: [
      createTaskReadTool(ctx),
      createTaskUpdateStatusTool(ctx),
      createTaskAppendActivityTool(ctx),
    ],
  });
}
