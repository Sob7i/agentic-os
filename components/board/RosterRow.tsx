import { humanAge } from "@/lib/collectors/exec";
import { GLYPH, WORD } from "@/lib/severity";
import { ROLE_ORDER, type ProjectReport } from "@/lib/types";

// Extracted from app/page.tsx in Stage 3a. Moved, not rewritten: no change to
// what any Stage 2 acceptance check observes (spec §5.3, AC-1).

export function RosterRow({ p, hasCard }: { p: ProjectReport; hasCard: boolean }) {
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
