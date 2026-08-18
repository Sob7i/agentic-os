import Link from "next/link";
import { boardOnce } from "@/lib/reconcile/cached";
import { porcelain } from "@/lib/collectors/git";
import { proposeFix } from "@/lib/fix/propose";
import { readAcknowledgements } from "@/lib/fix/verified";
import { PROJECTS } from "@/projects.config";
import { ROLE_LABEL, ROLE_ORDER } from "@/lib/types";
import { FixSection } from "@/components/board/FixSection";
import { RosterRow } from "@/components/board/RosterRow";
import { PortfolioRail } from "@/components/shell/PortfolioRail";
import { GLYPH } from "@/lib/severity";
import shell from "@/components/shell/shell.module.css";
import "./board.css";

// On-load only (DECISIONS D8): no timer, no watcher. A ticking clock would also
// fight the calm register the design brief asks for.
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function Board({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const written = one(sp.written);
  const error = one(sp.error);
  const writtenProject = one(sp.project);

  const board = await boardOnce();
  const acks = readAcknowledgements();

  // Proposals are built during render — reads only. Stage 2's AC-11 asserts that
  // rendering this page changes no watched repo.
  const driftCards = board.projects.flatMap((p) =>
    p.checks
      .filter((c) => c.severity === "drift")
      .map((c) => ({ project: p, check: c, proposal: proposeFix(p.name, p.path, c) })),
  );
  const driftedNames = new Set(driftCards.map((d) => d.project.name));

  // After a write, show git's own porcelain rather than our word for it. The
  // dashboard is not exempt from verify-before-claim about its own actions.
  const writtenCfg = writtenProject ? PROJECTS.find((p) => p.name === writtenProject) : undefined;
  const writeStatus = writtenCfg ? await porcelain(writtenCfg.path) : null;

  return (
    <div className={shell.home}>
      <PortfolioRail current="board" />
      <main className="page">
      <header className="header">
        <div>
          <h1 className="title">Agentic OS</h1>
          <p className="tagline">Which of my projects is currently misleading me?</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="freshness" data-stale="false">
            <span className="pulse" />
            <span>
              all checks ran · {board.projects.length} projects ·{" "}
              <span className="mono">{new Date(board.checkedAtISO).toLocaleTimeString()}</span>
            </span>
          </div>
          {/* A plain link, not a client component: reload re-runs the collectors. */}
          <a className="refresh" href="/">
            refresh
          </a>
        </div>
      </header>

      {board.degraded && (
        <div className="degraded">
          <strong>Partial data.</strong> One or more collectors failed. Rows below show what was
          actually checked — missing data reads &ldquo;unavailable&rdquo;, never zero.
        </div>
      )}

      {error && (
        <div className="degraded">
          <strong>Nothing was written.</strong> {error}
        </div>
      )}

      {/* ── Drift feed ───────────────────────────────────────────────────── */}
      {driftCards.length > 0 ? (
        <>
          <p className="label label--drift">
            <span aria-hidden>⚠</span>
            {driftCards.length === 1
              ? "Drift — 1 document contradicts reality"
              : `Drift — ${driftCards.length} documents contradict reality`}
          </p>
          <div className="cards">
            {driftCards.map(({ project, check, proposal }) => (
              <article className="card" key={`${project.name}-${check.id}-${check.claimHash}`}>
                <div className="card__top">
                  <div>
                    <h2 className="card__name">{project.name}</h2>
                    {check.source && <p className="card__src mono">{check.source}</p>}
                  </div>
                  <span className="status" data-s="drift">
                    <span aria-hidden>⚠</span> drift
                  </span>
                </div>

                <p className="card__headline">{check.headline}</p>

                {check.claimed && (
                  <div className="block block--claim">
                    <p className="block__label">Claimed — what the doc says</p>
                    <p className="block__text">&ldquo;{check.claimed}&rdquo;</p>
                  </div>
                )}
                {check.verified && (
                  <div className="block block--fact">
                    <p className="block__label">Verified — what git says now</p>
                    <p className="block__text">{check.verified}</p>
                  </div>
                )}

                <div className="card__foot">
                  <span className="conf mono" data-low={check.confidence < 0.9}>
                    {check.id} · confidence {check.confidence.toFixed(2)}
                  </span>
                  {project.github.ok && project.github.open[0] && (
                    <span className="act mono">PR #{project.github.open[0].number} open</span>
                  )}
                </div>

                <FixSection
                  project={project}
                  check={check}
                  proposal={proposal}
                  ack={check.claimHash ? acks[check.claimHash] : undefined}
                  justWritten={Boolean(written && written === check.claimHash)}
                  writeStatus={written === check.claimHash ? writeStatus : null}
                />
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          <strong>No drift.</strong> Every state document checked agrees with git and GitHub as of{" "}
          <span className="mono">{new Date(board.checkedAtISO).toLocaleTimeString()}</span>. This is
          a result, not an empty state — the checks ran and found nothing wrong.
        </div>
      )}

      {/* ── Roster ───────────────────────────────────────────────────────── */}
      <p className="label label--roster">Roster — all projects · role coverage</p>
      <div className="rosterWrap">
        <table className="roster">
          <thead>
            <tr>
              <th>Project</th>
              <th>Branch</th>
              <th>Git</th>
              <th>PR</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className="r-role" title={r}>
                  {ROLE_LABEL[r]}
                </th>
              ))}
              <th>Status</th>
              <th>Checked</th>
            </tr>
          </thead>
          <tbody>
            {board.projects.map((p) => (
              <RosterRow key={p.name} p={p} hasCard={driftedNames.has(p.name)} />
            ))}
          </tbody>
        </table>
      </div>

        {/* Frame B′1 — projects are entered from the pane, not from the rail. */}
        <p className="label label--roster">Enter a project</p>
        <div className={shell.enter}>
          <ul className={shell.railTabs}>
            {board.projects.map((p) => (
              <li className={shell.railTab} key={p.name}>
                <Link href={`/p/${p.name}`}>
                  <span className={shell.glyph} data-s={p.severity} aria-hidden>
                    {GLYPH[p.severity]}
                  </span>{" "}
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className={shell.railNote}>
            None of these runs work here yet — every one is watched only, until a project adds an
            agentos.yml (D18).
          </p>
        </div>
      </main>
    </div>
  );
}
