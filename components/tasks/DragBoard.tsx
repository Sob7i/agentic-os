"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { dropVerdict, type DropCandidate } from "@/lib/tasks/dnd";
import type { MoveTaskResult } from "@/app/p/[slug]/[tab]/actions";
import t from "./tasks.module.css";

/**
 * Drag and drop on the Tasks board (T3, D33).
 *
 * **The client boundary is drawn as tightly as it can be.** `Board.tsx` and `Card.tsx` stay
 * server components: this file and its two wrappers take **server-rendered children as slots**,
 * so no card rendering and no model code crosses into the browser bundle. Putting `"use client"`
 * at the top of `Board.tsx` instead would make every descendant a client component and drag
 * `lib/tasks/model.ts` — and through it `node:sqlite` — into the browser (AC-1).
 *
 * Everything this file receives is plain data: `dropTargets(...)` output computed on the server,
 * and a server action passed as a prop. It never imports the function that produces the gate's
 * refusal string, only the string itself (§8.4's "one reason, one source", surviving the bundler).
 *
 * **No optimistic update.** A card that snaps to `done` before the server accepted it is a status
 * displayed without a check — invariant 2, inside the product built to catch exactly that. The
 * move waits for `revalidatePath`.
 */
export function DragBoard({
  slug,
  moveAction,
  children,
}: {
  slug: string;
  moveAction: (formData: FormData) => Promise<MoveTaskResult>;
  children: ReactNode;
}) {
  const [refusal, setRefusal] = useState<{ taskId: string; reason: string } | null>(null);
  const [pending, setPending] = useState(false);

  const sensors = useSensors(
    // Without a distance threshold the whole card becomes a drag handle and swallows the click on
    // `Run now` and `Approve & mark done` — the two controls that matter most on this board.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // The reason D34 took a dependency at all rather than hand-rolling pointer events: a
    // hand-rolled drag has no keyboard path, which would make the board mouse-only and a
    // regression from the buttons it replaces. Measured by hand as M-2.
    useSensor(KeyboardSensor),
  );

  async function onDragEnd(event: DragEndEvent) {
    const card = event.active.data.current as DropCandidate | undefined;
    const to = event.over?.id;
    if (!card || typeof to !== "string") return;

    // Refuse in the browser so a bad drag never becomes a request. The server runs the identical
    // rule again and does not trust that this happened (§3.2).
    const verdict = dropVerdict(card, to);
    if (!verdict.ok) {
      // A same-column drop is a no-op, not an error — and it is what makes React 19's StrictMode
      // double-invocation harmless in development.
      if (verdict.kind !== "same-column") setRefusal({ taskId: card.taskId, reason: verdict.reason });
      return;
    }

    setRefusal(null);
    setPending(true);
    const body = new FormData();
    body.set("slug", slug);
    body.set("taskId", card.taskId);
    body.set("to", to);
    const result = await moveAction(body);
    setPending(false);
    if (!result.ok && result.reason) setRefusal({ taskId: card.taskId, reason: result.reason });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={t.board} data-dragging-blocked={pending || undefined}>
        {children}
      </div>
      {refusal && (
        <p className={t.dropRefusal} role="status">
          {refusal.reason}
        </p>
      )}
    </DndContext>
  );
}

/** A column that accepts drops. Takes the server-rendered column as `children`. */
export function DroppableColumn({
  columnKey,
  children,
}: {
  columnKey: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  return (
    <div ref={setNodeRef} className={t.dropZone} data-over={isOver || undefined}>
      {children}
    </div>
  );
}

/**
 * A draggable card. `card` is plain data computed on the server — including the gate's **human**
 * refusal string (D36), never the session one.
 */
export function DraggableCard({ card, children }: { card: DropCandidate; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.taskId,
    data: card,
  });
  return (
    <div
      ref={setNodeRef}
      className={t.draggable}
      data-dragging={isDragging || undefined}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
