import Link from "next/link";
import type { CardModel } from "@/lib/tasks/model";
import s from "./tasks.module.css";

/**
 * One card. Dumb: it switches only on `card.register` and `card.evidence.kind`, both already
 * decided by `lib/tasks/model.ts`. §8.6: no motion anywhere in here, on any state, including
 * `data-running` below — that attribute drives a static 3px rail, never an animation.
 */
export function Card({
  card,
  slug,
  runNowAction,
  approveDoneAction,
}: {
  card: CardModel;
  slug: string;
  runNowAction?: (formData: FormData) => void;
  approveDoneAction?: (formData: FormData) => void;
}) {
  const running = card.evidence.kind === "running";

  return (
    <article className={s.card} data-running={running}>
      <p className={s.cardTitle}>{card.title}</p>

      <div className={s.meta}>
        {card.agent && (
          <span className={s.agent} title={card.agent.name}>
            <span className={s.agentBox} aria-hidden>
              {card.agent.monogram}
            </span>
            <span className={s.agentName}>@{card.agent.name}</span>
          </span>
        )}
        <span className={s.scheduleChip}>{card.scheduleLabel}</span>
      </div>

      {card.blockedReason && <span className={s.blocked}>blocked · {card.blockedReason}</span>}

      <Evidence card={card} slug={slug} />

      {card.gate && (
        <div className={s.gate}>
          <span className={s.gateLabel}>{card.gate.label}</span>
          <p className={s.gateSubtitle}>&ldquo;{card.gate.subtitle}&rdquo;</p>
          {card.gate.chainConsequence && (
            <p className={s.gateConsequence}>{card.gate.chainConsequence}</p>
          )}
          <div className={s.gateActions}>
            {approveDoneAction ? (
              <form action={approveDoneAction}>
                <input type="hidden" name="taskId" value={card.id} />
                <input type="hidden" name="slug" value={slug} />
                <button className={s.gateApprove} type="submit">
                  Approve &amp; mark done
                </button>
              </form>
            ) : (
              <button className={s.gateApprove} type="button" disabled>
                Approve &amp; mark done
              </button>
            )}
            <button className={s.gateReadSpec} type="button" disabled title="Not wired in this slice">
              Read spec
            </button>
          </div>
        </div>
      )}

      {runNowAction && (
        <form action={runNowAction}>
          <input type="hidden" name="taskId" value={card.id} />
          <input type="hidden" name="slug" value={slug} />
          <button className={s.runNow} type="submit">
            Run now
          </button>
        </form>
      )}
    </article>
  );
}

/**
 * §8.3: an executed card and a hand-moved card must be distinguishable **before either is read** —
 * that is the register switch below, not the text. A `'none'` evidence renders literally nothing:
 * no line, no placeholder, not even an empty paragraph.
 */
function Evidence({ card, slug }: { card: CardModel; slug: string }) {
  const { evidence, register } = card;

  // Branch on `register`, not on `evidence.kind`.
  //
  // Both were available and this switched on `kind`, which made `registerFor()` — and the check
  // that asserts it (T7-2) — **dead for rendering**: the pure function could have been wrong and
  // the page would still have looked right, or been fixed and the page still wrong. A rule the
  // suite asserts about a value the UI ignores is not enforced, it is decorated. Reading the
  // register here is what makes T7-2 load-bearing (review of #17).
  // `register === "none"` is the decision; the `kind` test beside it is a **type guard only** —
  // TypeScript narrows the union on `kind`, so without it `evidence.text` below is not provably
  // present. The two can never disagree: `registerFor` returns "none" for exactly that kind.
  if (register === "none" || evidence.kind === "none") return null;

  if (register === "claim") {
    return <p className={s.evidenceClaim}>&ldquo;{evidence.text}&rdquo;</p>;
  }

  // register === "mono" — running / executed / failed all name a session id that opens the
  // session view. `kind` is still consulted *within* this branch for the failure reason, which is
  // content rather than register.
  if (!("sessionId" in evidence)) return null;
  return (
    <>
      <p className={s.evidenceMono}>
        <span aria-hidden>▶ </span>
        <Link className={s.evidenceLink} href={`/p/${slug}/sessions/${evidence.sessionId}`}>
          {evidence.text}
        </Link>
      </p>
      {evidence.kind === "failed" && <p className={s.evidenceReason}>{evidence.reason}</p>}
    </>
  );
}
