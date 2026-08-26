import { parse } from "yaml";

/**
 * Parses `agentos.yml` — Stage 3b's own format, extended by Stage 4b §3.5 (D39, D40).
 *
 * Spec: docs/specs/stage-3b-onboarding.spec.md §3.3 (the original two keys),
 * docs/specs/stage-4b-delivery.spec.md §3.5 (`integrationBranch`, `defaultBaseRef`, `prepare`,
 * `verify`). Tickets: docs/specs/stage-3b-tickets.md T1, docs/specs/stage-4b-tickets.md T2.
 *
 * No watched repo has an `agentos.yml` yet (stage-3b-tickets.md, "What this stage inherits that
 * is not in the spec", item 1) — there is no real file to capture, so this stage **defines** the
 * format rather than reverse-engineering one. `external-API-fields-are-guilty-until-verified`
 * still applies to every field it does define: each is optional, with a stated default, and a
 * malformed file is a refusal carrying the parser's own error message verbatim, never a
 * partially-created project.
 *
 * Six keys total now. `slug` and `maxConcurrentSessions` become `Project` columns at
 * `initializeProject` time, same as always. `integrationBranch` and `defaultBaseRef` also become
 * `Project` columns (D38) — `primaryRepoPath` is still never read from here; it comes from the
 * Board's own project entry (§3.2), on purpose, so the two records cannot diverge at creation.
 * `prepare` and `verify` are **not** persisted anywhere — Stage 4b §3.1's schema adds no `Project`
 * column for either, so `dispatch()` and `resumeSession()` re-read and re-parse this file at every
 * turn to learn them (§3.5: "declared, never inferred" applies to the command as much as to
 * whether one exists at all).
 */

/** §3.5: a declared `prepare:`/`verify:` command — argv, never a shell string, with its own
 *  timeout. `command.ts`'s `runCommand` is what actually executes one of these. */
export interface CommandSpec {
  command: string[];
  timeoutMs: number;
}

