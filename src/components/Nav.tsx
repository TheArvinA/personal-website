"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-6"
      }`}
    >
      <div
        className={`mx-auto max-w-[1600px] px-6 md:px-10 flex items-center justify-between transition-all duration-500`}
      >
        <a
          href="#top"
          className="font-serif italic text-3xl md:text-4xl leading-none tracking-tight"
        >
          aa
          <span className="text-turquoise">.</span>
        </a>

        <div className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.22em] text-mute">
          <a href="#about" className="link-reveal hover:text-smoke transition-colors">
            About
          </a>
          <a href="#work" className="link-reveal hover:text-smoke transition-colors">
            Work
          </a>
          <a href="#contact" className="link-reveal hover:text-smoke transition-colors">
            Contact
          </a>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-pill border border-white/10 bg-onyx-deep/60 backdrop-blur-md">
          <span className="pulse-dot" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-mute">
            Available
          </span>
        </div>
      </div>
    </nav>
  );
}
