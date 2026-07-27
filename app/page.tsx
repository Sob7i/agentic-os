import { buildBoard } from "@/lib/reconcile/board";
import { humanAge, run } from "@/lib/collectors/exec";
import { proposeFix, type ProposalResult } from "@/lib/fix/propose";
import { readAcknowledgements, type Acknowledgement } from "@/lib/fix/verified";
import { PROJECTS } from "@/projects.config";
import { ROLE_LABEL, ROLE_ORDER, type CheckResult, type ProjectReport, type Severity } from "@/lib/types";
import { approveFix, clearVerified, markVerified } from "./actions";
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

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function Board({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const written = one(sp.written);
  const error = one(sp.error);
  const writtenProject = one(sp.project);

  const board = await buildBoard();
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
  const writeStatus = writtenProject ? await porcelain(writtenProject) : null;

  return (
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
              <Row key={p.name} p={p} hasCard={driftedNames.has(p.name)} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/** Git's own view of what the approval left behind. Never our summary of it. */
async function porcelain(projectName: string): Promise<string[] | null> {
  const cfg = PROJECTS.find((p) => p.name === projectName);
  if (!cfg) return null;
  const out = await run("git", ["status", "--porcelain"], cfg.path);
  return out === null ? null : out.split("\n").filter(Boolean);
}

/**
 * The gate (DESIGN-BRIEF §5.2, wireframe "Fix Proposal v2 — Fixable (DC1)").
 *
 * Four states, and only one of them has a button: proposable, already
 * acknowledged, just written, or no automatic fix — which is the common case and
 * gets a reason rather than a greyed-out control (AC-8).
 */
function FixSection({
  project,
  check,
  proposal,
  ack,
  justWritten,
  writeStatus,
}: {
  project: ProjectReport;
  check: CheckResult;
  proposal: ProposalResult;
  ack?: Acknowledgement;
  justWritten: boolean;
  writeStatus: string[] | null;
}) {
  if (justWritten) {
    const touched = (writeStatus ?? []).filter((l) => /\.md$/.test(l));
    return (
      <section className="fix fix--done">
        <p className="fix__kicker fix__kicker--done">
          <span aria-hidden>✎</span> Written · awaiting re-check
        </p>
        <ol className="chain">
          <li className="chain__step chain__step--past">⚠ drift</li>
          <li className="chain__step chain__step--past">✎ written</li>
          <li className="chain__step chain__step--now">⟳ re-check pending</li>
          <li className="chain__step chain__step--future">?</li>
        </ol>
        <p className="fix__sub">Working tree — unstaged</p>
        {touched.length ? (
          <pre className="porcelain mono">{touched.join("\n")}</pre>
        ) : (
          <p className="fix__note">
            git reported no modified files. Either the write landed identically to what was
            already there, or something else changed it back — re-check before trusting this.
          </p>
        )}
        <p className="fix__note mono">
          Undo: git checkout -- {check.fix?.stateDocPath ?? "<file>"}
        </p>
        <p className="fix__warn">
          <strong>Not marked resolved — and that&rsquo;s deliberate.</strong> The next
          reconciliation re-reads the file and decides for itself; the dashboard does not get to
          grade its own work. There is no green &ldquo;fixed!&rdquo; here, because faking one
          would make it lie about itself.
        </p>
      </section>
    );
  }

  if (ack) {
    return (
      <section className="fix fix--ack">
        <p className="fix__note">
          <span aria-hidden>✓</span> Acknowledged {humanAge(ack.atISO)} ago — you have seen this
          and left the document as it is. Local to this machine; expires by itself when the claim
          changes.
        </p>
        <form action={clearVerified}>
          <input type="hidden" name="claimHash" value={check.claimHash ?? ""} />
          <button className="act" type="submit">
            Un-acknowledge
          </button>
        </form>
      </section>
    );
  }

  if (!proposal.available) {
    return (
      <section className="fix fix--none">
        <p className="fix__kicker fix__kicker--none">
          <span aria-hidden>◌</span> No automatic fix
        </p>
        <p className="fix__note">{proposal.reason}</p>
        <AckForm project={project.name} check={check} />
      </section>
    );
  }

  const doc = proposal.writes[0];
  const lessons = proposal.writes[1];

  return (
    <section className="fix">
      <p className="fix__kicker">
        <span aria-hidden>⚠</span> Fix proposal · awaiting approval
        <span className="pill mono">{proposal.checkId} · mechanically fixable</span>
      </p>
      <p className="fix__sub">
        Agentic OS drafted a minimal correction — one number, substituted in place. Nothing is
        written until you approve.
      </p>

      <div className="diff">
        <div className="diff__bar mono">
          <span>
            {doc.relPath} · line {proposal.line.number}
          </span>
          <span className="diff__hint">the change is one number — shown in its full line</span>
        </div>
        <div className="diff__line">
          <span className="diff__num mono">{proposal.line.number}</span>
          <code className="mono">
            {proposal.line.before.slice(0, proposal.token.start)}
            <span className="tok tok--old">{proposal.token.before}</span>
            <span className="tok tok--arrow"> → </span>
            <span className="tok tok--new">{proposal.token.after}</span>
            {proposal.line.before.slice(proposal.token.end)}
          </code>
        </div>
      </div>

      {proposal.contextWarning && (
        <div className="fix__flag">
          <p className="fix__flagTitle">The machine changed the number, not the date beside it.</p>
          <p className="fix__flagText">{proposal.contextWarning.text}</p>
        </div>
      )}

      {lessons ? (
        <div className="ships">
          <p className="fix__sub">Ships with this fix — {lessons.relPath} (append 1 line)</p>
          <p className="ships__line mono">
            <span className="ships__plus">+</span>
            {proposal.lessonLine}
          </p>
          <p className="fix__note">
            Both files are approved together — a correction without its lesson would defeat the
            ritual the correction exists to serve.
          </p>
        </div>
      ) : (
        <p className="fix__note">{proposal.lessonsSkippedReason}</p>
      )}

      <div className="gate">
        <p className="gate__label">This will write to your local repo</p>
        <p className="gate__targets mono">
          {proposal.writes
            .map(
              (w) =>
                `${w.action === "append-one-line" ? "append" : "overwrite"} ${project.name}/${w.relPath} (1 line)`,
            )
            .join(" · ")}
        </p>
        <p className="fix__note">
          Lands as an unstaged working-tree change — nothing committed, staged, or pushed. Undo:{" "}
          <span className="mono">git checkout -- {doc.relPath}</span>.
        </p>
        <div className="gate__buttons">
          <AckForm project={project.name} check={check} label="Leave as is" />
          <form action={approveFix}>
            <input type="hidden" name="project" value={project.name} />
            <input type="hidden" name="claimHash" value={check.claimHash ?? ""} />
            {/* One expression, complete strings. A newline between `file` and a
                `{"s"}` expression is collapsed to a space by JSX — it renders as
                "2 file s". This has bitten this codebase before (LEARNINGS). */}
            <button className="act act--primary" type="submit">
              {proposal.writes.length === 1
                ? "Approve & write 1 file"
                : `Approve & write ${proposal.writes.length} files`}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

/**
 * "Leave as is" acknowledges; it does not dismiss.
 *
 * The wireframe's second button read "Reject", but a reject that forgets on
 * reload would be the dashboard lying about its own memory. Acknowledging is the
 * honest version of the same gesture: it records that you looked, nothing more,
 * and it expires on its own when the claim changes (D6, spec §1.5).
 */
function AckForm({
  project,
  check,
  label = "Acknowledge — leave as is",
}: {
  project: string;
  check: CheckResult;
  label?: string;
}) {
  return (
    <form action={markVerified}>
      <input type="hidden" name="project" value={project} />
      <input type="hidden" name="claimHash" value={check.claimHash ?? ""} />
      <input type="hidden" name="checkId" value={check.id} />
      <input type="hidden" name="claim" value={check.claimed ?? check.headline} />
      <button className="act" type="submit">
        {label}
      </button>
    </form>
  );
}

function Row({ p, hasCard }: { p: ProjectReport; hasCard: boolean }) {
  const roleMap = new Map(p.docs.roles.map((r) => [r.role, r]));
  return (
    <tr data-has-card={hasCard}>
      <td className="r-name">{p.name}</td>
      <td className="mono r-dim">
        {p.git.ok ? p.git.branch : <span className="unavailable">unavailable</span>}
      </td>
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
          <td
            key={r}
            className="r-role"
            title={rc?.via ? `${r}: ${rc.via}` : `${r}: not instantiated`}
          >
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
