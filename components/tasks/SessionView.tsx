import type { SessionViewModel } from "@/lib/tasks/session-model";
import s from "./tasks.module.css";

/**
 * The finished-session view (design brief §6.5) — "designed with as much care as the live one...
 * tool calls, duration, cost, commits, and the task it served." Deliberately dull: no auto-scroll,
 * no live update, oldest tool call first — §7.4 already decided this is a page you reload, not a
 * feed you watch.
 */
export function SessionView({ model }: { model: SessionViewModel }) {
  return (
    <>
      <div className={s.sessionHead}>
        <h1 className="mono">{model.shortId}</h1>
        <span className={s.sessionStatus}>{model.status}</span>
        {model.live && <span className={s.sessionStatus}>· live — reload to refresh</span>}
      </div>
      <p className={s.sessionFacts}>
        <span>{model.taskName}</span>
        <span>
          @{model.agentName} ({model.agentMonogram})
        </span>
        <span>{model.triggerKind}</span>
        <span>{model.durationMinutes}m</span>
        <span>{model.costUsd === null ? "cost unknown" : `$${model.costUsd.toFixed(2)}`}</span>
      </p>

      {model.failureReason && <p className={s.evidenceReason}>{model.failureReason}</p>}

      <div className={s.driftSnapshot}>
        <p>
          <strong>Started while the project claimed:</strong> &ldquo;{model.driftAtSpawn.claim}
          &rdquo; ({model.driftAtSpawn.source} · {model.driftAtSpawn.check})
        </p>
        <p>Verified at spawn: {model.driftAtSpawn.verified}</p>
      </div>

      <p className={s.commits}>
        {model.commitShas.length === 0
          ? "no commits"
          : model.commitShas.map((sha) => (
              <span key={sha} title={sha}>
                {sha.slice(0, 7)}
              </span>
            ))}
      </p>

      <p className={s.toolLabel}>
        Tool calls — {model.toolCalls.length}, oldest first, no auto-scroll
      </p>
      <ul className={s.toolList}>
        {model.toolCalls.map((tc) => (
          <li className={s.toolRow} key={tc.seq}>
            <span className={s.toolSeq}>{tc.seq}</span>
            <span className={s.toolName}>{tc.name}</span>
            <span className={s.toolInput}>{JSON.stringify(tc.input)}</span>
          </li>
        ))}
        {model.toolCalls.length === 0 && <li className={s.colEmpty}>No tool calls yet.</li>}
      </ul>
    </>
  );
}
