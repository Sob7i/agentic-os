import { humanAge } from "@/lib/collectors/exec";
import type { ProposalResult } from "@/lib/fix/propose";
import type { Acknowledgement } from "@/lib/fix/verified";
import type { CheckResult, ProjectReport } from "@/lib/types";
import { approveFix, clearVerified } from "@/app/actions";
import { AckForm } from "./AckForm";

// Extracted from app/page.tsx in Stage 3a. Moved, not rewritten: no change to
// what any Stage 2 acceptance check observes (spec §5.3, AC-1).

/**
 * The gate (DESIGN-BRIEF §5.2, wireframe "Fix Proposal v2 — Fixable (DC1)").
 *
 * Four states, and only one of them has a button: proposable, already
 * acknowledged, just written, or no automatic fix — which is the common case and
 * gets a reason rather than a greyed-out control (AC-8).
 */
export function FixSection({
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
