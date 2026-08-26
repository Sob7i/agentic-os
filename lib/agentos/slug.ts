/**
 * Branch-naming — spec §3.3, docs/specs/stage-4b-tickets.md T1.
 *
 * A leaf module on purpose — no imports beyond nothing at all — so AC-15's first half asserts
 * `slugify` and `sessionBranchName` directly, without spawning git. Nothing here reads or writes
 * `Task`/`Session` rows; both functions take exactly the strings they need.
 */

/**
 * Lowercase; every run of characters outside `[a-z0-9]` collapsed to a single `-`; leading and
 * trailing `-` stripped; truncated to 40 characters **at a `-` boundary** so a cut never splits a
 * word in two. A name that is entirely punctuation or non-Latin script collapses to the empty
 * string, which becomes the literal `task` — the slug is decoration, and the session id appended
 * by `sessionBranchName` is what actually makes the branch name unique (§3.3).
 */
export function slugify(name: string): string {
  const collapsed = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (collapsed === "") return "task";
  if (collapsed.length <= 40) return collapsed;

  // Cut at the last '-' within the first 40 characters, so the truncated slug never ends mid-word.
  // If there is no '-' at all in that window (one very long token with nothing to break on), the
  // plain 40-character cut is the least-bad option left — still under the limit, still deterministic.
  const truncated = collapsed.slice(0, 40);
  const lastDash = truncated.lastIndexOf("-");
  const atBoundary = lastDash > 0 ? truncated.slice(0, lastDash) : truncated;
  return atBoundary === "" ? "task" : atBoundary;
}

/**
 * `agentos/<slug>-<first 8 of sessionId>` (§3.3). The `agentos/` prefix is unclaimed by this
 * repo's own branch conventions (`feat/`, `fix/`, `chore/`, `docs/` — `CLAUDE.md`); the session id
 * suffix is what makes branch → session and session → branch both computable with no lookup table.
 */
export function sessionBranchName(name: string, sessionId: string): string {
  return `agentos/${slugify(name)}-${sessionId.slice(0, 8)}`;
}
