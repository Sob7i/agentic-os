import type { DatabaseSync } from "node:sqlite";

/**
 * What both in-process servers close over at construction — spec §3.3: "constructed per session
 * and closing over that session's id and task id." Neither tool takes these as a parameter; the
 * object a session can act on is fixed here, once, at spawn (§7.1's "a guard must derive its bounds
 * independently of its input", applied a layer up).
 */
export interface SessionCtx {
  db: DatabaseSync;
  sessionId: string;
  taskId: string;
}
