import type { AgentRow, SessionRow, TaskEventRow, TaskRow } from "@/lib/agentos/types";
import { gateRefusalReason } from "@/lib/agentos/mcp/gate";
import { chainPositionLabel, gateApprovalLabel, type NextChainStep } from "@/lib/agentos/chain-render";
import { COLUMN_ORDER } from "./columns";

/**
 * The Tasks board's logic, as pure functions over rows read from `data/agentos.sqlite`.
 * Spec: docs/specs/stage-3-execution-mvp.spec.md §8 (the whole surface), §2's behaviour rows.
 *
 * Ticket T7's whole value, per its own brief: "put every card decision in a pure function under
 * `lib/tasks/` — which evidence line a card gets, which register it renders in, whether the gate
 * block appears, what the refusal string is. The components receive a fully-decided model and
 * render it." `scripts/verify-stage3.mts` asserts every function below without rendering a route,
 * the same seam `lib/shell/model.ts` established in Stage 3a.
 */

// ---------------------------------------------------------------------------
// §8.3 — the evidence line
// ---------------------------------------------------------------------------

/**
 * The five card states §8.3's table names, as a discriminated union. `'none'` carries **no other
 * field** — not an empty string, not a placeholder — so a check can assert its absence structurally
 * (`Object.keys(evidence)` is exactly `['kind']`) rather than trusting a string to stay empty.
 */
export type EvidenceLine =
  | { kind: "none" }
  | { kind: "running"; sessionId: string; text: string }
  | { kind: "executed"; sessionId: string; text: string }
  | { kind: "failed"; sessionId: string; text: string; reason: string }
  | { kind: "hand-moved"; actorName: string; text: string };

/** mono for anything a session produced; `claim` — the Board's claim register — for a hand move. */
export type EvidenceRegister = "none" | "mono" | "claim";

/**
 * §8.3: "an executed card and a hand-moved card must be distinguishable before either is read."
 * The register is the discriminant a component switches its font/style on — never the card state
 * name itself, so a component that only ever reads `.register` still renders the split correctly.
 */
export function registerFor(evidence: EvidenceLine): EvidenceRegister {
  if (evidence.kind === "none") return "none";
  if (evidence.kind === "hand-moved") return "claim";
  return "mono";
}

/** `s_2f19ab` — the wireframe's short form (frame T1), never the raw UUID. */
export function shortSessionId(id: string): string {
  return `s_${id.replace(/-/g, "").slice(0, 6)}`;
}

/** `3ac91e2` — a 7-char abbreviated sha, the usual git convention. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function pluralize(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function minutes(startISO: string, endISO: string | null, nowMs: number): number {
  const end = endISO ? new Date(endISO).getTime() : nowMs;
  return Math.max(0, Math.round((end - new Date(startISO).getTime()) / 60_000));
}

/**
 * `null` means the SDK never reported a cost — **unknown, not zero.** Rendering it as `$0.00`
 * states a fact about spend that nothing checked, which is the one thing this product exists to
 * stop; it also disagreed with the session view, which already said "cost unknown" for the same
 * row (review of #17). Callers concatenate this into a mono evidence line, so the unknown case
 * has to read as a phrase rather than a number.
 */
function money(costUsd: number | null): string {
  return costUsd === null ? "cost unknown" : `$${costUsd.toFixed(2)}`;
}

/** Everything `evidenceLineFor` needs, gathered once per task by the (non-pure) page loader. */
export interface EvidenceInput {
  task: TaskRow;
  /** Every `TaskEvent` for this task, any order — the function finds the latest itself. */
  events: TaskEventRow[];
  sessionsById: Map<string, SessionRow>;
  toolCallCountBySession: Map<string, number>;
  /** Oldest-first per session, matching `listCommitShas`'s own ordering convention. */
  commitShasBySession: Map<string, string[]>;
  /** Injectable for deterministic tests; defaults to `Date.now()` in production call sites. */
  nowMs?: number;
}

