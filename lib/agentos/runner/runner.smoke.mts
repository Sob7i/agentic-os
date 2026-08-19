/**
 * A standalone smoke test for `FakeRunner` and `composeOptions` — T3's own proof that "the fake
 * drives a full session end-to-end" (ticket T3's Done-when line) before any later ticket depends
 * on it. This is NOT part of `pnpm verify`: T3's ticket may only touch `lib/agentos/runner/*`,
 * and wiring Stage 3's acceptance checks (AC-1…AC-19) into `scripts/verify-stage3.mts` is T6's
 * job, not this one's. No network, no model, no cost — everything here is in-process.
 *
 * Run: pnpm tsx lib/agentos/runner/runner.smoke.mts
 */
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BetaMessage, BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { randomUUID } from "node:crypto";
import { composeOptions } from "./local";
import { FakeRunner, type RunnerScript } from "./fake";
import type { RunParams } from "./runner";
import type { AgentRow } from "../types";
import { AGENTOS_SERVER, TASK_UPDATE_STATUS, qualify } from "../mcp/names";

let failures = 0;
const pass = (id: string, msg: string) => console.log(`  PASS  ${id} — ${msg}`);
const fail = (id: string, msg: string) => {
  console.log(`  FAIL  ${id} — ${msg}`);
  failures++;
};

console.log("\nT3 smoke test — FakeRunner drives a full session end-to-end\n");

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** §5.7: WebFetch/WebSearch are NOT in the MVP agent's allowedTools. */
const agent: AgentRow = {
  id: "agent-1",
  projectId: "project-1",
  name: "Builder",
  monogram: "B",
  model: "claude-opus-5", // §5.10 — do not substitute
  rolePrompt: "You are the Stage 3 MVP agent. Commit before you ask a question.",
  allowedToolsJson: JSON.stringify(["Read", "Edit", "Bash", "Grep", "Glob"]),
  disallowedToolsJson: JSON.stringify(["WebFetch", "WebSearch"]),
  canCommit: false,
  maxTurns: 40,
  maxBudgetUsd: 5,
};

function usage(inputTokens: number, outputTokens: number): BetaUsage {
  return {
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    fallback_credit: null,
    inference_geo: null,
    input_tokens: inputTokens,
    iterations: null,
    output_tokens: outputTokens,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
    speed: null,
  };
}

function assistantToolUseMessage(sessionId: string, toolName: string, input: unknown): SDKMessage {
  const message: BetaMessage = {
    id: randomUUID(),
    container: null,
    content: [{ type: "tool_use", id: randomUUID(), name: toolName, input }],
    context_management: null,
    diagnostics: null,
    model: agent.model,
    role: "assistant",
    stop_details: null,
    stop_reason: "tool_use",
    stop_sequence: null,
    type: "message",
    usage: usage(120, 40),
  };
  return {
    type: "assistant",
    message,
    parent_tool_use_id: null,
    uuid: randomUUID(),
    session_id: sessionId,
  };
}

function initMessage(sessionId: string): SDKMessage {
  return {
    type: "system",
    subtype: "init",
    apiKeySource: "user",
    claude_code_version: "0.0.0-fake",
    cwd: "/tmp/agentos-fake-worktree",
    tools: ["Read", "Edit", "Bash"],
    mcp_servers: [],
    model: agent.model,
    permissionMode: "default",
    slash_commands: [],
    output_style: "default",
    skills: [],
    plugins: [],
    uuid: randomUUID(),
    session_id: sessionId,
  };
}

function resultMessage(
  sessionId: string,
  opts: { subtype: "success" } | { subtype: "error_max_turns" | "error_max_budget_usd" },
  costUsd: number,
): SDKMessage {
  const base = {
    type: "result" as const,
    duration_ms: 4200,
    duration_api_ms: 3100,
    is_error: opts.subtype !== "success",
    num_turns: 2,
    stop_reason: null,
    total_cost_usd: costUsd,
    usage: usage(500, 220),
    modelUsage: {},
    permission_denials: [],
    uuid: randomUUID(),
    session_id: sessionId,
  };
  if (opts.subtype === "success") {
    return { ...base, subtype: "success", structured_output: undefined, result: "done" };
  }
  return { ...base, subtype: opts.subtype, errors: [`terminated: ${opts.subtype}`] };
}

// ── Scenario 1 — a clean run, end to end ────────────────────────────────────
{
  const sessionId = randomUUID();
  const script: RunnerScript = {
    messages: [
      initMessage(sessionId),
      assistantToolUseMessage(sessionId, qualify(AGENTOS_SERVER, TASK_UPDATE_STATUS), { status: "review" }),
      resultMessage(sessionId, { subtype: "success" }, 0.0842),
    ],
  };
  const runner = new FakeRunner(script);
  const seen: SDKMessage[] = [];

  const params: RunParams = {
    agent,
    cwd: "/tmp/agentos-fake-worktree",
    prompt: "Do the task.",
    onMessage: (m) => {
      seen.push(m);
    },
  };

  const outcome = await runner.run(params);

  if (seen.length !== 3) {
    fail("smoke-1", `onMessage should have fired 3 times, fired ${seen.length}`);
  } else if (outcome.sdkSessionId !== sessionId) {
    fail("smoke-1", `sdkSessionId mismatch: expected ${sessionId}, got ${outcome.sdkSessionId}`);
  } else if (outcome.costUsd !== 0.0842) {
    fail("smoke-1", `costUsd mismatch: expected 0.0842, got ${outcome.costUsd}`);
  } else if (outcome.resultSubtype !== "success") {
    fail("smoke-1", `resultSubtype mismatch: expected success, got ${outcome.resultSubtype}`);
  } else {
    pass(
      "smoke-1",
      `a full session — init, tool_use, result — replayed in order; sdkSessionId and costUsd captured from the result message`,
    );
  }
}

