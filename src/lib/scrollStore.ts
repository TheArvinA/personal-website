import { create } from "zustand";

export type SectionId = "hero" | "about" | "work" | "contact";

/**
 * Shared state bridging the DOM scroll world and the R3F canvas.
 * - activeSection: which section is currently in view (drives head pose)
 * - activeRegion: which brain region should glow (Milestone B; -1 = none)
 * - progress: 0..1 overall scroll progress (subtle drift / future use)
 */
interface ScrollState {
  activeSection: SectionId;
  activeRegion: number; // index into REGIONS, or -1
  progress: number;
  setSection: (s: SectionId) => void;
  setRegion: (r: number) => void;
  setProgress: (p: number) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  activeSection: "hero",
  activeRegion: -1,
  progress: 0,
  setSection: (s) => set((prev) => (prev.activeSection === s ? prev : { activeSection: s })),
  setRegion: (r) => set((prev) => (prev.activeRegion === r ? prev : { activeRegion: r })),
  setProgress: (p) => set({ progress: p }),
}));
