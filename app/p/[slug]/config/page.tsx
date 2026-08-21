import { notFound, redirect } from "next/navigation";
import { boardOnce } from "@/lib/reconcile/cached";
import { projectNav } from "@/lib/shell/model";

export const dynamic = "force-dynamic";

/**
 * `/p/<slug>/config` is not a page — it is the parent of the four setup sections (D32).
 *
 * One place decides the default section, so the rail, the agent-edit links and any old bookmark
 * all land somewhere real. It refuses first, though: a project with no execution layer has no
 * setup surfaces at all (D18, Stage 3a AC-6), and bouncing it to `/config/agents` just to 404
 * there would make the honest answer arrive one redirect late.
 *
 * This route is **redirect-only** by design, which means nothing may `revalidatePath` it —
 * revalidating a redirect refreshes nothing. AC-21 enforces that structurally.
 */
export default async function ConfigIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nav = projectNav(await boardOnce(), slug);
  if (!nav || !nav.executionLayer) notFound();
  redirect(`/p/${slug}/config/agents`);
}
