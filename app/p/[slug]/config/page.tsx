import Link from "next/link";
import { notFound } from "next/navigation";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav, ribbonModel, driftBandFor } from "@/lib/shell/model";
import { Ribbon } from "@/components/shell/Ribbon";
import { DriftBand } from "@/components/shell/DriftBand";
import { BackShortcut } from "@/components/shell/BackShortcut";
import { ProjectRail } from "@/components/shell/ProjectRail";
import s from "@/components/shell/shell.module.css";
import c from "@/components/config/config.module.css";
import { loadProjectExecutionData } from "@/lib/tasks/data";
import { AgentForm } from "@/components/config/AgentForm";
import { createAgentAction, updateAgentAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * The configuration surface (T2, spec §1.2/§5.2). D23 fixed the project rail at five work tabs —
 * Agents, Templates, Environments and Repos live here instead, outside that cap. This ticket
 * builds only the Agents section; the other three stay unbuilt until their own tickets.
 *
 * Reachable only from `ProjectRail`'s own link, never a sixth rail tab (`lib/shell/model.ts`'s
 * `EXECUTION_TABS` is untouched by this ticket).
 */
export default async function ConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { slug } = await params;
  const { agent: editingId } = await searchParams;
  const board = await boardOnce();
  const nav = projectNav(board, slug);
  if (!nav) notFound();
  const band = driftBandFor(board, slug);

  // Never `getDb()` here — a page path must not create `data/agentos.sqlite` just because someone
  // opened it (`lib/tasks/data.ts`'s own `dbIfExists()` note; T1's same trap, applied again).
  const data = loadProjectExecutionData(nav.project.path);

  return (
    <>
      <BackShortcut />
      <Ribbon model={ribbonModel(board)} currentSlug={slug} />
      {band && <DriftBand check={band} />}
      <div className={s.body}>
        <ProjectRail nav={nav} currentTab={null} />
        <main className={s.pane}>
          <h1 className={s.h1}>Configuration</h1>
          {!data ? (
            <p className={c.notInit}>
              <strong>Not initialized.</strong> This project has no <span className="mono">Project</span>{" "}
              row yet in <span className="mono">data/agentos.sqlite</span>. Initialize it from the{" "}
              <Link href={`/p/${slug}/tasks`}>Tasks</Link> tab first — one button, in one place (spec §6).
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
                        <Link className={c.editLink} href={`/p/${slug}/config?agent=${agent.id}`}>
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
