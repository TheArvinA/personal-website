import { WorkExplorer } from "@/components/sections/WorkExplorer";
import { PROJECTS } from "@/lib/projectsData";

/**
 * Work section entry point. The old pinned-scroll cross-fade (`PinnedProjects`)
 * is gone; the interactive explore stage lives in `WorkExplorer`, which owns the
 * `id="work"` section shell, header, sticky stage, pointer capture and the
 * hover director (see docs/interactive-head-implementation-plan.md, Phase 1).
 */
export function Projects() {
  return <WorkExplorer projects={PROJECTS} />;
}
