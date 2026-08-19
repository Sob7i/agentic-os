import type { InboxItemModel, InboxModel } from "@/lib/tasks/inbox-model";
import s from "./tasks.module.css";

/**
 * The Inbox (design brief §6.4) — "the only interrupt channel... answering is the highest-value
 * action in the product." `model.openCount` is the one legitimate counter in this codebase (§5's
 * rule); everywhere else a count is a plain number (§8.5), never a badge.
 */
export function Inbox({
  model,
  slug,
  answerAction,
}: {
  model: InboxModel;
  slug: string;
  answerAction: (formData: FormData) => void;
}) {
  return (
    <>
      <p className={s.inboxCount}>
        {model.openCount} open question{model.openCount === 1 ? "" : "s"}
      </p>
      <ul className={s.inboxList}>
        {model.items.map((item) => (
          <InboxRow key={item.id} item={item} slug={slug} answerAction={answerAction} />
        ))}
        {model.items.length === 0 && <li className={s.colEmpty}>Nothing has asked anything yet.</li>}
      </ul>
    </>
  );
}

function InboxRow({
  item,
  slug,
  answerAction,
}: {
  item: InboxItemModel;
  slug: string;
  answerAction: (formData: FormData) => void;
}) {
  return (
    <li className={s.inboxItem} data-status={item.status}>
      <p className={s.inboxMeta}>
        {item.taskName} · @{item.agentName} · {item.shortSessionId}
      </p>
      <p className={s.inboxBody}>{item.body}</p>

      {item.status === "open" ? (
        <form action={answerAction}>
          <input type="hidden" name="messageId" value={item.id} />
          <input type="hidden" name="sessionId" value={item.sessionId} />
          <input type="hidden" name="slug" value={slug} />
          {item.choices ? (
            <div className={s.choices}>
              {item.choices.map((choice) => (
                <label className={s.choiceLabel} key={choice}>
                  <input type="radio" name="answer" value={choice} required />
                  {choice}
                </label>
              ))}
            </div>
          ) : (
            <input className={s.freeText} type="text" name="answer" placeholder="Your answer" required />
          )}
          <button className={s.answerBtn} type="submit">
            Answer and resume
          </button>
        </form>
      ) : (
        item.answer === null || item.answer === "" ? (
        // An answered message with no answer is corruption or a hand-edit, not a normal state —
        // say so rather than rendering the string "null" in quotes as if a human had said it
        // (review of #17).
        <p className={s.answeredNote}>answered, but no answer was recorded</p>
      ) : (
        <p className={s.answeredNote}>&ldquo;{item.answer}&rdquo;</p>
      )
      )}
    </li>
  );
}
