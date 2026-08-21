import { notFound } from "next/navigation";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav, ribbonModel, driftBandFor } from "@/lib/shell/model";
import { Ribbon } from "@/components/shell/Ribbon";
import { DriftBand } from "@/components/shell/DriftBand";
import { BackShortcut } from "@/components/shell/BackShortcut";
import { ProjectRail } from "@/components/shell/ProjectRail";
import s from "@/components/shell/shell.module.css";
import { loadSessionDetail, openInboxCount } from "@/lib/tasks/data";
import { sessionViewModel } from "@/lib/tasks/session-model";
import { SessionView } from "@/components/tasks/SessionView";

export const dynamic = "force-dynamic";

/**
 * A single session's own page — the third surface T7 owns (design brief §6.5): "the
 * finished-session view... it is the evidence D19 requires." Reachable only as `/p/<slug>/sessions/<id>`
 * — every other `[tab]` refuses this segment with a 404, matching `[tab]/page.tsx`'s own rule that
 * an unbuilt or unknown surface never renders a blank frame.
 */
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; tab: string; id: string }>;
}) {
  const { slug, tab, id } = await params;
  if (tab !== "sessions") notFound();

  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav) notFound();
  const band = driftBandFor(board, slug);

  const input = loadSessionDetail(nav.project.path, id);
  if (!input) notFound();
  const model = sessionViewModel(input);

  return (
    <>
      <BackShortcut />
      <Ribbon model={ribbonModel(board)} currentSlug={slug} />
      {band && <DriftBand check={band} />}
      <div className={s.body}>
        <ProjectRail
          nav={nav}
          currentTab="sessions"
          inboxOpenCount={openInboxCount(nav.project.path)}
        />
        <main className={s.pane}>
          <SessionView model={model} />
        </main>
      </div>
    </>
  );
}
