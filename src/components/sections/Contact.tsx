import { Reveal } from "@/components/Reveal";
import { Magnetic } from "@/components/Magnetic";
import { LiveClock } from "@/components/LiveClock";

const LINKS = [
  {
    label: "Email",
    value: "arvinaryanpoura@gmail.com",
    href: "mailto:arvinaryanpoura@gmail.com",
  },
  {
    label: "GitHub",
    value: "@TheArvinA",
    href: "https://github.com/TheArvinA",
  },
  {
    label: "LinkedIn",
    value: "in/arvinary",
    href: "https://www.linkedin.com/in/arvinary/",
  },
];

export function Contact() {
  return (
    <section
      id="contact"
      className="relative px-6 md:px-10 py-32 md:py-48 border-t border-white/5"
    >
      <div className="mx-auto max-w-[1600px]">
        <Reveal>
          <div className="flex items-center gap-3 mb-16 text-[11px] uppercase tracking-[0.22em] text-mute">
            <span className="text-dim">[ 004 ]</span>
            <span className="h-px w-12 bg-mute/40" />
            <span>Get in touch</span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h2 className="text-5xl md:text-[7.5vw] leading-[0.95] tracking-[-0.04em] font-light max-w-[14ch]">
            Let&apos;s build something{" "}
            <span className="font-serif italic text-turquoise">real</span>.
          </h2>
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mt-10 text-lg md:text-xl text-mute max-w-2xl leading-relaxed">
            I&apos;m open to new-grad roles, contract work, and interesting
            collaborations across ML, computer vision, and full-stack systems.
          </p>
        </Reveal>

        {/* Links */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-card overflow-hidden">
          {LINKS.map((link, i) => (
            <Reveal key={link.label} delay={0.05 * i}>
              <a
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group relative block bg-onyx/40 backdrop-blur-md px-6 md:px-8 py-10 md:py-12 transition-colors hover:bg-card/60 h-full"
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                    {link.label}
                  </span>
                  <Magnetic strength={0.5}>
                    <span className="block w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-mute group-hover:border-turquoise group-hover:text-turquoise transition-colors">
                      <svg
                        viewBox="0 0 16 16"
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M5 11L11 5M11 5H6M11 5V10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Magnetic>
                </div>
                <div className="text-2xl md:text-3xl font-serif italic text-smoke group-hover:text-turquoise transition-colors leading-tight break-words">
                  {link.value}
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-32 pt-10 border-t border-white/5 flex flex-wrap items-end justify-between gap-6 text-[11px] uppercase tracking-[0.22em] text-mute">
          <div className="flex flex-col gap-1">
            <span className="text-dim">© Arvin Aryanpour</span>
            <span>Toronto, ON</span>
          </div>
          <div className="flex flex-col gap-1 md:items-center">
            <span className="text-dim">Local time</span>
            <span className="text-smoke">
              <LiveClock />
            </span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-dim">Built with</span>
            <span>Next.js · Tailwind · Motion</span>
          </div>
        </div>
      </div>
    </section>
  );
}
