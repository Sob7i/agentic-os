import Link from "next/link";
import type { CheckResult } from "@/lib/types";
import s from "./shell.module.css";

/**
 * The conditional half of D23 — rendered only when *this* project is in drift.
 *
 * It quotes the Board's own check and links back to it. It never re-derives,
 * re-words or re-scores: a second drift board inside a project is exactly what
 * D22 refused, and the difference between "quotation" and "second opinion" is
 * that a quotation cannot disagree.
 */
export function DriftBand({ check }: { check: CheckResult }) {
  return (
    <div className={s.band} role="status">
      <span className={s.bandGlyph} aria-hidden>⚠</span>
      <span>
        <strong>This project is in drift.</strong> {check.headline}
        {check.claimed && (
          <>
            {" "}
            {check.source ?? "The state document"} claims &ldquo;{check.claimed}&rdquo;
            {check.verified ? ` — ${check.verified}` : ""}.
          </>
        )}{" "}
        Work started here inherits that premise.
      </span>
      <Link className={s.bandLink} href="/">
        open on Board
      </Link>
    </div>
  );
}
