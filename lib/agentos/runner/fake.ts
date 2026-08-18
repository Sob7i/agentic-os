/**
 * `FakeRunner` — the scripted fake, spec §6.3: "the fake is not a test detail; it is what makes
 * eleven of the [nineteen] checks runnable at all." (§9's seam table: AC-1, 3, 4, 5, 6, 7, 9, 13
 * cross the `Runner` seam directly.)
 *
 * It replays a chosen `SDKMessage` sequence through the exact same `Runner` contract
 * `LocalRunner` satisfies — same `onMessage` capture point, same "throws after yielding its
 * error result" behaviour (finding (c), spec §3.1) — with no model, no subprocess, no network,
 * and no SDK import in the hot path. A caller written against `Runner` cannot tell which
 * implementation it holds, which is the point: `dispatch` (T5) and the MCP servers (T4) are
 * exercised for real, and only the boundary to "a model, a subprocess, money and the network" is
 * substituted (§9).
 */
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunOutcome, RunParams, Runner } from "./runner";

/**
 * A run to replay. `messages` are delivered to `onMessage` in order, exactly as `LocalRunner`
 * would deliver them from the real SDK. Set `throwAfterIndex` to model finding (c): the error is
 * thrown immediately after the message at that index is delivered — so a script can place a
 * `result` message (carrying a real `session_id` and `total_cost_usd`) at that index and prove a
 * caller captured it before the rejection, the same way a real failed run would leave one.
 * Leave `throwAfterIndex` unset for a clean run: `run` resolves once every message is delivered.
 */
export interface RunnerScript {
  messages: SDKMessage[];
  /** 0-based index into `messages`. Out of range (including `messages.length`) never fires. */
  throwAfterIndex?: number;
  /** Defaults to a generic error if `throwAfterIndex` is set but this is omitted. */
  error?: Error;
}

export class FakeRunner implements Runner {
  /** Every call this fake received, in order — for assertions like AC-13 (composed options; a
   *  caller that composes before invoking the runner can inspect what it built) or AC-6 ("assert
   *  the resume options, since the fake cannot prove the model saw anything"). */
  readonly calls: RunParams[] = [];

  constructor(private readonly script: RunnerScript) {}

  async run(params: RunParams): Promise<RunOutcome> {
    this.calls.push(params);

    let sdkSessionId: string | null = null;
    let costUsd: number | null = null;
    let resultSubtype: string | null = null;

    for (let i = 0; i < this.script.messages.length; i++) {
      const message = this.script.messages[i];
      await params.onMessage(message);

      if (message.type === "system" && message.subtype === "init") {
        sdkSessionId = message.session_id;
      } else if (message.type === "result") {
        sdkSessionId = message.session_id;
        costUsd = message.total_cost_usd;
        resultSubtype = message.subtype;
      }

      if (this.script.throwAfterIndex === i) {
        throw this.script.error ?? new Error("FakeRunner: scripted failure");
      }
    }

    return { sdkSessionId, costUsd, resultSubtype };
  }
}
