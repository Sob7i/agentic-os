import { notFound, redirect } from "next/navigation";
import { humanAge } from "@/lib/collectors/exec";
import { boardOnce } from "@/lib/reconcile/cached";
import { driftBandFor, projectNav, ribbonModel } from "@/lib/shell/model";
import { GLYPH, WORD } from "@/lib/severity";
import { Ribbon } from "@/components/shell/Ribbon";
import { DriftBand } from "@/components/shell/DriftBand";
import { BackShortcut } from "@/components/shell/BackShortcut";
import { ProjectRail } from "@/components/shell/ProjectRail";
import s from "@/components/shell/shell.module.css";

export const dynamic = "force-dynamic";

/**
 * A project, in the B′ shell (D23).
 *
 * Every project on the watched set renders here today, because none has opted
 * into an execution layer yet — so this is frame C3, with real data, and the
 * redirect below is unreachable until Stage 3 seeds an `agentos.yml`.
 */
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav) notFound();

  // §5.5: a project has no landing page of its own — that is what D22 refused.
  if (nav.executionLayer) redirect(`/p/${slug}/tasks`);

  const { project } = nav;
  const band = driftBandFor(board, slug);
  const findings = project.checks.filter((c) => c.severity !== "in-sync");

  return (
    <>
      <BackShortcut />
      <Ribbon model={ribbonModel(board)} currentSlug={slug} />
      {band && <DriftBand check={band} />}

      <div className={s.body}>
        <ProjectRail nav={nav} currentTab={null} />
        <main className={s.pane}>
          <h1 className={s.h1}>{project.name}</h1>
          <p className={s.sub}>
            <span className={s.glyph} data-s={project.severity} aria-hidden>
              {GLYPH[project.severity]}
            </span>{" "}
            {WORD[project.severity]} · checked{" "}
            {new Date(project.checkedAtISO).toLocaleTimeString()}
          </p>

          <p className={s.facts}>
            <span>{project.git.ok ? project.git.branch : "branch unavailable"}</span>
            <span>
              {project.git.ok
                ? `${project.git.dirtyCount} dirty · ${humanAge(project.git.lastCommitISO)}`
                : project.git.reason}
            </span>
            <span>
              {project.github.ok
                ? project.github.open.length
                  ? `open: ${project.github.open.map((x) => `#${x.number}`).join(" ")}`
                  : "no open PRs"
                : "PRs unavailable"}
            </span>
          </p>

          {findings.length > 0 ? (
            <ul className={s.findings}>
              {findings.map((c) => (
                <li className={s.finding} data-s={c.severity} key={`${c.id}-${c.claimHash ?? c.headline}`}>
                  <h3>{c.headline}</h3>
                  {c.claimed && <p>Claimed — &ldquo;{c.claimed}&rdquo;</p>}
                  {c.verified && <p>Verified — {c.verified}</p>}
                  <p className={s.findingMeta}>
                    {c.id} · confidence {c.confidence.toFixed(2)}
                    {c.source ? ` · ${c.source}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.sub}>
              No findings. The checks ran and found nothing wrong — a result, not an empty state.
            </p>
          )}

          {/* Frame C3: one sentence, no illustration, no "get started" (D23). */}
          <p className={s.watchedNote}>
            <strong>Watched only.</strong> Agentic OS reconciles this project&rsquo;s documents
            against git and GitHub, and does not run work here. That is a choice, not a gap — a
            project opts in by adding an <span className="mono">agentos.yml</span> at its root
            (D18), and nothing about this view changes until it does.
          </p>
        </main>
      </div>
    </>
  );
}
