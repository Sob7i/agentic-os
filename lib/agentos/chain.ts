/**
 * Chain instantiate — Stage 4 §3.2, §3.3. Ticket: docs/specs/stage-4-tickets.md T2.
 *
 * `instantiateTemplate` is the only export here (T3 adds `advanceChainAfterDone` alongside it in
 * this same file). It turns one `TaskTemplate` into one `Chain` row plus N `Task` rows, all in
 * `todo`, linked by `chainId`/`chainOrd` — nothing dispatches yet (spec §3.4 is T3's advance).
 *
 * **All-or-nothing (spec §3.3).** Every check below runs before any row is written: every
 * `{{variable}}` in every step's prompt binds, every non-`human` `assigneeAgentName` resolves to an
 * agent in this project, and the project itself has an execution layer (an `agentos.yml`, mirroring
 * `dispatch.ts`'s own precondition 1) and a primary repo on disk. The first failure, in step order,
 * is the one returned — the reason always names the step and the specific thing that failed, never
 * a generic "instantiate failed." A refusal writes zero rows: no `Chain`, no `Task`.
 */
import type { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import {
  createChain,
  createTask,
  getProject,
  getTemplateBySlug,
  listAgentsByProject,
  listTemplateSteps,
  setTaskBlockedReason,
} from "./db";
import { bindPrompt } from "./chain-render";

export interface InstantiateTemplateInput {
  db: DatabaseSync;
  projectId: string;
  templateSlug: string;
  /** Supplied values, keyed by variable name — e.g. `{ branchName: "feat/x", featureTitle: "X" }`. */
  variables: Record<string, string>;
}

export type InstantiateTemplateResult =
  | { ok: true; chainId: string; taskIds: string[] }
  | { ok: false; reason: string };

/** A snapshot of one step, as copied into `Chain.templateVersionJson` (spec §3.1, decision 6). */
interface TemplateVersionStep {
  ord: number;
  name: string;
  promptTemplate: string;
  assigneeAgentName: string;
  approvalGate: boolean;
  notes: string | null;
}

/** The whole snapshot stored on `Chain.templateVersionJson` — plain data, not a row reference. */
interface TemplateVersion {
  template: { id: string; slug: string; name: string; description: string };
  steps: TemplateVersionStep[];
}

function refuse(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

export function instantiateTemplate(input: InstantiateTemplateInput): InstantiateTemplateResult {
  const { db, projectId, templateSlug, variables } = input;

  const project = getProject(db, projectId);
  if (!project) {
    return refuse(`instantiate refused: no project ${projectId}`);
  }

  // ── §3.3 rule 3 — the project has an execution layer and a primary repo ──────────────────
  // Mirrors dispatch.ts's own precondition 1 (an execution layer is "there is an agentos.yml"),
  // one level earlier: a project with no opt-in file or no repo on disk cannot run a chain any
  // more than it can run a manual dispatch, and instantiate should say so before writing cards
  // nothing can ever run.
  if (!existsSync(project.yamlPath)) {
    return refuse(
      `instantiate refused: project '${project.slug}' has no execution layer — no agentos.yml at ${project.yamlPath}`,
    );
  }
  if (!existsSync(project.primaryRepoPath)) {
    return refuse(
      `instantiate refused: project '${project.slug}' has no primary repo at ${project.primaryRepoPath}`,
    );
  }

  const template = getTemplateBySlug(db, projectId, templateSlug);
  if (!template) {
    return refuse(`instantiate refused: no template '${templateSlug}' in project '${project.slug}'`);
  }

  const steps = listTemplateSteps(db, template.id);
  if (steps.length === 0) {
    return refuse(`instantiate refused: template '${templateSlug}' has no steps`);
  }

  const agentsByName = new Map(listAgentsByProject(db, projectId).map((a) => [a.name, a]));

  // ── Resolve every step before writing anything (§3.3) ─────────────────────────────────────
  const resolved: { ord: number; boundPrompt: string; assigneeAgentId: string | null }[] = [];
  for (const step of steps) {
    const bound = bindPrompt(step.promptTemplate, variables);
    if (!bound.ok) {
      return refuse(
        `instantiate refused at step ${step.ord} ('${step.name}'): unbound variable(s) ${bound.missing.join(", ")}`,
      );
    }

    let assigneeAgentId: string | null;
    if (step.assigneeAgentName === "human") {
      // §3.5: the literal `human` becomes `null` — human-only, never unassigned.
      assigneeAgentId = null;
    } else {
      const agent = agentsByName.get(step.assigneeAgentName);
      if (!agent) {
        return refuse(
          `instantiate refused at step ${step.ord} ('${step.name}'): assignee '${step.assigneeAgentName}' does not match any agent in project '${project.slug}'`,
        );
      }
      assigneeAgentId = agent.id;
    }

    resolved.push({ ord: step.ord, boundPrompt: bound.text, assigneeAgentId });
  }

  // ── Every check passed — snapshot the template, then write ────────────────────────────────
  const templateVersion: TemplateVersion = {
    template: {
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
    },
    steps: steps.map((s) => ({
      ord: s.ord,
      name: s.name,
      promptTemplate: s.promptTemplate,
      assigneeAgentName: s.assigneeAgentName,
      approvalGate: s.approvalGate,
      notes: s.notes,
    })),
  };

  db.exec("BEGIN");
  try {
    const chain = createChain(db, {
      projectId,
      templateId: template.id,
      templateVersion,
      variables,
    });

    const taskIds: string[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const r = resolved[i];
      // Steps 2..N carry a blockedReason naming their predecessor (§3.2, AC-3); the first step
      // carries none — nothing precedes it.
      const predecessor = i > 0 ? steps[i - 1] : null;
      const blockedReason = predecessor
        ? `waiting on step ${predecessor.ord} ('${predecessor.name}')`
        : null;

      const task = createTask(db, {
        projectId,
        name: step.name,
        description: r.boundPrompt,
        approvalGate: step.approvalGate,
        assigneeAgentId: r.assigneeAgentId,
        chainId: chain.id,
        chainOrd: step.ord,
      });
      if (blockedReason) {
        setTaskBlockedReason(db, task.id, blockedReason);
      }
      taskIds.push(task.id);
    }

    db.exec("COMMIT");
    return { ok: true, chainId: chain.id, taskIds };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