export interface ParsedConfig {
  ok: true;
  /** Null means "use the Board's own slug" — the caller's default, not this module's. */
  slug: string | null;
  maxConcurrentSessions: number;
  /** D38/§3.1: the PR base `dispatch`'s `resolveBaseRef` chain terminates at. Always a real
   *  string here — defaults to `'develop'` when the key is absent, never to `null` and never to
   *  `'HEAD'` (the one thing this key may never resolve to unconfigured; `'main'`/`'master'` are
   *  refused outright, below). */
  integrationBranch: string;
  /** D38: nullable; null means "use `integrationBranch`." Never defaults to `'HEAD'`. */
  defaultBaseRef: string | null;
  /** D39: null means "no `prepare:` key" — a fact `dispatch` must keep distinct from "ran and
   *  passed," which is why the session's own `prepareExitCode` stays `null` in that case too. */
  prepare: CommandSpec | null;
  /** D40: null means "no `verify:` key" — same distinction, for `verifyExitCode`. */
  verify: CommandSpec | null;
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
/** D38/§3.1: "defaults to `integrationBranch`, not to `HEAD`" is about `defaultBaseRef`'s
 *  fallback; this is `integrationBranch` itself, unconfigured — the spec's own yaml example
 *  (§3.5) shows `integrationBranch: develop`, and D38 says the chain ends here, never at `HEAD`. */
const DEFAULT_INTEGRATION_BRANCH = "develop";
/** §3.5: "the default timeout is five minutes, not fifteen seconds" — same constant `command.ts`
 *  uses for `runCommand`'s own default, restated here rather than imported so this module has no
 *  dependency on `node:child_process` at all (it parses text; it never runs anything). */
const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;

/**
 * §3.8: never `main`, never `master` — refused outright, not merely defaulted away from.
 * `CLAUDE.md`'s workflow is explicit that `main` receives only `develop` and only from the owner;
 * an `agentos.yml` naming it as `integrationBranch` would have this product opening PRs straight
 * at the one branch the owner alone may move.
 */
const FORBIDDEN_INTEGRATION_BRANCHES = new Set(["main", "master"]);

/**
 * `prepare:`/`verify:` share a shape: a required `command` (a non-empty array of non-empty
 * strings — argv, never a shell string, §3.5) and an optional `timeoutMs`. Returns the same
 * `ParseFailure` shape the top-level parser does, so `parseAgentosYml` can return it verbatim.
 */
function parseCommandSpec(key: "prepare" | "verify", raw: unknown): { ok: true; spec: CommandSpec } | ParseFailure {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      error: `agentos.yml: "${key}" must be a mapping with a "command" key, got ${
        Array.isArray(raw) ? "a list" : typeof raw
      }`,
    };
  }
  const obj = raw as Record<string, unknown>;

  const command = obj.command;
  if (
    !Array.isArray(command) ||
    command.length === 0 ||
    command.some((c) => typeof c !== "string" || c.length === 0)
  ) {
    return {
      ok: false,
      error:
        `agentos.yml: "${key}.command" must be a non-empty array of non-empty strings (argv, not a ` +
        `shell string — a single string would be looked up as an executable with that whole name), ` +
        `got ${JSON.stringify(command)}`,
    };
  }

  let timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS;
  if (obj.timeoutMs !== undefined && obj.timeoutMs !== null) {
    const t = obj.timeoutMs;
    if (typeof t !== "number" || !Number.isInteger(t) || t < 1) {
      return {
        ok: false,
        error: `agentos.yml: "${key}.timeoutMs" must be a positive integer (milliseconds), got ${JSON.stringify(t)}`,
      };
    }
    timeoutMs = t;
  }

  return { ok: true, spec: { command: command as string[], timeoutMs } };
}

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
    return {
      ok: true,
      slug: null,
      maxConcurrentSessions: DEFAULT_MAX_CONCURRENT_SESSIONS,
      integrationBranch: DEFAULT_INTEGRATION_BRANCH,
      defaultBaseRef: null,
      prepare: null,
      verify: null,
    };
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

  let integrationBranch = DEFAULT_INTEGRATION_BRANCH;
  if (obj.integrationBranch !== undefined && obj.integrationBranch !== null) {
    if (typeof obj.integrationBranch !== "string" || obj.integrationBranch.trim() === "") {
      return {
        ok: false,
        error: `agentos.yml: "integrationBranch" must be a non-empty string, got ${JSON.stringify(obj.integrationBranch)}`,
      };
    }
    const trimmed = obj.integrationBranch.trim();
    if (FORBIDDEN_INTEGRATION_BRANCHES.has(trimmed)) {
      return {
        ok: false,
        error:
          `agentos.yml: "integrationBranch" may not be "${trimmed}" — this workflow's rule ` +
          `(CLAUDE.md) is that main receives only develop, and only from the owner; a project's ` +
          `PR base must name some other branch`,
      };
    }
    integrationBranch = trimmed;
  }

  let defaultBaseRef: string | null = null;
  if (obj.defaultBaseRef !== undefined && obj.defaultBaseRef !== null) {
    if (typeof obj.defaultBaseRef !== "string" || obj.defaultBaseRef.trim() === "") {
      return {
        ok: false,
        error: `agentos.yml: "defaultBaseRef" must be a non-empty string, got ${JSON.stringify(obj.defaultBaseRef)}`,
      };
    }
    defaultBaseRef = obj.defaultBaseRef.trim();
  }

  let prepare: CommandSpec | null = null;
  if (obj.prepare !== undefined && obj.prepare !== null) {
    const parsed = parseCommandSpec("prepare", obj.prepare);
    if (!parsed.ok) return parsed;
    prepare = parsed.spec;
  }

  let verify: CommandSpec | null = null;
  if (obj.verify !== undefined && obj.verify !== null) {
    const parsed = parseCommandSpec("verify", obj.verify);
    if (!parsed.ok) return parsed;
    verify = parsed.spec;
  }

  return { ok: true, slug, maxConcurrentSessions, integrationBranch, defaultBaseRef, prepare, verify };
}
