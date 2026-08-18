import Link from "next/link";
import type { ProjectNav } from "@/lib/shell/model";
import s from "./shell.module.css";

/**
 * The project rail. Five work tabs at most — the cap is load-bearing (D23):
 * Agents, Templates, Environments and Repos are configuration, and the
 * work-versus-setup split holds only while there is nowhere for them to creep.
 */
export function ProjectRail({ nav, currentTab }: { nav: ProjectNav; currentTab: string | null }) {
  return (
    <aside className={s.rail}>
      <p className={s.railName}>{nav.project.name}</p>
      <p className={s.railRepo}>{nav.project.path.replace(/^.*\/(?=[^/]+\/[^/]+$)/, "…/")}</p>

      {nav.tabs.length > 0 ? (
        <ul className={s.railTabs}>
          {nav.tabs.map((t) => (
            <li className={s.railTab} key={t.key}>
              <Link href={`/p/${nav.slug}/${t.key}`} data-current={t.key === currentTab}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.railNote}>
          No execution layer, so no work surfaces. The Board&rsquo;s view of this project is on the
          right.
        </p>
      )}

      {nav.tabs.length > 0 && (
        <p className={s.setup}>Agents · Templates · Environments · Repos live behind configuration</p>
      )}
    </aside>
  );
}
