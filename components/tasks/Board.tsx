import type { CardModel, ColumnModel } from "@/lib/tasks/model";
import type { DropCandidate } from "@/lib/tasks/dnd";
import type { MoveTaskResult } from "@/app/p/[slug]/[tab]/actions";
import { DragBoard, DroppableColumn, DraggableCard } from "./DragBoard";
import { showsRunControl } from "@/lib/tasks/model";
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
  moveAction,
}: {
  columns: ColumnModel[];
  slug: string;
  runNowAction: (formData: FormData) => void;
  approveDoneAction: (formData: FormData) => void;
  moveAction: (formData: FormData) => Promise<MoveTaskResult>;
}) {
  // Still a server component (T3). `DragBoard` and its two wrappers are the only client code, and
  // every column and card below is rendered here and passed into them as children — so the card
  // tree, `lib/tasks/model.ts`, and through it `node:sqlite`, never enter the browser bundle.
  return (
    <DragBoard slug={slug} moveAction={moveAction}>
      {columns.map((col) => (
        <Column
          key={col.key}
          col={col}
          slug={slug}
          runNowAction={runNowAction}
          approveDoneAction={approveDoneAction}
        />
      ))}
    </DragBoard>
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
      <DroppableColumn columnKey={col.key}>
      <div className={s.col}>
        {col.cards.length === 0 && <p className={s.colEmpty}>Nothing here.</p>}
        {col.cards.map((card: CardModel) => (
          <DraggableCard key={card.id} card={dropCandidateFor(card, col)}>
          <Card
            key={card.id}
            card={card}
            slug={slug}
            // The decision itself is `showsRunControl` in `lib/tasks/model.ts` — pure, and
            // asserted by AC-7b without a renderer. This component only reads it (AC-7's
            // "absent, not disabled-looking"): a dumb component, per CLAUDE.md §Conventions.
            runNowAction={showsRunControl(card, col.key) ? runNowAction : undefined}
            approveDoneAction={col.key === "review" ? approveDoneAction : undefined}
          />
          </DraggableCard>
        ))}
      </div>
      </DroppableColumn>
    </section>
  );
}

/**
 * The plain data a drag needs, computed on the server.
 *
 * The gate's **human** rendering is what crosses the boundary (D36) — never the session string,
 * which tells the reader a session may not do this and points at a tool they cannot call.
 */
function dropCandidateFor(card: CardModel, col: ColumnModel): DropCandidate {
  return {
    taskId: card.id,
    from: col.key,
    gate: card.gate ? { humanRefusalReason: card.gate.humanRefusalReason } : null,
  };
}
