import { cache } from "react";
import { buildBoard } from "./board";

/**
 * One collector run per request — Stage 3a AC-3.
 *
 * D23 lets the ribbon carry severity only because it is the *same* check the
 * Board renders, at the same instant. In the App Router a layout and a page are
 * separate render functions, so the natural thing is two `buildBoard()` calls
 * whose results agree today and diverge the first time a collector is slow or a
 * repo is written to between them.
 *
 * React's `cache` makes the second caller a no-op for the life of one request.
 * Every shell surface reads through here; nothing calls `buildBoard` directly.
 */
export const boardOnce = cache(buildBoard);
