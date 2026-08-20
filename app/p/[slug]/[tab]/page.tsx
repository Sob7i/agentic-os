import { notFound } from "next/navigation";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav, ribbonModel, driftBandFor } from "@/lib/shell/model";
import { Ribbon } from "@/components/shell/Ribbon";
import { DriftBand } from "@/components/shell/DriftBand";
import { BackShortcut } from "@/components/shell/BackShortcut";
import { ProjectRail } from "@/components/shell/ProjectRail";
import s from "@/components/shell/shell.module.css";
import t from "@/components/tasks/tasks.module.css";
import { loadProjectExecutionData } from "@/lib/tasks/data";
import { cardModel, columnsFor } from "@/lib/tasks/model";
import { inboxModel } from "@/lib/tasks/inbox-model";
import { Board } from "@/components/tasks/Board";
import { Inbox } from "@/components/tasks/Inbox";
import { InitializeButton } from "@/components/tasks/InitializeButton";
import { TaskForm } from "@/components/tasks/TaskForm";
import {
  runNowAction,
  approveDoneAction,
  answerInboxAction,
  initializeProjectAction,
  createTaskAction,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * The mount point for Tasks, Goals, Inbox, Sessions and Costs (D23, T7's brief §5).
 *
 * Only `tasks` and `inbox` render real content in this ticket — the two surfaces §8 and the design
 * brief's §6.4 specify in full. `goals`, `sessions` (the list) and `costs` keep Stage 3a's honest
 * placeholder; a single session's own page (the third surface T7 owns) lives one level deeper, at
 * `[tab]/[id]/page.tsx`, reachable from a task card's evidence line or an inbox item — there is no
 * session *list* in this slice, only the detail view design brief §6.5 calls "the evidence."
 *
 * **§5 of T7's brief, resolved:** no watched project has ever had its `agentos.yml` connected to a
 * `Project` row in `data/agentos.sqlite` — there is no tool yet that creates one, and building it is
 * outside this ticket's file list. So `loadProjectExecutionData` can return `null` even when the
 * shell says this project has an execution layer (`agentos.yml` on disk is necessary, not
 * sufficient) — rendered honestly below as "not initialized," never a crash and never invented rows.
 * Every card state below is proven against fixture data in `scripts/verify-stage3.mts`, the same
 * seam AC-11/AC-17 already established for this project's `withOnlyProject` pattern.
 */
export default async function TabPage({ params }: { params: Promise<{ slug: string; tab: string }> }) {
  const { slug, tab } = await params;
  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav || !nav.tabs.some((tb) => tb.key === tab)) notFound();
  const band = driftBandFor(board, slug);

  return (
    <>
      <BackShortcut />
      <Ribbon model={ribbonModel(board)} currentSlug={slug} />
      {band && <DriftBand check={band} />}
      <div className={s.body}>
        <ProjectRail nav={nav} currentTab={tab} />
        <main className={s.pane}>
          <h1 className={s.h1}>{nav.tabs.find((tb) => tb.key === tab)?.label}</h1>
          <TabBody tab={tab} slug={slug} projectPath={nav.project.path} />
        </main>
      </div>
    </>
  );
}

function TabBody({ tab, slug, projectPath }: { tab: string; slug: string; projectPath: string }) {
  if (tab === "tasks" || tab === "inbox") {
    const data = loadProjectExecutionData(projectPath);
    if (!data) {
      return (
        <>
          <p className={t.notInit}>
            <strong>Not initialized.</strong> This project has an <span className="mono">agentos.yml</span>,
            but no matching <span className="mono">Project</span> row exists yet in{" "}
            <span className="mono">data/agentos.sqlite</span>. Click Initialize to read that file
            and connect this project to the execution layer.
          </p>
          <InitializeButton slug={slug} action={initializeProjectAction} />
        </>
      );
    }
    if (tab === "tasks") {
      const cards = data.tasks.map((task) =>
        cardModel({
          task,
          events: data.eventsByTask.get(task.id) ?? [],
          sessionsById: data.sessionsById,
          toolCallCountBySession: data.toolCallCountBySession,
          commitShasBySession: data.commitShasBySession,
          agentsById: data.agentsById,
        }),
      );
      const columns = columnsFor(cards, data.tasks);
      return (
        <>
          <TaskForm slug={slug} agents={[...data.agentsById.values()]} action={createTaskAction} />
          <Board columns={columns} slug={slug} runNowAction={runNowAction} approveDoneAction={approveDoneAction} />
        </>
      );
    }
    // tab === "inbox"
    const tasksById = new Map(data.tasks.map((task) => [task.id, task]));
    const model = inboxModel({
      messages: data.inboxMessages,
      sessionsById: data.sessionsById,
      tasksById,
      agentsById: data.agentsById,
    });
    return <Inbox model={model} slug={slug} answerAction={answerInboxAction} />;
  }

  return (
    <p className={s.notBuilt}>
      Not built. This surface arrives with a later slice — see{" "}
      <span className="mono">docs/specs/stage-3-execution-mvp.spec.md</span>. T7 built the Tasks
      board, the Inbox, and a single session&rsquo;s own page (reachable from either), and
      deliberately stopped there.
    </p>
  );
}
