import { Reveal } from "@/components/Reveal";

const SKILLS = [
  "Python",
  "TypeScript",
  "React",
  "Next.js",
  "FastAPI",
  "Node.js",
  "PyTorch",
  "YOLOv8",
  "OpenCV",
  "PostgreSQL",
  "Docker",
  "AWS",
  "System Design",
  "Computer Vision",
  "Microservices",
];

export function About() {
  return (
    <section
      id="about"
      className="relative px-6 md:px-10 py-32 md:py-48 border-t border-white/5"
    >
      <div className="mx-auto max-w-[1600px]">
        {/* Section label */}
        <Reveal>
          <div className="flex items-center gap-3 mb-16 text-[11px] uppercase tracking-[0.22em] text-mute">
            <span className="text-dim">[ 002 ]</span>
            <span className="h-px w-12 bg-mute/40" />
            <span>About</span>
          </div>
        </Reveal>

        {/* Bio — large editorial paragraph */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-2 md:sticky md:top-32 self-start">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
                Bio
              </span>
            </Reveal>
          </div>

          <div className="md:col-span-10 md:col-start-3">
            <Reveal delay={0.05}>
              <p className="text-2xl md:text-4xl leading-[1.25] tracking-[-0.01em] text-smoke font-light">
                Software engineer specializing in{" "}
                <span className="font-serif italic text-turquoise">
                  AI-driven systems
                </span>
                , computer vision, and full-stack development — with hands-on
                experience building scalable pipelines from data processing to
                real-time applications.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mt-8 text-lg md:text-xl leading-[1.6] text-mute max-w-3xl">
                Strong foundation in machine learning, backend architecture, and
                system design. I translate complex technical concepts into
                efficient, user-focused solutions across hardware, backend, and
                frontend — with a focus on{" "}
                <span className="text-smoke">performance</span>,{" "}
                <span className="text-smoke">scalability</span>, and{" "}
                <span className="text-smoke">practical impact</span>.
              </p>
            </Reveal>

            {/* Stat row */}
            <Reveal delay={0.25}>
              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 max-w-3xl">
                <Stat n="B.Eng" label="TMU · 2026" />
                <Stat n="Full-Stack" label="HW · Backend · Frontend" />
                <Stat n="3+" label="Years Building" />
                <Stat n="∞" label="Curiosity" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* Skills marquee */}
        <Reveal delay={0.1}>
          <div className="mt-32 md:mt-48 -mx-6 md:-mx-10">
            <div className="marquee py-8 border-y border-white/5">
              <div className="marquee-track">
                {[...SKILLS, ...SKILLS].map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex shrink-0 items-center gap-8"
                  >
                    <span className="font-serif italic text-base md:text-xl text-mute transition-all duration-500 ease-out hover:scale-[1.8] hover:text-turquoise inline-block origin-center cursor-default">
                      {s}
                    </span>
                    <span className="text-turquoise/40 text-base md:text-xl">
                      ·
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-white/10 pl-4">
      <span className="text-3xl md:text-4xl font-serif italic text-smoke">
        {n}
      </span>
      <span className="text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </span>
    </div>
  );
}
