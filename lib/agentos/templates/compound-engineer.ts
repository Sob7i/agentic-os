/**
 * The built-in `compound-engineer-workflow` template — AgentOS-spec §10's nine-step table,
 * transcribed as **exported data, not a migration fixture** (`docs/specs/stage-4-tickets.md` T1),
 * so a later check (AC-11) can edit the seeded row underneath a running chain and prove the chain
 * ignores it (spec §3.1: `Chain.templateVersionJson` copies this at instantiate).
 *
 * Agent names are exactly as §10 names them: six distinct names, none of which exists in this
 * project today (`stage-4-tickets.md`'s inherited fact 4 — this project's two agents are
 * `ux-ui-designer` and `frontend developer`) — `spec`, `plan`, `review-coordinator`,
 * `implementation-plan-executioner`, `senior-dev`, `librarian` — plus the reserved literal `human`
 * at step 9. Instantiating this template here today refuses at §3.3's rule 2, naming the first
 * step whose agent does not resolve; that is the spec working, not a defect in this file.
 *
 * Step 3 is **one `review-coordinator` session** producing three named reviews (feasibility,
 * scope-guardian, coherence) and a consolidated must-fix / should-fix list — spec §5.4 declines to
 * spawn four review agents in parallel for this stage; sub-agent fan-out is a later, out-of-scope
 * axis (`docs/BACKLOG.md`).
 */

export interface TemplateStepSeed {
  ord: number;
  name: string;
  /** Raw `{{var}}` text — bound at instantiate (spec §3.3), never bound here. */
  promptTemplate: string;
  /** A name, or the reserved literal `human` (spec §3.1) — resolved to an id at instantiate. */
  assigneeAgentName: string;
  approvalGate: boolean;
  notes: string | null;
}

export interface TemplateSeed {
  slug: string;
  name: string;
  description: string;
  variables: string[];
  steps: TemplateStepSeed[];
}

export const COMPOUND_ENGINEER_TEMPLATE: TemplateSeed = {
  slug: "compound-engineer-workflow",
  name: "compound-engineer",
  description:
    "A nine-step, fully managed feature build — spec, plan, plan review, implementation, code " +
    "review, fixes, docs, then a human reviews and merges. AgentOS-spec §10.",
  variables: ["branchName", "featureTitle", "featureSpec"],
  steps: [
    {
      ord: 1,
      name: "Write a spec",
      promptTemplate:
        "Write a detailed spec for {{featureTitle}} on branch {{branchName}}. Attach the spec " +
        "file. Context: {{featureSpec}}",
      assigneeAgentName: "spec",
      approvalGate: true,
      notes:
        "Human reads, approves, marks done. The next step cannot start before that (spec §3.4).",
    },
    {
      ord: 2,
      name: "Plan",
      promptTemplate: "Turn the approved spec on {{branchName}} into a concrete, ordered plan.",
      assigneeAgentName: "plan",
      approvalGate: false,
      notes: "Writes the plan into activity/inbox for a human to review, but does not block on it.",
    },
    {
      ord: 3,
      name: "Plan review",
      promptTemplate:
        "Review the plan for {{featureTitle}} on {{branchName}}. Produce three named reviews — " +
        "feasibility, scope-guardian, coherence — and consolidate them into a must-fix / " +
        "should-fix list.",
      assigneeAgentName: "review-coordinator",
      approvalGate: false,
      notes:
        "One session, sequential reviews (spec §5.4) — not four spawned agents. Sub-agent " +
        "fan-out is out of scope for this stage.",
    },
    {
      ord: 4,
      name: "Revise plan",
      promptTemplate:
        "Revise the plan for {{branchName}} using the plan review's must-fix / should-fix list.",
      assigneeAgentName: "plan",
      approvalGate: false,
      notes: null,
    },
    {
      ord: 5,
      name: "Implementation",
      promptTemplate:
        "Implement the revised plan for {{featureTitle}} on {{branchName}}. Run end-to-end tests " +
        "as part of this work.",
      assigneeAgentName: "implementation-plan-executioner",
      approvalGate: false,
      notes: null,
    },
    {
      ord: 6,
      name: "Code review",
      promptTemplate:
        "Review the implementation on {{branchName}}. Consolidate a must-fix / should-fix list.",
      assigneeAgentName: "review-coordinator",
      approvalGate: false,
      notes: null,
    },
    {
      ord: 7,
      name: "Apply review fixes",
      promptTemplate: "Apply the code review's fixes on {{branchName}}.",
      assigneeAgentName: "senior-dev",
      approvalGate: false,
      notes: null,
    },
    {
      ord: 8,
      name: "Librarian",
      promptTemplate: "Update the internal wiki to reflect how {{featureTitle}} now works.",
      assigneeAgentName: "librarian",
      approvalGate: false,
      notes: null,
    },
    {
      ord: 9,
      name: "Human review of deployment / PR",
      promptTemplate: "Check out the PR for {{branchName}}, review, and merge.",
      assigneeAgentName: "human",
      approvalGate: true,
      notes:
        "Ends the chain's automation, not the chain (spec §3.5) — there is no step 10, so nothing " +
        "dispatches after this one.",
    },
  ],
};