// ── Scenario 2 — finding (c): the result arrives before the throw ──────────
{
  const sessionId = randomUUID();
  const failResult = resultMessage(sessionId, { subtype: "error_max_budget_usd" }, 4.97);
  const script: RunnerScript = {
    messages: [initMessage(sessionId), failResult],
    throwAfterIndex: 1,
    error: new Error("query() failed: error_max_budget_usd"),
  };
  const runner = new FakeRunner(script);
  const seen: SDKMessage[] = [];
  let threw = false;
  let thrownMessage = "";

  try {
    await runner.run({
      agent,
      cwd: "/tmp/agentos-fake-worktree",
      prompt: "Do the task.",
      onMessage: (m) => {
        seen.push(m);
      },
    });
  } catch (err) {
    threw = true;
    thrownMessage = err instanceof Error ? err.message : String(err);
  }

  const capturedResult = seen.find((m) => m.type === "result");
  if (!threw) {
    fail("smoke-2", "run() should have rejected — a try that swallows this discards a real session and a real charge");
  } else if (!thrownMessage.includes("error_max_budget_usd")) {
    fail("smoke-2", `wrong error propagated: ${thrownMessage}`);
  } else if (!capturedResult || capturedResult.type !== "result" || capturedResult.total_cost_usd !== 4.97) {
    fail("smoke-2", "the result message (session_id + cost) was not captured via onMessage before the throw");
  } else {
    pass(
      "smoke-2",
      `run() rejected, but onMessage had already captured the result (cost $${capturedResult.total_cost_usd}) before the throw — finding (c) honoured`,
    );
  }
}

// ── Scenario 3 — resume options are passed through untouched (§9: "assert the resume options,
//    since the fake cannot prove the model saw anything") ──────────────────
{
  const priorSdkSessionId = randomUUID();
  const runner = new FakeRunner({ messages: [initMessage(randomUUID())] });
  await runner.run({
    agent,
    cwd: "/tmp/agentos-fake-worktree-2",
    prompt: "The human answered: yes, proceed.",
    resume: priorSdkSessionId,
    onMessage: () => {},
  });

  const call = runner.calls[0];
  if (call?.resume !== priorSdkSessionId) {
    fail("smoke-3", `resume was not threaded through to the runner call: got ${call?.resume}`);
  } else {
    pass("smoke-3", "the resume sessionId reaches the runner call unmodified");
  }
}

// ── Scenario 4 — composeOptions enforces the floor against a HOSTILE Agent row ──────────────
// The first version of this check fed an agent that already excluded WebFetch/WebSearch, so it
// asserted its own fixture rather than any behaviour — the specimen-not-behaviour trap that cost
// Stage 1 its AC-2 (docs/LEARNINGS.md). This row *asks for* both denied tools and lists neither as
// disallowed: if composeOptions merely passed configuration through, this scenario would fail.
{
  const hostile = {
    ...agent,
    allowedToolsJson: JSON.stringify(["Read", "Edit", "Bash", "WebFetch", "WebSearch"]),
    disallowedToolsJson: JSON.stringify([]),
  };
  const options = composeOptions({ agent: hostile, cwd: "/tmp/agentos-fake-worktree" });
  const allowedTools = options.allowedTools ?? [];
  const disallowedTools = options.disallowedTools ?? [];

  if (options.strictMcpConfig !== true) {
    fail("smoke-4", `strictMcpConfig must be true, got ${options.strictMcpConfig} (spec §3.1(b))`);
  } else if (options.model !== "claude-opus-5") {
    fail("smoke-4", `model must be claude-opus-5, got ${options.model} (spec §5.10)`);
  } else if (allowedTools.includes("WebFetch") || allowedTools.includes("WebSearch")) {
    fail("smoke-4", `WebFetch/WebSearch survived a hostile Agent row (spec §5.7): ${JSON.stringify(allowedTools)}`);
  } else if (!disallowedTools.includes("WebFetch") || !disallowedTools.includes("WebSearch")) {
    fail("smoke-4", `expected WebFetch/WebSearch in disallowedTools: ${JSON.stringify(disallowedTools)}`);
  } else {
    pass(
      "smoke-4",
      `composeOptions sets strictMcpConfig:true, model:claude-opus-5, and keeps WebFetch/WebSearch out of allowedTools`,
    );
  }
}

console.log(failures === 0 ? "\nAll T3 smoke checks pass.\n" : `\n${failures} FAILING.\n`);
process.exit(failures === 0 ? 0 : 1);