function latestEvent(events: TaskEventRow[]): TaskEventRow | null {
  if (events.length === 0) return null;
  return events.reduce((latest, e) => (e.atISO > latest.atISO ? e : latest));
}

/**
 * §8.3's whole point: "a `todo` card shows no evidence line, and this is a rule rather than an
 * omission — nothing has happened yet, and an empty or placeholder line would be a claim about a
 * run that does not exist." So the first branch below is unconditional on history — even a task
 * that was `doing` and got swept back to `todo` after a failure (§7.7) shows nothing: it is back at
 * the start, and an evidence line naming the failed attempt would describe a run this card is no
 * longer claiming credit — or blame — for.
 *
 * The remaining branches read the most recent `TaskEvent` to learn who produced the *current*
 * status. `db.ts`'s `LEGAL_TRANSITIONS` table means an `actorType: 'system'` event can only ever be
 * `doing -> todo` — so by the time this function reaches the `'session'` branch, `todo` has already
 * been excluded and the only two possible actors left are `'human'` and `'session'`.
 */
export function evidenceLineFor(input: EvidenceInput): EvidenceLine {
  const { task } = input;
  if (task.status === "todo") return { kind: "none" };

  const event = latestEvent(input.events);
  if (!event) return { kind: "none" }; // defensive: D19 says this should never happen

  if (event.actorType === "human") {
    const actorName = event.actorId ?? "someone";
    return {
      kind: "hand-moved",
      actorName,
      text: `moved by hand · ${actorName} · no session produced this`,
    };
  }

  const session = event.actorId ? input.sessionsById.get(event.actorId) : undefined;
  if (!session) return { kind: "none" }; // defensive: an event naming no live session record

  const nowMs = input.nowMs ?? Date.now();
  const toolCalls = input.toolCallCountBySession.get(session.id) ?? 0;

  if (session.status === "running" || session.status === "waiting-inbox") {
    const parts = [
      "running",
      `${minutes(session.startedAtISO, null, nowMs)}m`,
      pluralize(toolCalls, "tool call"),
      session.costUsd === null ? "cost unknown" : `${money(session.costUsd)} so far`,
    ];
    return { kind: "running", sessionId: session.id, text: parts.join(" · ") };
  }

  if (session.status === "completed") {
    const shas = input.commitShasBySession.get(session.id) ?? [];
    const lastSha = shas[shas.length - 1];
    const parts = [
      shortSessionId(session.id),
      ...(lastSha ? [shortSha(lastSha)] : []),
      `${minutes(session.startedAtISO, session.endedAtISO, nowMs)}m`,
      money(session.costUsd),
      pluralize(toolCalls, "tool call"),
    ];
    return { kind: "executed", sessionId: session.id, text: parts.join(" · ") };
  }

  // 'failed' or 'interrupted' — both terminal-with-reason (§7.7's sweep sets failureReason on an
  // interrupted session exactly as a genuine failure does). The table names only 'failed'
  // explicitly; interrupted renders the same way because both carry the same two facts.
  const reason = session.failureReason ?? "no reason recorded";
  const parts = [
    shortSessionId(session.id),
    `failed after ${minutes(session.startedAtISO, session.endedAtISO, nowMs)}m`,
    money(session.costUsd),
  ];
  return { kind: "failed", sessionId: session.id, text: parts.join(" · "), reason };
}

// ---------------------------------------------------------------------------
// §8.4 — the gate, on the card
// ---------------------------------------------------------------------------

