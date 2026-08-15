"use server";

/**
 * The approval gate's server side. Spec §1.3, §3.4.
 *
 * The form posts a project name and a claim hash — never a path, never file
 * contents. The proposal is rebuilt here from `projects.config.ts` and the
 * repo's current state, then required to hash-match the drift the user was
 * looking at. So the browser cannot name a write target, cannot supply the bytes
 * to write, and cannot approve a drift that has changed since the page rendered.
 */
import { redirect } from "next/navigation";
import { PROJECTS } from "../projects.config";
import { reconcileProject } from "../lib/reconcile/checks";
import { applyFix } from "../lib/fix/apply";
import { proposeFix } from "../lib/fix/propose";
import { acknowledge, unacknowledge } from "../lib/fix/verified";

const back = (params: Record<string, string>) =>
  redirect(`/?${new URLSearchParams(params).toString()}`);

async function findCheck(projectName: string, claimHash: string) {
  const cfg = PROJECTS.find((p) => p.name === projectName);
  if (!cfg) return { cfg: null, check: null };
  const report = await reconcileProject(cfg);
  return { cfg, check: report.checks.find((c) => c.claimHash === claimHash) ?? null };
}

export async function approveFix(formData: FormData): Promise<void> {
  const projectName = String(formData.get("project") ?? "");
  const claimHash = String(formData.get("claimHash") ?? "");

  const { cfg, check } = await findCheck(projectName, claimHash);
  if (!cfg) back({ error: `unknown project "${projectName}"` });
  if (!check) {
    // Not an error so much as a fact about time: the drift moved while the page
    // sat open. Re-reading and refusing is the correct outcome, not a failure.
    back({ error: "That drift is no longer the one on disk — the Board has been re-checked. Read it again before approving." });
  }

  const proposal = proposeFix(cfg!.name, cfg!.path, check!);
  if (!proposal.available) back({ error: proposal.reason });

  const result = applyFix(proposal as Extract<typeof proposal, { available: true }>);
  if (!result.ok) back({ error: result.reason ?? "the write was refused" });

  back({ written: claimHash, project: projectName });
}

export async function markVerified(formData: FormData): Promise<void> {
  const projectName = String(formData.get("project") ?? "");
  const claimHash = String(formData.get("claimHash") ?? "");
  const claim = String(formData.get("claim") ?? "");
  const checkId = String(formData.get("checkId") ?? "");

  acknowledge(claimHash, {
    atISO: new Date().toISOString(),
    project: projectName,
    checkId,
    claim,
  });
  back({});
}

export async function clearVerified(formData: FormData): Promise<void> {
  unacknowledge(String(formData.get("claimHash") ?? ""));
  back({});
}
