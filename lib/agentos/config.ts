import { parse } from "yaml";

/**
 * Parses `agentos.yml` — Stage 3b's own format.
 *
 * Spec: docs/specs/stage-3b-onboarding.spec.md §3.3. Ticket: docs/specs/stage-3b-tickets.md T1.
 *
 * No watched repo has an `agentos.yml` yet (stage-3b-tickets.md, "What this stage inherits that
 * is not in the spec", item 1) — there is no real file to capture, so this stage **defines** the
 * format rather than reverse-engineering one. `external-API-fields-are-guilty-until-verified`
 * still applies to every field it does define: each is optional, with a stated default, and a
 * malformed file is a refusal carrying the parser's own error message verbatim, never a
 * partially-created project.
 *
 * Deliberately minimal (spec §6's closing note — "one button, one row, one stated reason"): the
 * only two things a `Project` row can use from this file are a slug and `maxConcurrentSessions`.
 * `primaryRepoPath` is never read from here — it comes from the Board's own project entry (§3.2),
 * on purpose, so the two records cannot diverge at creation.
 */

export interface ParsedConfig {
  ok: true;
  /** Null means "use the Board's own slug" — the caller's default, not this module's. */
  slug: string | null;
  maxConcurrentSessions: number;
}

export interface ParseFailure {
  ok: false;
  /**
 * The parser's own message, **unchanged** — never reworded, summarised or truncated, so a human can
 * act on it directly. The caller frames it in a sentence naming the file (*"agentos.yml is
 * malformed: …"*); that is context around the message, not a change to it, and AC-2b asserts
 * containment precisely so the distinction is enforced rather than trusted. Clarified after review
 * of #20 read "verbatim" as forbidding the frame.
 */
  error: string;
}

const DEFAULT_MAX_CONCURRENT_SESSIONS = 1;

export function parseAgentosYml(text: string): ParsedConfig | ParseFailure {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // An empty (or comment-only) file parses to `undefined`/`null` — a bare opt-in with no
  // configuration at all. That is valid, not malformed: D18 already made the file's *presence*
  // the opt-in signal, so an empty body just means "accept every default."
  if (raw === undefined || raw === null) {
    return { ok: true, slug: null, maxConcurrentSessions: DEFAULT_MAX_CONCURRENT_SESSIONS };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: `agentos.yml must be a mapping of key: value pairs, not ${Array.isArray(raw) ? "a list" : typeof raw}`,
    };
  }

  const obj = raw as Record<string, unknown>;

  let slug: string | null = null;
  if (obj.slug !== undefined && obj.slug !== null) {
    if (typeof obj.slug !== "string" || obj.slug.trim() === "") {
      return {
        ok: false,
        error: `agentos.yml: "slug" must be a non-empty string, got ${JSON.stringify(obj.slug)}`,
      };
    }
    slug = obj.slug;
  }

  let maxConcurrentSessions = DEFAULT_MAX_CONCURRENT_SESSIONS;
  if (obj.maxConcurrentSessions !== undefined && obj.maxConcurrentSessions !== null) {
    const n = obj.maxConcurrentSessions;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
      return {
        ok: false,
        error: `agentos.yml: "maxConcurrentSessions" must be a positive integer, got ${JSON.stringify(n)}`,
      };
    }
    maxConcurrentSessions = n;
  }

  return { ok: true, slug, maxConcurrentSessions };
}