export interface GateModel {
  label: "human gate";
  subtitle: string;
  /**
   * The exact string `gateRefusalReason()` returns — imported, never retyped (§8.4: "one reason,
   * one source"). Any UI that would otherwise refuse a session's or a drag's attempt to close a
   * gated task quotes this field rather than composing its own text.
   */
  refusalReason: string;
  /**
   * The **human** rendering of the same refusal (D36), for the drag path.
   *
   * `refusalReason` above is written for a session — *"a session may not move it to 'done'"*, and
   * it points at `inbox_ask`. A person who just dragged the card is not a session and cannot call
   * that tool; worse, `approveDoneAction` has no gate check for humans at all, so "you may not do
   * this" is not even true of them. Both come from **one function with an audience argument**, not
   * two strings that must be kept in agreement.
   */
  humanRefusalReason: string;
  /**
   * The approval control's own rendered label (Stage 4 §5 decision 3, AC-6) — `"Approve & mark
   * done"` for a hand-made task or a chain's own last gate, `"Approve & start step 2 (@plan)"` when
   * approving will dispatch a following step. Composed by `gateApprovalLabel`
   * (`lib/agentos/chain-render.ts`), never retyped here — never a bare "Approve".
   */
  approveLabel: string;
}

/**
 * A `review` card whose task has `approvalGate` carries the gate block (§8.4); every other card gets
 * `null`. `next` — the chain's own next step, or `null` outside a chain or at the chain's last gate
 * — decides `approveLabel`'s wording (AC-6); every existing caller that does not pass it keeps the
 * plain "Approve & mark done" label unchanged.
 */
export function gateModelFor(task: TaskRow, next: NextChainStep | null = null): GateModel | null {
  if (task.status !== "review" || !task.approvalGate) return null;
  return {
    label: "human gate",
    subtitle: "agent reached review · only you can mark done",
    refusalReason: gateRefusalReason(task.id),
    humanRefusalReason: gateRefusalReason(task.id, "human"),
    approveLabel: gateApprovalLabel(next),
  };
}

/**
 * The chain's own next step after `task`, or `null` outside a chain or when `task` is the chain's
 * last step — the input `gateApprovalLabel` needs and the one lookup (`agentsById`) `chain-render.ts`
 * cannot do itself, being a leaf module. `chainTasks` is every task sharing `task.chainId` (any
 * order, including `task` itself) — supplied by the (non-pure) page loader, never re-queried here.
 */
function nextChainStepFor(
  task: TaskRow,
  chainTasks: TaskRow[] | undefined,
  agentsById: Map<string, AgentRow>,
): NextChainStep | null {
  if (task.chainId === null || task.chainOrd === null || !chainTasks) return null;
  const next = chainTasks.find((t) => t.chainOrd === task.chainOrd! + 1);
  if (!next) return null;
  const assigneeLabel = next.assigneeAgentId
    ? `@${agentsById.get(next.assigneeAgentId)?.name ?? "unknown"}`
    : "human";
  return { ord: next.chainOrd!, assigneeLabel };
}

/**
 * `step 3 of 9 · compound-engineer` (§8.2, AC-9), or `null` for a hand-made task. `total` is read
 * from `chainTasks.length` — the actual number of tasks this chain instantiated, since every step is
 * materialised up front (§3.2) and none is ever deleted — **never a hardcoded 9**, so a template of
 * a different length still renders correctly.
 */
function chainPositionFor(
  task: TaskRow,
  chainTasks: TaskRow[] | undefined,
  chainTemplateName: string | undefined,
): string | null {
  if (task.chainId === null || task.chainOrd === null || !chainTasks || !chainTemplateName) return null;
  return chainPositionLabel(task.chainOrd, chainTasks.length, chainTemplateName);
}

/**
 * Whether a card offers **Run now** — pure, so a check can assert it without a renderer.
 *
 * Two conditions, and the second is the one that carries meaning: the card is in `todo`, **and**
 * it has an agent. A null `agent` is a deliberately human-only task (§7.1) — *never* an
 * unassigned one — so the control is **absent**, not disabled. A disabled button would say the
 * machine could have done this and declined; there is no machine assigned to decline.
 *
 * This lived as a ternary inside `components/tasks/Board.tsx` when T3 shipped, and the ticket
 * then recorded the behaviour as untestable because no acceptance script imports a component.
 * That was true and beside the point: **a decision that can be wrong does not belong in a dumb
 * component** (CLAUDE.md §Conventions). Moved here in review, 2026-08-19, where AC-7b asserts all
 * four cases.
 */
