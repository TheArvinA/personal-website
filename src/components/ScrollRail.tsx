"use client";

import { useEffect, useRef } from "react";
import { useScrollStore } from "@/lib/scrollStore";

/**
 * A slim vertical scroll-progress rail fixed to the right edge. A turquoise fill
 * grows from the top and a small glowing dot rides the current scroll position
 * (0 = top of page, 1 = bottom). Reads `scrollStore.progress` (raw scroll
 * fraction) via a direct store subscription and writes styles to refs, so it
 * never triggers React re-renders on scroll. Purely decorative (aria-hidden,
 * pointer-events-none); hidden on very small screens.
 */
export function ScrollRail() {
  const fillRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = (p: number) => {
      const pct = p < 0 ? 0 : p > 1 ? 1 : p;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${pct})`;
      if (dotRef.current) dotRef.current.style.top = `${pct * 100}%`;
    };
    apply(useScrollStore.getState().progress);
    const unsub = useScrollStore.subscribe((s) => apply(s.progress));
    return unsub;
  }, []);

  return (
    <div
      aria-hidden
      className="fixed right-5 md:right-7 top-1/2 z-40 hidden h-[38vh] w-px -translate-y-1/2 sm:block pointer-events-none"
    >
      {/* Track */}
      <div className="absolute inset-0 bg-white/10" />
      {/* Fill (grows from top, scaleY driven by progress) */}
      <div
        ref={fillRef}
        className="absolute inset-x-0 top-0 h-full origin-top bg-turquoise/70"
        style={{ transform: "scaleY(0)" }}
      />
      {/* Traveling dot */}
      <div
        ref={dotRef}
        className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-turquoise"
        style={{ top: "0%", boxShadow: "0 0 8px 1px var(--color-turquoise)" }}
      />
    </div>
  );
}
