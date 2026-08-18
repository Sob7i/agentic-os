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
 * **A load-bearing caveat this file does not resolve — see the T4 report.** The Anthropic Messages
 * API's own tool-definition `name` field is documented (platform.claude.com, fetched during this
 * build) as `^[a-zA-Z0-9_-]{1,64}$` — no dot. The spec names these tools with dots (`task.read`,
 * `task.update_status`, `task.append_activity`, `inbox.ask`), and nothing in the installed SDK
 * rewrites a dotted tool name before it would reach that API. This file keeps the spec's literal
 * names because renaming a spec-named surface is not this ticket's call to make (T4 brief §2b) —
 * it registers correctly at the MCP-protocol layer (confirmed empirically: `_registeredTools` keeps
 * the dot verbatim) and every check `pnpm verify:stage3` runs calls the handler and the callback
 * directly, per §3.3's closed decision, so it never crosses the API boundary where the character
 * set is enforced. A **real** dispatch (`LocalRunner`, AC-12) would be the first thing to hit it.
 */

/** The two in-process MCP servers this ticket builds (spec §3.3's table). */
export const AGENTOS_SERVER = "agentos";
export const INBOX_SERVER = "inbox";

/** `agentos` server's tools. */
export const TASK_READ = "task.read";
export const TASK_UPDATE_STATUS = "task.update_status";
export const TASK_APPEND_ACTIVITY = "task.append_activity";

/** `inbox` server's only tool. `inbox.send` is deliberately absent (spec §5 decision 8). */
export const INBOX_ASK = "inbox.ask";

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
