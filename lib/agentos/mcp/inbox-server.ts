/**
 * The `inbox` MCP server — spec §3.3's table: `inbox_ask` only. `inbox.send` is deliberately
 * absent (§5 decision 8): a tool that cannot be misused beats an instruction not to misuse it, and
 * AgentOS-spec §8's foundational prompt already says not to message for routine progress —
 * `task_append_activity` is where that goes instead.
 *
 * **Design B, not the obvious one (§3.5).** `inbox_ask` records the question and returns
 * immediately, ending the turn — it does **not** hold a promise open until a human answers.
 * Blocking inside the handler is less code and is wrong: it holds a live subprocess and an
 * unresolved promise for as long as the human takes, which can be overnight; it does not survive a
 * `pnpm dev` restart; and it makes "walk away" — the point of an executor — the worst-handled case.
 * §3.5 says this in three sentences worth re-reading before touching this file.
 *
 * T4's job stops at: write the `InboxMessage` row, set `Session.status = 'waiting-inbox'`, and
 * acknowledge. **Worktree teardown and the resume call are T5's** (§3.5's flow diagram) — this file
 * does not reach for either.
 */
import { z } from "zod";
import { createSdkMcpServer, tool, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { createInboxMessage, updateSession } from "../db";
import type { SessionCtx } from "./context";
import { INBOX_ASK, INBOX_SERVER, TASK_APPEND_ACTIVITY } from "./names";

/**
 * §3.5 / §5.9: the conversation resumes on answer, but the filesystem does not — the worktree is
 * removed the moment this tool returns and a *new* one is created from the same base ref when the
 * human answers. Any uncommitted work in the current worktree is gone by the time that happens.
 * This sentence in the tool's own description is the only thing standing between a pause and lost
 * work, so it is not decoration — it is load-bearing prompt text, not a code comment.
 */
const INBOX_ASK_DESCRIPTION =
  "Ask a human a question and pause this task until they answer. This ENDS your turn immediately " +
  "— you will not see the answer in this conversation; a new turn resumes once the human responds. " +
  "CRITICAL: commit any work-in-progress before calling this tool. The worktree you are running in " +
  "is deleted the moment this call returns, and a fresh one is created from the same base ref when " +
  "the human's answer resumes the session — uncommitted changes do not survive the pause. Do not " +
  `use this for routine progress updates; use ${TASK_APPEND_ACTIVITY} for those instead.`;

export function createInboxAskTool(ctx: SessionCtx) {
  return tool(
    INBOX_ASK,
    INBOX_ASK_DESCRIPTION,
    {
      question: z.string(),
      choices: z.array(z.string()).optional(),
    },
    async (args) => {
      createInboxMessage(ctx.db, {
        sessionId: ctx.sessionId,
        taskId: ctx.taskId,
        kind: "question",
        body: args.question,
        choices: args.choices,
        status: "open",
      });
      updateSession(ctx.db, ctx.sessionId, { status: "waiting-inbox" });
      return {
        content: [
          {
            type: "text" as const,
            text:
              "Question recorded. This turn is ending now; the task will resume in a new turn " +
              "once a human answers. Make sure anything you need to keep is already committed.",
          },
        ],
      };
    },
  );
}

export function createInboxServer(ctx: SessionCtx): McpServerConfig {
  return createSdkMcpServer({
    name: INBOX_SERVER,
    tools: [createInboxAskTool(ctx)],
  });
}
