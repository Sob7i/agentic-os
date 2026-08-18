import Link from "next/link";
import s from "@/components/shell/shell.module.css";

export const dynamic = "force-dynamic";

/**
 * Honest placeholder (AC-9). No tabs, no empty table, no skeleton implying data
 * is loading — an empty state that looks like a loading state is a claim.
 */
export default function OverviewPage() {
  return (
    <main className={s.pane}>
      <h1 className={s.h1}>Overview</h1>
      <p className={s.notBuilt}>
        Not built. The Overview is Stage 6, and it was deliberately re-scoped: D22 requires it to
        read <em>two</em> sources — tasks and goals where a project has an execution layer,
        documents and git where it does not — and the first of those does not exist yet. There is
        nothing to show here that would not be a guess. <Link href="/">Back to the Board</Link>.
      </p>
    </main>
  );
}
