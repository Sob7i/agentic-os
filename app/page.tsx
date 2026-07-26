import { buildBoard } from "@/lib/reconcile/board";
import { humanAge } from "@/lib/collectors/exec";
import { ROLE_LABEL, ROLE_ORDER, type ProjectReport, type Severity } from "@/lib/types";
import "./board.css";

// On-load only (DECISIONS D8): no timer, no watcher. A ticking clock would also
// fight the calm register the design brief asks for.
export const dynamic = "force-dynamic";

const GLYPH: Record<Severity, string> = {
  drift: "⚠",
  attention: "○",
  "in-sync": "✓",
  unverifiable: "◌",
};

const WORD: Record<Severity, string> = {
  drift: "drift",
  attention: "attention",
  "in-sync": "in sync",
  unverifiable: "unverifiable",
};

export default async function Board() {
  const board = await buildBoard();
  const driftCards = board.projects.flatMap((p) =>
    p.checks.filter((c) => c.severity === "drift").map((c) => ({ project: p, check: c })),
  );
  const driftedNames = new Set(driftCards.map((d) => d.project.name));

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1 className="title">Agentic OS</h1>
          <p className="tagline">
            Which of my projects is currently misleading me?
          </p>
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
            {driftCards.map(({ project, check }) => (
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
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          <strong>No drift.</strong> Every state document checked agrees with git and GitHub as of{" "}
          <span className="mono">{new Date(board.checkedAtISO).toLocaleTimeString()}</span>. This
          is a result, not an empty state — the checks ran and found nothing wrong.
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
              <Row key={p.name} p={p} hasCard={driftedNames.has(p.name)} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Row({ p, hasCard }: { p: ProjectReport; hasCard: boolean }) {
  const roleMap = new Map(p.docs.roles.map((r) => [r.role, r]));
  return (
    <tr data-has-card={hasCard}>
      <td className="r-name">{p.name}</td>
      <td className="mono r-dim">{p.git.ok ? p.git.branch : <span className="unavailable">unavailable</span>}</td>
      <td className="mono r-dim">
        {p.git.ok ? (
          `${p.git.dirtyCount} dirty · ${humanAge(p.git.lastCommitISO)}`
        ) : (
          <span className="unavailable">{p.git.reason}</span>
        )}
      </td>
      <td className="mono r-dim">
        {p.github.ok ? (
          p.github.open.length ? (
            p.github.open.map((x) => `#${x.number}`).join(" ")
          ) : (
            "—"
          )
        ) : (
          // Never "0 open" for "could not ask" (AC-5).
          <span className="unavailable" title={p.github.reason}>
            unavailable
          </span>
        )}
      </td>
      {ROLE_ORDER.map((r) => {
        const rc = roleMap.get(r);
        return (
          <td key={r} className="r-role" title={rc?.via ? `${r}: ${rc.via}` : `${r}: not instantiated`}>
            <span className="dot" data-filled={Boolean(rc?.filled)} />
          </td>
        );
      })}
      <td>
        <span className="status" data-s={p.severity}>
          <span aria-hidden>{GLYPH[p.severity]}</span> {WORD[p.severity]}
        </span>
      </td>
      <td className="stamp">{new Date(p.checkedAtISO).toLocaleTimeString()}</td>
    </tr>
  );
}
