/**
 * The egress floor's one list, in one place.
 *
 * Invariant 1's execution-layer carve-out is **the model API and a session's explicitly
 * allow-listed hosts — not the internet**. `WebFetch` and `WebSearch` would widen that from a
 * single mistyped configuration value, so they are denied unconditionally at **both** the moments
 * they could take effect: when an `Agent` row is written (`lib/agentos/agent-form.ts`, Stage 3b
 * AC-5) and when a session's options are composed (`lib/agentos/runner/local.ts`, Stage 3 §5.7).
 *
 * Both enforcement points are deliberate and neither is redundant — a row written before a floor
 * existed still has to be stripped at spawn, and a floor that only ran at spawn would leave the
 * stored row lying about what the agent may reach. **What is not deliberate is two lists.** T2
 * shipped a second copy with a comment accepting "two independent lists that must agree" as a
 * cost; a second source of truth about a security boundary is exactly what invariant 5 forbids,
 * and the failure mode is silent — the lists diverge and one enforcement point quietly stops
 * matching the other. Extracted here in review, 2026-08-19.
 */
export const EGRESS_DENIED_TOOLS = ["WebFetch", "WebSearch"] as const;

export type EgressDeniedTool = (typeof EGRESS_DENIED_TOOLS)[number];

/** True when a tool name may never be granted, whatever a row or a form says. */
export function isEgressDenied(tool: string): boolean {
  return (EGRESS_DENIED_TOOLS as readonly string[]).includes(tool);
}
