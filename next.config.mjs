import { builtinModules } from "node:module";

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

/** @type {import("next").NextConfig} */
const nextConfig = {
  // T7 (Stage 3, docs/specs/stage-3-execution-mvp.spec.md §7.7): instrumentation.ts wires the boot
  // sweep, which reaches `node:sqlite` (`lib/agentos/db.ts`) and, via `dispatch.ts` →
  // `lib/collectors/exec.ts`, `node:child_process` and `node:crypto`. Next.js compiles
  // `instrumentation.ts` for an edge-runtime target as well as the nodejs one — even though this
  // app declares no edge routes, and even with the file's own `NEXT_RUNTIME` guard, which only
  // gates *execution*, not compilation — and in `next dev` specifically (not `next build`, which
  // already tree-shakes the dead branch) that edge compiler tries to resolve each `node:`-prefixed
  // builtin it finds and fails with `UnhandledSchemeError`, one at a time, which then reports every
  // route as 500 until fixed. Found by actually running `pnpm dev` against a seeded fixture
  // project, not assumed — externalizing them one at a time as each surfaced (`child_process`, then
  // `crypto`) is what showed this needs to be every `node:` builtin, not a specific list to
  // maintain by hand as this file's import graph grows.
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      config.externals = [
        ...(config.externals ?? []),
        ({ request }, callback) =>
          request && NODE_BUILTINS.has(request) ? callback(null, `node-commonjs ${request}`) : callback(),
      ];
    }
    return config;
  },
};
export default nextConfig;
