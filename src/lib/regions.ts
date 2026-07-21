import * as THREE from "three";

/**
 * Density-highlight zones on the particle head, expressed in the head's
 * LOCAL (post-center/scale) space — the same coordinates the shader sees.
 *
 * Scan orientation in this frame:
 *   front / nose = -X, up = +Y, rear = +X, ears at ±Z, subject-LEFT = +Z.
 *   bbox: X∈[-0.79,0.79], Y∈[-0.9,0.9], Z∈[-0.67,0.67].
 *
 * A zone is a soft, roughly-circular patch on the head surface. Extra
 * particles are kept near a zone with a smooth radial falloff so borders
 * feather out (no hard edges). The zone "pops" purely by getting denser —
 * highlighted particles are visually identical to the base ones.
 *
 * Zone order (index) matches the numbering in the design spec:
 *   0 -> "zone 1": just behind/above the LEFT  ear
 *   1 -> "zone 2": crown, left side
 *   2 -> "zone 3": crown, right side
 *   3 -> "zone 4": just behind/above the RIGHT ear  (built but dormant)
 */



// Zones now SURROUND the head at roughly temple/ear height, spaced ~90° apart
// around the vertical (Y) axis, so the explore-mode steering can rotate any of
// them to the front. Scan frame: front/nose = -X, rear = +X, subject-LEFT = +Z,
// subject-RIGHT = -Z, up = +Y. bbox X∈[-0.79,0.79], Y∈[-0.9,0.9], Z∈[-0.67,0.67].
const ZONE_RING_Y = 0.32; // height of the ring (temple/ear level)
const ZONE_RING_R = 0.62; // radius from the vertical axis
export const ZONES: THREE.Vector3[] = [
  new THREE.Vector3(-ZONE_RING_R, ZONE_RING_Y, 0), // 0: FRONT (forehead/face)
  new THREE.Vector3(0, ZONE_RING_Y, -ZONE_RING_R), // 1: RIGHT temple/ear
  new THREE.Vector3(ZONE_RING_R, ZONE_RING_Y, 0), // 2: BACK of head
  new THREE.Vector3(0, ZONE_RING_Y, ZONE_RING_R), // 3: LEFT temple/ear
];


/** Number of zones — kept in sync with the shader's per-zone alpha vec4. */
export const ZONE_COUNT = ZONES.length;

/**
 * Radial keep-probability falloff for extra particles, in world units.
 * Inside CORE the patch is at full extra density (drives the ~3x pop);
 * between CORE and EDGE the keep-probability feathers smoothly to 0.
 */
export const ZONE_CORE_RADIUS = 0.3;
export const ZONE_EDGE_RADIUS = 0.55;

/** Smoothstep (GLSL semantics) for the feathered zone border. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * For a surface point, find the nearest zone and its keep-probability.
 * Returns { zone: -1, prob: 0 } when the point is outside every zone.
 */
export function zoneKeep(p: THREE.Vector3): { zone: number; prob: number } {
  let bestZone = -1;
  let bestProb = 0;
  for (let i = 0; i < ZONES.length; i++) {
    const d = p.distanceTo(ZONES[i]);
    // 1 inside CORE, feathering to 0 by EDGE.
    const prob = 1 - smoothstep(ZONE_CORE_RADIUS, ZONE_EDGE_RADIUS, d);
    if (prob > bestProb) {
      bestProb = prob;
      bestZone = i;
    }
  }
  return { zone: bestZone, prob: bestProb };
}

/**
 * Project (card index) -> zone index. Drives which patch densifies when a
 * project card crosses the viewport center. Zone 3 ("zone 4") is reserved
 * for a future project — add "04": 3 here when it ships.
 */
export const PROJECT_ZONE: Record<string, number> = {
  "01": 0, // Volleyball Tracker -> zone 1 (behind/above left ear)
  "02": 1, // Smart Parking     -> zone 2 (crown, left)
  "03": 2, // Facial Merging    -> zone 3 (crown, right)
  "04": 3, // Next Project      -> zone 4 (behind/above right ear)
};
