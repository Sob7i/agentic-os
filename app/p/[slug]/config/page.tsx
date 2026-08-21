import { redirect } from "next/navigation";

/**
 * `/p/<slug>/config` is not a page — it is the parent of the four setup sections (D32).
 *
 * One place decides the default section, so the rail, the agent-edit links and any bookmark all
 * land somewhere real. Note this route is now **redirect-only**: nothing may `revalidatePath` it,
 * because revalidating a redirect refreshes nothing (AC-21).
 */
export default async function ConfigIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/p/${slug}/config/agents`);
}
