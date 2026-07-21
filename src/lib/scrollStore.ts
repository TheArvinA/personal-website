import { create } from "zustand";
import { ZONE_COUNT } from "@/lib/regions";

export type SectionId = "hero" | "about" | "work" | "contact";

/**
 * Shared state bridging the DOM scroll world and the R3F canvas.
 * - activeSection: which section is currently in view (drives head pose)
 * - zoneAlphas: continuous 0..1 glow intensity per highlight zone, one entry
 *   per ZONE (length ZONE_COUNT). This is the single glow channel read by the
 *   particle shader's per-zone alphas (via getState() in the frame loop). Its
 *   WRITER is the interaction director now (hover/idle), but the channel is
 *   unchanged.
 * - progress: 0..1 overall scroll progress (kept for any coarse consumers).
 * - rotationProgress: 0..1 progress that DRIVES the head's scroll rotation. Same
 *   as `progress` outside the Work section, but it FREEZES while Work is engaged
 *   and resumes from the same value on the far side — so the head's rotation
 *   pauses during Work (where the mouse steers it) and rejoins scroll seamlessly
 *   in either direction, with no catch-up spin (see WorkExplorer). Written by
 *   WorkExplorer (single writer); read by ParticleHead's pose loop.
 *
 * (`zoneAlphas` was a fixed 4-tuple; it is now a variable-length number[] so
 * the system scales to MAX_ZONES = 8 — see implementation plan §1.5, §3.3.)
 */
interface ScrollState {
  activeSection: SectionId;
  zoneAlphas: number[];
  progress: number;
  rotationProgress: number;
  setSection: (s: SectionId) => void;
  setZoneAlphas: (a: number[]) => void;
  setProgress: (p: number) => void;
  setRotationProgress: (p: number) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  activeSection: "hero",
  zoneAlphas: new Array(ZONE_COUNT).fill(0) as number[],
  progress: 0,
  rotationProgress: 0,
  setSection: (s) => set((prev) => (prev.activeSection === s ? prev : { activeSection: s })),
  // Shallow-equal guard (generalized to a loop): skip the update when nothing
  // changed to avoid needless renders of any store subscribers. ParticleHead
  // reads via getState(), so its frame loop is unaffected either way.
  setZoneAlphas: (a) =>
    set((prev) => {
      const p = prev.zoneAlphas;
      if (p.length === a.length) {
        let same = true;
        for (let i = 0; i < a.length; i++) {
          if (p[i] !== a[i]) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return { zoneAlphas: a };
    }),
  setProgress: (p) => set({ progress: p }),
  setRotationProgress: (p) =>
    set((prev) => (prev.rotationProgress === p ? prev : { rotationProgress: p })),
}));
