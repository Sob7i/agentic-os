import type { CardModel, ColumnModel } from "@/lib/tasks/model";
import s from "./tasks.module.css";
import { Card } from "./Card";

/**
 * The Tasks board — dumb by design (CLAUDE.md: "shell components are dumb"). Every decision this
 * component would otherwise have to make — which evidence line, which register, whether the gate
 * shows — already happened in `lib/tasks/model.ts`; this file only maps a `ColumnModel[]` onto DOM.
 */
export function Board({
  columns,
  slug,
  runNowAction,
  approveDoneAction,
}: {
  columns: ColumnModel[];
  slug: string;
  runNowAction: (formData: FormData) => void;
  approveDoneAction: (formData: FormData) => void;
}) {
  return (
    <div className={s.board}>
      {columns.map((col) => (
        <Column
          key={col.key}
          col={col}
          slug={slug}
          runNowAction={runNowAction}
          approveDoneAction={approveDoneAction}
        />
      ))}
    </div>
  );
}

function Column({
  col,
  slug,
  runNowAction,
  approveDoneAction,
}: {
  col: ColumnModel;
  slug: string;
  runNowAction: (formData: FormData) => void;
  approveDoneAction: (formData: FormData) => void;
}) {
  return (
    <section>
      <div className={s.colHead}>
        <span className={s.colLabel}>{col.label}</span>
        <span className={s.colCount}>{col.count}</span>
      </div>
      <div className={s.col}>
        {col.cards.length === 0 && <p className={s.colEmpty}>Nothing here.</p>}
        {col.cards.map((card: CardModel) => (
          <Card
            key={card.id}
            card={card}
            slug={slug}
            // A human-only card (card.agent === null, spec §7.1: a null assignee is deliberately
            // human, never unassigned) gets no Run now control at all — never a disabled-looking
            // one — so the card cannot imply a machine could have done it (AC-7). `card.agent` is
            // already decided by `lib/tasks/model.ts`'s `cardModel`; this reads it, it does not
            // recompute it.
            runNowAction={col.key === "todo" && card.agent !== null ? runNowAction : undefined}
            approveDoneAction={col.key === "review" ? approveDoneAction : undefined}
          />
        ))}
      </div>
    </section>
  );
}
