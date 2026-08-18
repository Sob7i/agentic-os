import Link from "next/link";
import { GLYPH } from "@/lib/severity";
import type { RibbonModel } from "@/lib/shell/model";
import s from "./shell.module.css";

/**
 * The portfolio ribbon (D23) — always present inside a project.
 *
 * The owner's instruction was that the ribbon matters only when the project has
 * drifted. That was adopted for the drift band and rejected here: a ribbon that
 * appears only on drift makes its own *absence* the claim "nothing here has
 * drifted", asserted with nothing saying when it was checked. Invariant 2, and
 * the same distinction Stage 1 already ships between "nothing to check" and
 * "checked and fine".
 */
export function Ribbon({ model, currentSlug }: { model: RibbonModel; currentSlug: string }) {
  return (
    <nav className={s.ribbon} aria-label="Portfolio">
      <Link className={s.back} href="/">
        <span aria-hidden>←</span> All projects <span className={s.kbd}>⌘1</span>
      </Link>
      <span className={s.sep} aria-hidden />

      {model.ok ? (
        <>
          <div className={s.projects}>
            {model.projects.map((p) => (
              <Link
                key={p.slug}
                href={`/p/${p.slug}`}
                className={s.proj}
                data-current={p.slug === currentSlug}
                title={p.name}
              >
                <span className={s.glyph} data-s={p.severity} aria-hidden>
                  {GLYPH[p.severity]}
                </span>
                {p.name}
              </Link>
            ))}
          </div>
          <span className={s.fresh}>
            verified {new Date(model.checkedAtISO).toLocaleTimeString()}
          </span>
        </>
      ) : (
        // Never six glyphs sourced from a run that failed (AC-4).
        <span className={s.ribbonFail}>{model.reason}</span>
      )}
    </nav>
  );
}
