import type { Project } from "@/lib/projectsData";

/**
 * Project card content markup, extracted verbatim from the old
 * `PinnedProjects.tsx` (deleted — it drove a pinned scroll cross-fade that no
 * longer exists) so the content blocks (title pre/accent/post, tagline,
 * description, 3 metrics, stack pills, status badge, year, index) survive to
 * be reused/restyled by the future `ProjectPanel` (see
 * docs/interactive-head-implementation-plan.md §5.2, §1.10).
 *
 * `flip` mirrors the two-column layout (used previously to alternate visual
 * blocks between left/right on consecutive cards); kept for callers that want
 * it, defaults to false.
 */
export function ProjectCard({
  project,
  flip = false,
}: {
  project: Project;
  flip?: boolean;
}) {
  return (
    <article className="group relative">
      <div
        className={`grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 ${
          flip ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Left visual block */}
        <div className="md:col-span-5">
          <div className="relative aspect-[4/5] md:aspect-[5/6] overflow-hidden rounded-card bg-card border border-white/5 transition-all duration-700 group-hover:border-turquoise/30">
            {/* Project number — massive */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif italic text-[28vw] md:text-[12vw] leading-none text-onyx-deep transition-transform duration-1000 group-hover:scale-105 group-hover:text-taupe/40">
                {project.index}
              </span>
            </div>
            {/* Floating year badge */}
            <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-pill bg-onyx-deep/70 backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-[0.22em] text-mute">
              <span className="pulse-dot" />
              {project.status}
            </div>
            <div className="absolute top-5 right-5 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
              {project.year}
            </div>
            {/* Bottom hover overlay */}
            <div className="absolute inset-x-0 bottom-0 p-6 transform transition-transform duration-700 ease-out">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                {project.tagline}
              </div>
            </div>
          </div>
        </div>

        {/* Right content block */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <div>
            <h3 className="text-4xl md:text-6xl leading-[0.95] tracking-[-0.03em] font-light">
              {project.pre && <>{project.pre} </>}
              <span className="font-serif italic text-turquoise">
                {project.accent}
              </span>
              {project.post && <> {project.post}</>}
            </h3>
            <p className="mt-8 text-lg md:text-xl text-smoke-dim leading-[1.55] max-w-xl">
              {project.description}
            </p>
          </div>

          {/* Metrics row */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
            {project.metrics.map((m) => (
              <div
                key={m.label}
                className="border-l border-white/10 pl-3 transition-colors group-hover:border-turquoise/40"
              >
                <div className="font-serif italic text-2xl md:text-3xl text-smoke">
                  {m.value}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-mute leading-tight">
                  {m.label}
                </div>
              </div>
            ))}
          </div>

          {/* Stack pills */}
          <div className="mt-10 flex flex-wrap gap-2 max-w-xl">
            {project.stack.map((tech) => (
              <span
                key={tech}
                className="px-4 py-1.5 rounded-pill border border-white/10 text-[11px] uppercase tracking-[0.18em] text-mute hover:text-smoke hover:border-turquoise/40 transition-colors"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
