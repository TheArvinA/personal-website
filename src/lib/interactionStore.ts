import { create } from "zustand";
import { ZONE_COUNT } from "@/lib/regions";

/**
 * Interaction state for the explore stage (implementation plan §3.3).
 *
 * Kept separate from `scrollStore` so hero/about/contact are untouched.
 * `scrollStore.zoneAlphas` remains the single glow channel into the shader;
 * only its *writer* moves here (the director) — this store never touches it.
 *
 * Two tiers of state live here:
 *  1. REACTIVE fields (exploreTarget, cursor, activeZone, activeSource) with
 *     shallow-equal-guarded setters — React components may subscribe to these.
 *  2. NON-REACTIVE, mutated-in-place scratch (zoneScreen, stageRect,
 *     exploreWeight). These are written every frame and read via getState();
 *     using React state for them would mean 60fps re-renders. They are declared
 *     on the store object but are NEVER passed through `set()` — mutate the
 *     object/array contents (or reassign the primitive) directly. Preallocated
 *     to ZONE_COUNT so the per-frame loops allocate nothing.
 */

export type ExploreMode = "scroll" | "explore";
export type ActiveSource = "none" | "hover" | "tap" | "idle";

export interface ZoneScreen {
  x: number; // projected screen-x (viewport px, == canvas px)
  y: number; // projected screen-y
  rEdgePx: number; // projected ZONE_EDGE_RADIUS at the zone's depth (px)
  facing: number; // view-space z of the zone normal; > FACING_MIN = front-facing
}

export interface StageRect {
  x: number; // left (viewport px)
  y: number; // top
  w: number; // width
  h: number; // height
}

interface InteractionState {
  // --- reactive ---
  /**
   * Continuous 0..1 explore engagement, driven by the Work section's scroll
   * position (WorkExplorer). 0 = fully scroll-driven pose; 1 = fully centred
   * explore pose. Intermediate values scrub the head's turn-to-face-you handoff
   * so it is locked to scroll and reversible (no self-clocked ease that would
   * fight the user's scrolling). Reaches EXACTLY 0 outside the engage band so
   * ParticleHead's byte-identical off-explore path stays reachable.
   */
  exploreTarget: number;
  cursor: { x: number; y: number; inside: boolean }; // viewport px; inside = over stage
  activeZone: number; // -1 = none
  activeSource: ActiveSource;
  /** True while the cursor is over the project panel. Freezes head steering and
   *  latches the active zone so the user can travel to the panel and click it
   *  without the head rotating away to another zone. */
  hoverLock: boolean;
  /** True while the idle turntable is running (director-owned, Phase 3). Read by
   *  ParticleHead to (a) add the gentle auto-yaw and (b) NOT freeze steering even
   *  though `activeZone` is set to the front-most idle zone. Any real input clears
   *  it, handing steering straight back to the user with no snap. */
  idleActive: boolean;
  setExploreTarget: (v: number) => void;
  setCursor: (x: number, y: number, inside: boolean) => void;
  setActive: (zone: number, source: ActiveSource) => void;
  setHoverLock: (v: boolean) => void;
  setIdleActive: (v: boolean) => void;

  // --- non-reactive scratch (mutate in place, read via getState()) ---
  /** Written by the ZoneProjector (R3F useFrame), read by the director + orbit terms. */
  zoneScreen: ZoneScreen[];
  /** Stage bounding rect, published by WorkExplorer; read for cursor→yaw mapping. */
  stageRect: StageRect;
  /** Current blended explore weight, written by ParticleHead each frame; the
   *  director reads it to gate glow (no glow while exploreWeight is tiny). */
  exploreWeight: number;
}

function makeZoneScreen(): ZoneScreen[] {
  return Array.from({ length: ZONE_COUNT }, () => ({
    x: 0,
    y: 0,
    rEdgePx: 0,
    facing: 0,
  }));
}

export const useInteractionStore = create<InteractionState>((set) => ({
  exploreTarget: 0,
  cursor: { x: 0, y: 0, inside: false },
  activeZone: -1,
  activeSource: "none",
  hoverLock: false,
  idleActive: false,

  setExploreTarget: (v: number) =>
    set((prev) => (prev.exploreTarget === v ? prev : { exploreTarget: v })),

  setCursor: (x, y, inside) =>
    set((prev) => {
      const c = prev.cursor;
      if (c.x === x && c.y === y && c.inside === inside) return prev;
      return { cursor: { x, y, inside } };
    }),

  setActive: (zone, source) =>
    set((prev) =>
      prev.activeZone === zone && prev.activeSource === source
        ? prev
        : { activeZone: zone, activeSource: source }
    ),

  setHoverLock: (v) =>
    set((prev) => (prev.hoverLock === v ? prev : { hoverLock: v })),

  setIdleActive: (v) =>
    set((prev) => (prev.idleActive === v ? prev : { idleActive: v })),

  // Non-reactive scratch — never written through set().
  zoneScreen: makeZoneScreen(),
  stageRect: { x: 0, y: 0, w: 0, h: 0 },
  exploreWeight: 0,
}));
