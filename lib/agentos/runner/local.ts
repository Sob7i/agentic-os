/**
 * `LocalRunner` — the `Runner` (runner.ts) over the real `@anthropic-ai/claude-agent-sdk`.
 *
 * Verified against the installed package (`@anthropic-ai/claude-agent-sdk@0.3.233`), not against
 * spec §3.1's table from memory — this project's standing rule is
 * `external-API-fields-are-guilty-until-verified`, and one real difference turned up:
 * `Options.canUseTool` is `(toolName, input, options) => Promise<PermissionResult | null>`, not
 * the table's simplified `(request) => { allowed: boolean }`. `PermissionResult` is
 * `{ behavior: 'allow', ... } | { behavior: 'deny', message: string, ... }`. T4 (the gate) is the
 * ticket that writes a `canUseTool`, so it needs this exact shape, not the table's; this file
 * only forwards whatever it is given and does not construct one.
 *
 * NEVER call this from anything `pnpm verify` runs. It makes a real model call and spends real
 * money the moment `run` is invoked — every runnable check goes through `FakeRunner` (fake.ts)
 * instead. This file only needs to *type-check* against the real SDK; AC-12 (spec §4) is the one
 * opt-in test, behind an env flag, that actually calls it (T6).
 */
import {
  query,
  type CanUseTool,
  type McpServerConfig,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import { parseJsonColumn } from "../db";
import type { AgentRow } from "../types";
import type { RunOutcome, RunParams, Runner } from "./runner";

/**
 * Turn an `Agent` row and a session's context into the SDK's own `Options`. Exported (not
 * private to `LocalRunner`) so a test can assert on the composed object directly — e.g. AC-13,
 * "the composed options set `strictMcpConfig: true` and list exactly the two in-process
 * servers" — without spending anything to do it.
 */
export function composeOptions(params: {
  agent: AgentRow;
  cwd: string;
  resume?: string;
  mcpServers?: Record<string, McpServerConfig>;
  canUseTool?: CanUseTool;
}): Options {
  const { agent, cwd, resume, mcpServers, canUseTool } = params;

  /**
   * The egress floor, enforced in code rather than trusted to seed data.
   *
   * Spec §5.7 says WebFetch and WebSearch are not in the MVP agent's `allowedTools`, which reads
   * as a fact about configuration — and an invariant enforced only by configuration is enforced by
   * nobody. Invariant 1's execution-layer carve-out is *the model API*, not the internet, so one
   * mistyped seed row must not be able to widen it. These are stripped from `allowedTools` and
   * forced into `disallowedTools` on every composed call, whatever the Agent row says.
   *
   * Found in review of T3: the original check asserted this against an Agent row that already
   * excluded them, so it proved the fixture rather than the behaviour — the specimen-not-behaviour
   * trap `docs/LEARNINGS.md` records from Stage 1's AC-2.
   */
  const EGRESS_DENIED = ["WebFetch", "WebSearch"] as const;
  const allowed = parseJsonColumn<string[]>(agent.allowedToolsJson).filter(
    (t) => !EGRESS_DENIED.includes(t as (typeof EGRESS_DENIED)[number]),
  );
  const disallowed = Array.from(
    new Set([...parseJsonColumn<string[]>(agent.disallowedToolsJson), ...EGRESS_DENIED]),
  );

  return {
    cwd,
    model: agent.model,
    systemPrompt: agent.rolePrompt,
    allowedTools: allowed,
    disallowedTools: disallowed,
    mcpServers: mcpServers ?? {},
    canUseTool,
    resume,
    maxTurns: agent.maxTurns ?? undefined,
    maxBudgetUsd: agent.maxBudgetUsd ?? undefined,
    /**
     * Mandatory, not a default (spec §3.1(b)). Without it the SDK reads the machine's own
     * `.mcp.json` and user settings, so a spawned agent would silently inherit the owner's own
     * MCP servers — including any that are authenticated. This is a real leak, not a style
     * point, and AC-13 asserts this literal is `true` on every composed call.
     */
    strictMcpConfig: true,
  };
}

export class LocalRunner implements Runner {
  async run(params: RunParams): Promise<RunOutcome> {
    const options = composeOptions(params);
    const stream = query({ prompt: params.prompt, options });

    let sdkSessionId: string | null = null;
    let costUsd: number | null = null;
    let resultSubtype: string | null = null;

    /**
     * Finding (c), spec §3.1: a single-shot `query()` throws *after* yielding its error result.
     * The result — carrying `session_id` and the cost already spent — arrives via `onMessage`
     * on the iteration that precedes the throw, so it is captured before this loop ever gets a
     * chance to unwind. Do not wrap this in a `try` that swallows the error: the caller must see
     * the rejection to mark the session failed. What this function returns on that path is
     * nothing — `onMessage` is the only capture point that survives it, by design (runner.ts).
     */
    for await (const message of stream) {
      await params.onMessage(message);
      if (message.type === "system" && message.subtype === "init") {
        sdkSessionId = message.session_id;
      } else if (message.type === "result") {
        sdkSessionId = message.session_id;
        costUsd = message.total_cost_usd;
        resultSubtype = message.subtype;
      }
    }

    return { sdkSessionId, costUsd, resultSubtype };
  }
}
