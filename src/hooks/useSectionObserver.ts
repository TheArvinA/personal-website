"use client";

import { useEffect } from "react";
import { useScrollStore, type SectionId } from "@/lib/scrollStore";

/** Maps DOM section ids -> logical section keys used by the 3D layer. */
const SECTION_IDS: { id: string; key: SectionId }[] = [
  { id: "top", key: "hero" },
  { id: "about", key: "about" },
  { id: "work", key: "work" },
  { id: "contact", key: "contact" },
];

/**
 * Watches the four page sections and writes the active one into the store,
 * plus a coarse 0..1 scroll progress. Runs on the client only.
 */
export function useSectionObserver() {
  const setSection = useScrollStore((s) => s.setSection);
  const setProgress = useScrollStore((s) => s.setProgress);

  useEffect(() => {
    const els = SECTION_IDS.map(({ id, key }) => {
      const el = document.getElementById(id);
      return el ? { el, key } : null;
    }).filter(Boolean) as { el: HTMLElement; key: SectionId }[];

    if (els.length === 0) return;

    // Track the most-visible section.
    const ratios = new Map<SectionId, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const match = els.find((e) => e.el === entry.target);
          if (match) ratios.set(match.key, entry.intersectionRatio);
        }
        let best: SectionId = "hero";
        let bestRatio = -1;
        for (const { key } of els) {
          const r = ratios.get(key) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = key;
          }
        }
        setSection(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    els.forEach(({ el }) => io.observe(el));

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [setSection, setProgress]);
}
