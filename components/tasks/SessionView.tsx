import type { PushResult } from "@/app/p/[slug]/[tab]/actions";
import type { SessionViewModel } from "@/lib/tasks/session-model";
import { PushControl } from "./PushControl";
import s from "./tasks.module.css";

/**
 * The finished-session view (design brief §6.5) — "designed with as much care as the live one...
 * tool calls, duration, cost, commits, and the task it served." Deliberately dull: no auto-scroll,
 * no live update, oldest tool call first — §7.4 already decided this is a page you reload, not a
 * feed you watch.
 *
 * **Stage 4b T4** adds the push-and-open-PR control (§3.8). This stays a server component, so it
 * decides from the row it already loaded whether there is anything to show: a `prUrl` already
 * stored (a prior click already succeeded) renders as a plain link and nothing more; otherwise
 * `model.canPush` gates the client control. Neither shows nothing — the same "say nothing when
 * there is nothing to say" posture the rest of this page already uses for a fresh card's evidence
 * line.
 */
export function SessionView({
  model,
  slug,
  pushAction,
}: {
  model: SessionViewModel;
  slug: string;
  /** The bound server action (`pushAndOpenPrAction`) — passed down as a prop, never imported
   *  directly by the client control below it (docs/specs/stage-4b-tickets.md T4, finding 5:
   *  `verify:stage3c` AC-1 would otherwise reach `node:child_process` and `lib/agentos/db`
   *  through `actions.ts`). */
  pushAction: (prevState: PushResult, formData: FormData) => Promise<PushResult>;
}) {
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

      {model.prUrl ? (
        <p className={s.note}>
          Pushed & opened{" "}
          <a className={s.pushLink} href={model.prUrl} target="_blank" rel="noreferrer">
            {model.prUrl}
          </a>
        </p>
      ) : (
        model.canPush &&
        model.pushLabel && (
          <PushControl
            slug={slug}
            sessionId={model.id}
            label={model.pushLabel}
            verifyFailed={model.verifyExitCode !== null && model.verifyExitCode !== 0}
            verifyNote={model.verifyNote}
            action={pushAction}
          />
        )
      )}

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
