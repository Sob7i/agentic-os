# Agentic OS — Learnings

Durable, hard-won lessons. Append with a date; prune when obsolete or **promoted** — a lesson
that has bitten twice must graduate into a standing rule or a gate in `CLAUDE.md`, not stay a
note that gets re-read and re-ignored. One line each; if it needs a paragraph, it probably
belongs in `docs/DECISIONS.md` instead.

## Docs & claims

- (2026-07-27) **The PRD claimed itqan was installed while not one role file existed.**
  `docs/PRD.md` §4 listed agentic-os with "all seven (self-installed)" and §8 asserted the
  install as fact, written 2026-07-26; the repo held only `PRD.md`, `DESIGN-BRIEF.md`,
  `wireframes.pen`, and `.gitignore`. The owner caught it by asking "did you actually install
  itqan?" — a human doing, by hand, exactly the check this product exists to automate. **A
  planned thing written in the present tense becomes a false claim the moment someone reads it.
  Write intent as intent.**
- (2026-07-27) **The round-1 wireframes invented a document to create a drift example.**
  Concept C's salla-apps card quotes `docs/STATE.md` saying "Working tree clean; ready to ship";
  no such file exists, and the same wireframe's roster row correctly shows salla-apps as
  Router-only. Plausible-looking placeholder content passes review precisely because it looks
  right. **When a brief says "use real data", every string is a claim — check the ones that are
  convenient.**
- (2026-07-26) A doc that references a sibling section by number (`"the brief for §6.1–6.4"`)
  goes stale the moment a section is added. Prefer naming the thing over numbering it, or
  accept that the pair must be re-read on every edit.

## Verification

- (2026-07-26) **The dataviz palette validator contradicted a reasonable-looking inheritance.**
  itqan's accent trio was adopted for status colours by eye; the validator then failed it twice
  — light teal `#0f766e` sits below the chroma floor (0.086 < 0.10, reads gray to some viewers)
  and all three dark values fall outside the dark lightness band. **A palette that looks fine is
  not a validated palette. Run the script.**
- (2026-07-26) The `dataviz` validator only auto-runs in a browser (it reads `data-palette` off
  `<body>`); from Node it must be imported and `validate()` called directly, and it needs an
  `.mjs` extension or an ESM package. Its report rows are `[name, state, detail]` where `state`
  is `true`/`false`/`"pass"`/`"floor"`/`"fail"` — not a plain string.

## Tooling

- (2026-07-27) **`.pen` files (Pencil) are plain UTF-8 JSON** — readable directly with any JSON
  parser, no MCP server and no authentication required. Structure: `{version, children[],
  themes, variables, fileToken}`; text lives on `content`, colours reference theme variables as
  `$name`. A failing Pencil MCP connection does not block reading or auditing a design file.

## Workflow

- (2026-07-27) The first three commits landed directly on `main` before the branch model was
  decided (D13). `develop` was branched from that point so history stayed consistent — but the
  decision should have been closed *before* the first commit, not after the third.
