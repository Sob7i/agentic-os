import Link from "next/link";
import type { NavRow, ProjectNav } from "@/lib/shell/model";
import { projectRailModel } from "@/lib/shell/model";
import s from "./shell.module.css";

/**
 * The project rail, built to wireframe frame B'2.
 *
 * Dumb by design (CLAUDE.md: "shell logic is pure; shell components are dumb"). Every decision
 * this file would otherwise make — which rows, which one is current, whether a count renders,
 * what the severity line says — is already made in `projectRailModel`, where
 * `scripts/verify-stage3c.mts` asserts it without rendering a route.
 *
 * D32: five work rows and a SETUP group, not five tabs and a footer link. The work/setup split is
 * a divider plus a URL prefix (`/p/<slug>/config/<section>`), because B''s rail is vertical and the
 * five-tab cap Concept C relied on was never a real constraint here.
 */
export function ProjectRail({
  nav,
  currentTab,
  inboxOpenCount = null,
}: {
  nav: ProjectNav;
  currentTab: string | null;
  /** `null` = not counted. Passed in by the page, never read here — see `projectRailModel`. */
  inboxOpenCount?: number | null;
}) {
  const model = projectRailModel({ nav, currentKey: currentTab, inboxOpenCount });

  return (
    <aside className={s.rail}>
      <Link className={s.railBack} href={model.back.href}>
        <span aria-hidden="true">←</span> {model.back.label}
      </Link>

      <div className={s.railIdentity}>
        <p className={s.railName}>{model.identity.name}</p>
        <p className={s.railDrift} data-s={model.identity.drift.severity}>
          {model.identity.drift.text}
        </p>
      </div>

      {model.work.length === 0 ? (
        <>
          <hr className={s.railRule} />
          <p className={s.railNote}>
            No execution layer, so no work surfaces. The Board&rsquo;s view of this project is on
            the right.
          </p>
        </>
      ) : (
        <>
          <hr className={s.railRule} />
          <ul className={s.railRows}>
            {model.work.map((row) => (
              <RailRow key={row.key} row={row} />
            ))}
          </ul>

          <hr className={s.railRule} />
          <p className={s.railSectionLabel}>{model.setupLabel}</p>
          <ul className={s.railRows}>
            {model.setup.map((row) => (
              <RailRow key={row.key} row={row} />
            ))}
          </ul>
        </>
      )}

      <div className={s.railSpacer} />
      <p className={s.railFooter}>{model.footer}</p>
    </aside>
  );
}

function RailRow({ row }: { row: NavRow }) {
  return (
    <li className={s.railRow}>
      <Link href={row.href} data-current={row.current} data-state={row.state}>
        <span className={s.railRowLabel}>{row.label}</span>
        {/* `null` renders nothing at all. A zero here would be a claim about a store nobody
            opened — the same rule the card evidence lines follow for unknown costs (AC-3). */}
        {row.count !== null && <span className={s.railCount}>{row.count}</span>}
      </Link>
    </li>
  );
}
