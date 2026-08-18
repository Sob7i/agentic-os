import type { CheckResult } from "@/lib/types";
import { markVerified } from "@/app/actions";

// Extracted from app/page.tsx in Stage 3a. Moved, not rewritten: no change to
// what any Stage 2 acceptance check observes (spec §5.3, AC-1).

/**
 * "Leave as is" acknowledges; it does not dismiss.
 *
 * The wireframe's second button read "Reject", but a reject that forgets on
 * reload would be the dashboard lying about its own memory. Acknowledging is the
 * honest version of the same gesture: it records that you looked, nothing more,
 * and it expires on its own when the claim changes (D6, spec §1.5).
 */
export function AckForm({
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
