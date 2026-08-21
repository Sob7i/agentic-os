import Link from "next/link";
import { notFound } from "next/navigation";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav, ribbonModel, driftBandFor, setupSectionFor } from "@/lib/shell/model";
import { Ribbon } from "@/components/shell/Ribbon";
import { DriftBand } from "@/components/shell/DriftBand";
import { BackShortcut } from "@/components/shell/BackShortcut";
import { ProjectRail } from "@/components/shell/ProjectRail";
import s from "@/components/shell/shell.module.css";
import c from "@/components/config/config.module.css";
import { loadProjectExecutionData, openInboxCount } from "@/lib/tasks/data";
import { AgentForm } from "@/components/config/AgentForm";
import { createAgentAction, updateAgentAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * A setup section (D32). `Agents · Templates · Environments · Repos` each have their own URL under
 * `/p/<slug>/config/`, which is what keeps the work/setup split real now that B′'s vertical rail
 * has no five-tab cap to enforce it: work is `/p/<slug>/<tab>`, setup is `/p/<slug>/config/<...>`,
 * and `EXECUTION_TABS` is untouched.
 *
 * Validation is `setupSectionFor`, the twin of `[tab]`'s own `nav.tabs.some(...)` — one definition,
 * asserted by AC-7, so an unknown section 404s rather than rendering an empty frame.
 */
export default async function ConfigSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; section: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { slug, section } = await params;
  const { agent: editingId } = await searchParams;
  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav) notFound();

  // Returns null for a watched-only project too, so `/p/<watched>/config/agents` is a 404 rather
  // than a page about an execution layer that does not exist (spec §3.3 — a deliberate change:
  // `/config` used to render a "not initialized" pane for such a project).
  const row = setupSectionFor(nav, section);
  if (!row) notFound();

  const band = driftBandFor(board, slug);
  // Never `getDb()` on a page path — opening a page must not create the store.
  //
  // Only load for a section that renders rows. `loadProjectExecutionData` fetches every task,
  // session, event, tool call and commit sha for the project (the N+1 loader already in
  // docs/BACKLOG.md), and a placeholder renders one sentence — paying for it there is a read the
  // page provably cannot use. Review of #28.
  const data = row.state === "live" ? loadProjectExecutionData(nav.project.path) : null;

  return (
    <>
      <BackShortcut />
      <Ribbon model={ribbonModel(board)} currentSlug={slug} />
      {band && <DriftBand check={band} />}
      <div className={s.body}>
        <ProjectRail
          nav={nav}
          currentTab={section}
          inboxOpenCount={openInboxCount(nav.project.path)}
        />
        <main className={s.pane}>
          <h1 className={s.h1}>{row.label}</h1>

          {row.state === "placeholder" ? (
            <p className={s.notBuilt}>
              Not built yet — {row.builtBy}. This row exists so the shape of the project&rsquo;s
              configuration is visible before all of it is built; it is not a surface that failed
              to load, and there is nothing here to fill in.
            </p>
          ) : !data ? (
            <p className={c.notInit}>
              <strong>Not initialized.</strong> This project has no{" "}
              <span className="mono">Project</span> row yet in{" "}
              <span className="mono">data/agentos.sqlite</span>. Initialize it from the{" "}
              <Link href={`/p/${slug}/tasks`}>Tasks</Link> tab first — one button, in one place.
            </p>
          ) : (
            <>
              <section className={c.section}>
                <h2 className={c.h2}>Agents</h2>
                {data.agentsById.size === 0 ? (
                  <p className={c.empty}>No agents yet — create the first one below.</p>
                ) : (
                  <ul className={c.agentList}>
                    {[...data.agentsById.values()].map((agent) => (
                      <li key={agent.id} className={c.agentRow}>
                        <span className={c.agentMonogram}>{agent.monogram}</span>
                        <span className={c.agentName}>{agent.name}</span>
                        <span className={c.agentModel}>{agent.model}</span>
                        <Link
                          className={c.editLink}
                          href={`/p/${slug}/config/agents?agent=${agent.id}`}
                        >
                          edit
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={c.section}>
                <h2 className={c.h2}>{editingId ? "Edit agent" : "New agent"}</h2>
                <AgentForm
                  slug={slug}
                  agent={editingId ? data.agentsById.get(editingId) ?? null : null}
                  createAction={createAgentAction}
                  updateAction={updateAgentAction}
                />
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