export function showsRunControl(card: { agent: AgentBadge | null }, columnKey: TaskRow["status"]): boolean {
  return columnKey === "todo" && card.agent !== null;
}

// ---------------------------------------------------------------------------
// §8.2 — card anatomy, and §8.5 — the column model
// ---------------------------------------------------------------------------

export interface AgentBadge {
  monogram: string;
  name: string;
}

export interface CardModel {
  id: string;
  title: string;
  /** Null for a deliberately human-only task (§7.1) — never defaulted here. */
  agent: AgentBadge | null;
  /** Always `"once"` in this slice — `scheduleKind` has one reachable value (§7.2); `cron ·
   *  Mon 09:00` is drawn in the wireframe but not built. */
  scheduleLabel: string;
  blockedReason: string | null;
  /** `step 3 of 9 · compound-engineer` (§8.2, AC-9), or `null` for a hand-made task. */
  chainPosition: string | null;
  evidence: EvidenceLine;
  register: EvidenceRegister;
  gate: GateModel | null;
}

export interface CardInput extends EvidenceInput {
  agentsById: Map<string, AgentRow>;
  /**
   * Every task sharing this card's `chainId` (any order, including this one) — Stage 4. Omitted (or
   * empty) for a hand-made task, which has no chain to position itself in or advance.
   */
  chainTasks?: TaskRow[];
  /** Display name of the chain's originating template (`Chain.templateVersionJson.template.name`) — required alongside `chainTasks` for `chainPosition` to render; harmless to omit otherwise. */
  chainTemplateName?: string;
}

export function cardModel(input: CardInput): CardModel {
  const evidence = evidenceLineFor(input);
  const agent = input.task.assigneeAgentId
    ? agentBadge(input.agentsById.get(input.task.assigneeAgentId))
    : null;
  const next = nextChainStepFor(input.task, input.chainTasks, input.agentsById);
  return {
    id: input.task.id,
    title: input.task.name,
    agent,
    scheduleLabel: "once",
    blockedReason: input.task.blockedReason,
    chainPosition: chainPositionFor(input.task, input.chainTasks, input.chainTemplateName),
    evidence,
    register: registerFor(evidence),
    gate: gateModelFor(input.task, next),
  };
}

function agentBadge(agent: AgentRow | undefined): AgentBadge | null {
  if (!agent) return null;
  return { monogram: agent.monogram, name: agent.name };
}

// Defined in `./columns` (a leaf `lib/tasks/dnd.ts` can reach without pulling in this module's
// `node:sqlite` chain) and re-exported here so every existing import site is unchanged.
export { COLUMN_ORDER } from "./columns";

export interface ColumnModel {
  key: TaskRow["status"];
  label: string;
  /**
   * §8.5: "plain mono numerals beside the column name — no pill, no colour." A count is a number
   * of cards you could verify by looking, not a counter (the Inbox is the one legitimate counter
   * per the design brief's §5 rule) — so this type carries no severity/colour/badge field at all.
   * `scripts/verify-stage3.mts` asserts that structurally: if a badge field ever appears here, the
   * check that walks `Object.keys` on this type fails before any component gets a chance to draw it.
   */
  count: number;
  cards: CardModel[];
}

export function columnsFor(cards: CardModel[], tasks: TaskRow[]): ColumnModel[] {
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  return COLUMN_ORDER.map((key) => {
    const inColumn = tasks.filter((t) => t.status === key);
    return {
      key,
      label: key,
      count: inColumn.length,
      cards: inColumn
        .map((t) => cardsById.get(t.id))
        .filter((c): c is CardModel => c !== undefined),
    };
  });
}
