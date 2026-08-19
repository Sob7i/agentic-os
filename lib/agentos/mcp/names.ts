/**
 * The single source of truth for MCP wire names — spec §3.3, T4.
 *
 * `canUseTool` (spec §3.4's first gate layer) is handed the **fully-qualified** tool name, not the
 * bare one the server registers. Verified against the installed package, not assumed from the
 * spec's table: `sdk.d.ts:3763`'s own doc comment on `SDKControlMcpCallRequest.tool` says the wire
 * name is `mcp__<server>__<tool>`, with the **server** name normalized (non-`[a-zA-Z0-9_-]` → `_`)
 * — nothing in that comment, and nothing found in the bundled `sdk.mjs`, normalizes the **tool**
 * half of the pair.
 *
 * A `canUseTool` that matches on the bare tool name never fires — the exact failure Stage 2 taught
 * us to fear, a dead guard behind a green test (`docs/LEARNINGS.md`). So `qualify` is exported here
 * once, and both the gate (`gate.ts`) and its test (`scripts/verify-stage3.mts`) import the same
 * constant rather than each hardcoding the string — a test that builds its own qualified name
 * proves nothing about whether the gate's own idea of that name agrees with it.
 *
 * **Why these names use underscores and the spec's tables say dots (D29, 2026-08-18).** The spec
 * named these tools `task.read`, `task.update_status`, `task.append_activity` and `inbox.ask`.
 * Dots register fine at the MCP-protocol layer — confirmed empirically during T4: the server's
 * `_registeredTools` keeps the dot verbatim — but the Anthropic Messages API's own tool-definition
 * `name` field is documented as `^[a-zA-Z0-9_-]{1,64}$`, which excludes the dot, and nothing in the
 * installed SDK was found to rewrite the **tool** half of the pair before it reaches that API.
 * Because §3.3's closed decision has AC-4 and AC-5 call the handler and `canUseTool` **directly**,
 * no check in `pnpm verify` ever crosses that boundary — the first thing to hit it would have been
 * a real dispatch (AC-12). Renamed rather than relying on a sanitization step no one has verified
 * exists: `external-API-fields-are-guilty-until-verified`. The qualified names stay well inside the
 * 64-character limit (`mcp__agentos__task_append_activity` is 34).
 */

/** The two in-process MCP servers this ticket builds (spec §3.3's table). */
export const AGENTOS_SERVER = "agentos";
export const INBOX_SERVER = "inbox";

/** `agentos` server's tools. */
export const TASK_READ = "task_read";
export const TASK_UPDATE_STATUS = "task_update_status";
export const TASK_APPEND_ACTIVITY = "task_append_activity";

/** `inbox` server's only tool. `inbox.send` is deliberately absent (spec §5 decision 8). */
export const INBOX_ASK = "inbox_ask";

/**
 * Builds the fully-qualified wire name `canUseTool` actually receives: `mcp__<server>__<tool>`.
 * Mirrors the installed SDK's own server-name normalization (`sdk.d.ts:3763`) so this stays correct
 * if a server is ever named with a character outside `[a-zA-Z0-9_-]` — a no-op for `agentos` and
 * `inbox`, which already satisfy it, but asserted structurally rather than assumed.
 */
export function qualify(server: string, tool: string): string {
  const normalizedServer = server.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mcp__${normalizedServer}__${tool}`;
}
