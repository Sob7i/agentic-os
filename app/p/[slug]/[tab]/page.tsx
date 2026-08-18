import { notFound } from "next/navigation";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav, ribbonModel, driftBandFor } from "@/lib/shell/model";
import { Ribbon } from "@/components/shell/Ribbon";
import { DriftBand } from "@/components/shell/DriftBand";
import { BackShortcut } from "@/components/shell/BackShortcut";
import { ProjectRail } from "@/components/shell/ProjectRail";
import s from "@/components/shell/shell.module.css";

export const dynamic = "force-dynamic";

/**
 * The mount point for Tasks, Goals, Inbox, Sessions and Costs.
 *
 * Stage 3a builds the frame and nothing behind the tabs. This route is
 * unreachable today — no watched project has an `agentos.yml` — and it exists
 * so the redirect in the parent route has somewhere to land rather than
 * dead-ending in a 404 the moment Stage 3 seeds one.
 */
export default async function TabPage({ params }: { params: Promise<{ slug: string; tab: string }> }) {
  const { slug, tab } = await params;
  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav || !nav.tabs.some((t) => t.key === tab)) notFound();
  const band = driftBandFor(board, slug);

  return (
    <>
      <BackShortcut />
      <Ribbon model={ribbonModel(board)} currentSlug={slug} />
      {band && <DriftBand check={band} />}
      <div className={s.body}>
        <ProjectRail nav={nav} currentTab={tab} />
        <main className={s.pane}>
          <h1 className={s.h1}>{nav.tabs.find((t) => t.key === tab)?.label}</h1>
          <p className={s.notBuilt}>
            Not built. This surface arrives with the execution MVP — see{" "}
            <span className="mono">docs/specs/stage-3-execution-mvp.spec.md</span>. Stage 3a built
            the shell around it and deliberately stopped there.
          </p>
        </main>
      </div>
    </>
  );
}
