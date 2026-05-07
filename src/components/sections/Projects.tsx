import { Reveal } from "@/components/Reveal";

interface Project {
  index: string;
  year: string;
  pre?: string;
  accent: string;
  post?: string;
  tagline: string;
  description: string;
  metrics: { value: string; label: string }[];
  stack: string[];
  href?: string;
  status: "Live" | "Case Study" | "In Development";
}

const PROJECTS: Project[] = [
  {
    index: "01",
    year: "2026",
    pre: "Volleyball",
    accent: "Tracker",
    tagline: "Real-time computer vision for sports analytics",
    description:
      "Built an end-to-end computer vision pipeline using YOLOv8 + ByteTrack for player and ball tracking, paired with a FastAPI + React full-stack video system delivering frame-accurate analytics in real time.",
    metrics: [
      { value: "87.9%", label: "Detection Precision" },
      { value: "<50ms", label: "Per-frame Latency" },
      { value: "Full-Stack", label: "End-to-End System" },
    ],
    stack: ["YOLOv8", "ByteTrack", "FastAPI", "React", "OpenCV", "PyTorch"],
    status: "In Development",
  },
  {
    index: "02",
    year: "2026",
    accent: "Smart",
    post: "Parking",
    tagline: "Distributed FastAPI services with real-time occupancy",
    description:
      "Engineered a distributed smart-parking platform as three FastAPI microservices with a React frontend, IoT-driven occupancy simulation, and a PostgreSQL-backed reservation system using license-plate + one-time-password authentication.",
    metrics: [
      { value: "3", label: "FastAPI Services" },
      { value: "Real-time", label: "IoT Simulation" },
      { value: "PostgreSQL", label: "Persistent Layer" },
    ],
    stack: ["Python", "FastAPI", "React", "PostgreSQL", "Uvicorn", "Microservices"],
    status: "Case Study",
  },
  {
    index: "03",
    year: "2025",
    pre: "Facial",
    accent: "Merging",
    tagline: "Face-landmark pipeline with an interactive web UI",
    description:
      "Built a facial-merging pipeline on the LFW dataset using dlib landmarks, OpenCV warping, and TensorFlow, exposed through both a Jupyter workflow for experimentation and a Gradio web UI for interactive merging in the browser.",
    metrics: [
      { value: "dlib", label: "Face Landmarks" },
      { value: "Gradio", label: "Web UI" },
      { value: "LFW", label: "Dataset" },
    ],
    stack: ["Python", "dlib", "OpenCV", "TensorFlow", "Gradio", "Jupyter"],
    status: "Live",
  },
];

export function Projects() {
  return (
    <section
      id="work"
      className="relative px-6 md:px-10 py-32 md:py-48 border-t border-white/5"
    >
      <div className="mx-auto max-w-[1600px]">
        {/* Section header */}
        <div className="flex items-end justify-between flex-wrap gap-6 mb-20">
          <Reveal>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mute">
              <span className="text-dim">[ 003 ]</span>
              <span className="h-px w-12 bg-mute/40" />
              <span>Selected Work</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-5xl md:text-7xl font-light leading-[0.95] tracking-[-0.03em]">
              Projects &{" "}
              <span className="font-serif italic text-turquoise">case studies</span>
            </h2>
          </Reveal>
        </div>

        {/* Project list */}
        <div className="flex flex-col gap-24 md:gap-32">
          {PROJECTS.map((p, i) => (
            <ProjectCard key={p.index} project={p} flip={i % 2 === 1} />
          ))}
        </div>

        {/* Placeholder for future */}
        <Reveal>
          <div className="mt-24 md:mt-32 rounded-card border border-dashed border-white/10 px-8 py-12 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-dim">
              [ 003.x ]
            </span>
            <p className="mt-3 text-xl md:text-2xl font-serif italic text-mute">
              More projects coming soon —
            </p>
            <p className="mt-1 text-sm text-dim">
              this space is intentionally left open.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ProjectCard({ project, flip }: { project: Project; flip: boolean }) {
  return (
    <Reveal>
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
    </Reveal>
  );
}
