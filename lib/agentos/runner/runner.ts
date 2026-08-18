/**
 * The `Runner` interface — the seam the whole execution slice is tested through (spec §9).
 *
 * `Runner` substitutes the entire Agent SDK: eight of nineteen Stage 3 acceptance checks cross
 * this boundary (AC-1, 3, 4, 5, 6, 7, 9, 13), and it is the only thing in the slice that may be
 * mocked (§9 — "nothing else may be mocked: SQLite is real, git is real, the MCP servers are real
 * in-process functions, and dispatch is called for real"). `LocalRunner` (local.ts) satisfies
 * this over the real `@anthropic-ai/claude-agent-sdk`; `FakeRunner` (fake.ts) satisfies it by
 * replaying a chosen `SDKMessage` sequence with no model, no subprocess and no network.
 *
 * D20 required this interface anyway, so a cloud runner can be substituted later (spec §5,
 * decision 1) — the testability here is a side effect of that, not the reason it exists.
 */
import type { CanUseTool, McpServerConfig, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRow } from "../types";

/**
 * What one call to `Runner.run` observed, once the underlying message stream has been fully
 * drained without the run itself throwing. On the failure path — see `onMessage` below — this
 * return value is never produced; the caller's own bookkeeping from `onMessage` is what survives.
 */
export interface RunOutcome {
  /**
   * From `session_id` on the init `system` message and/or the `result` message (spec §3.1's
   * table). Both name the same session; the result message is read last and wins if both were
   * seen, since it is the more authoritative of the two. Null only if the run produced no
   * message carrying one at all (a failure before the SDK could report anything).
   */
  sdkSessionId: string | null;
  /** `total_cost_usd` off the result message, verbatim — spec §3.6: "record the SDK's figure
   *  verbatim and label it as the SDK's own estimate." Null if no result message arrived. */
  costUsd: number | null;
  /** The result message's own `subtype` (e.g. `'success'`, `'error_max_turns'`,
   *  `'error_max_budget_usd'`, `'error_during_execution'`). Null if no result arrived. */
  resultSubtype: string | null;
}

export interface RunParams {
  /** The `Agent` row whose model, prompt, tool grants and budget compose the SDK options. */
  agent: AgentRow;
  /** The session's worktree path (spec §3.2) — becomes `options.cwd`. */
  cwd: string;
  /** The turn to send. On a fresh dispatch this is the task's brief; on an inbox resume (§3.5)
   *  this is the human's answer. */
  prompt: string;
  /** Set only when resuming a paused session — the prior run's `sdkSessionId`, passed through as
   *  `options.resume` (§3.1's table, §3.5). Omit to start a new session. */
  resume?: string;
  /** The two in-process MCP servers (T4), or omitted where a caller has none to attach. Passed
   *  through as `options.mcpServers`. `strictMcpConfig: true` still applies regardless — see
   *  local.ts — so no server not named here is ever reachable. */
  mcpServers?: Record<string, McpServerConfig>;
  /** The runtime gate (T4, spec §3.4's first layer). Optional so `LocalRunner` and `FakeRunner`
   *  both work in a T3-only test that has no gate to wire up yet. */
  canUseTool?: CanUseTool;
  /**
   * Fired for every `SDKMessage` as it is produced, **before** `run` settles.
   *
   * This is the capture point spec finding (c) requires: "a single-shot `query()` throws *after*
   * yielding its error result. So the result — carrying `session_id` and the cost of the work
   * already done — arrives before the throw. Code that wraps the loop in a `try` and treats the
   * `catch` as 'nothing happened' will discard a real session and a real charge." A caller that
   * wants `ToolCall` rows, or a session id and a cost even when `run` is about to reject, must
   * read them from here — not from the resolved `RunOutcome`, which the throw path never
   * produces.
   */
  onMessage: (message: SDKMessage) => void | Promise<void>;
}

export interface Runner {
  /**
   * Run one session to completion, to a pause (an `inbox.ask`, §3.5 — the run still resolves
   * normally; nothing about ending a turn early is a Runner-level failure), or to a genuine
   * failure. Resolves with `RunOutcome` on the two former paths. Rejects with the underlying
   * error on the last — callers must already have what they need from `onMessage` by then.
   */
  run(params: RunParams): Promise<RunOutcome>;
}
