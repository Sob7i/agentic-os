import { PROJECTS } from "../../projects.config";
import type { BoardReport, ProjectReport, Severity } from "../types";
import { reconcileProject } from "./checks";

const SORT: Record<Severity, number> = {
  drift: 0,
  attention: 1,
  unverifiable: 2,
  "in-sync": 3,
};

/** Build the whole board. Projects reconcile in parallel and independently. */
export async function buildBoard(): Promise<BoardReport> {
  const settled = await Promise.allSettled(PROJECTS.map((p) => reconcileProject(p)));

  const projects: ProjectReport[] = settled.map((res, i) => {
    if (res.status === "fulfilled") return res.value;
    // A thrown collector must degrade one row, never the board (AC-7).
    const cfg = PROJECTS[i];
    return {
      name: cfg.name,
      path: cfg.path,
      severity: "unverifiable",
      git: { ok: false, reason: String(res.reason).slice(0, 200) },
      github: { ok: false, reason: "not attempted — project unavailable" },
      docs: { roles: [], stateDocPath: null, stateDocMtimeISO: null, claims: [], nextUpPrRefs: [] },
      checks: [],
      checkedAtISO: new Date().toISOString(),
    };
  });

  projects.sort((a, b) => SORT[a.severity] - SORT[b.severity] || a.name.localeCompare(b.name));

  return {
    projects,
    checkedAtISO: new Date().toISOString(),
    degraded: projects.some((p) => !p.git.ok || !p.github.ok),
  };
}
