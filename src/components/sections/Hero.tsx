import { LiveClock } from "@/components/LiveClock";

export function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-screen flex flex-col justify-between pt-32 pb-10 px-6 md:px-10 grain"
    >
      {/* Top metadata strip */}
      <div className="flex flex-wrap items-end justify-between gap-6 text-[11px] uppercase tracking-[0.22em] text-mute">
        <div className="flex flex-col gap-1">
          <span className="text-dim">[ 001 ]</span>
          <span>Software Engineer · ML &amp; Full-Stack</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="text-dim">Toronto, ON</span>
          <span className="text-smoke">
            <LiveClock /> <span className="text-mute">EST</span>
          </span>
        </div>
      </div>

      {/* Main display name */}
      <div className="flex-1 flex flex-col justify-center py-16">
        <h1 className="reveal-blur leading-[0.85] tracking-[-0.04em]">
          <span
            className="block text-[15vw] md:text-[11.5vw] font-medium text-smoke"
            style={{ fontVariationSettings: '"wght" 500' }}
          >
            Arvin
          </span>
          <span className="block text-[15vw] md:text-[11.5vw] font-serif italic text-turquoise -mt-[1.5vw] md:pl-[8vw]">
            Aryanpour
          </span>
        </h1>

        <div
          className="mt-12 md:mt-16 max-w-2xl reveal-blur"
          style={{ animationDelay: "300ms" }}
        >
          <p className="text-lg md:text-xl text-smoke-dim leading-relaxed">
            Building <span className="font-serif italic text-turquoise">AI-driven</span>{" "}
            systems, computer vision pipelines, and full-stack applications,
            from data ingestion to real-time interfaces.
          </p>
        </div>

        <div
          className="mt-10 reveal-blur flex flex-wrap items-center gap-4"
          style={{ animationDelay: "450ms" }}
        >
          <a
            href="/resume.pdf"
            download
            className="group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-pill border border-white/15 hover:border-turquoise/60 transition-all duration-500"
          >
            <span className="text-[12px] uppercase tracking-[0.22em] group-hover:text-turquoise transition-colors">
              Download Resume
            </span>
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-turquoise/10 group-hover:bg-turquoise transition-all duration-500 group-hover:rotate-[360deg]">
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5 text-turquoise group-hover:text-onyx-deep transition-colors"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path
                  d="M8 3V12M8 12L4 8M8 12L12 8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>
          <a
            href="#work"
            className="text-[12px] uppercase tracking-[0.22em] text-mute hover:text-smoke link-reveal transition-colors"
          >
            View Work
          </a>
        </div>
      </div>

      {/* Bottom strip — credentials & scroll cue */}
      <div className="flex flex-wrap items-end justify-between gap-6 text-[11px] uppercase tracking-[0.22em] text-mute">
        <div className="flex flex-col gap-1">
          <span className="text-dim">Credential</span>
          <span>B.Eng · Toronto Metropolitan University</span>
        </div>
        <div className="hidden md:flex items-end gap-4">
          <span className="text-dim">Scroll</span>
          <span className="block w-12 h-px bg-mute relative overflow-hidden">
            <span
              className="absolute inset-y-0 left-0 w-1/2 bg-turquoise"
              style={{
                animation: "marquee 2.4s ease-in-out infinite alternate",
              }}
            />
          </span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="text-dim">Focus</span>
          <span>ML · Computer Vision · System Design</span>
        </div>
      </div>
    </section>
  );
}
