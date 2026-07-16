import * as THREE from "three";

/**
 * Approximate brain-region anchor points in the head's LOCAL space
 * (unit-ish ellipsoid centered at origin, facing +Z).
 * These are placeholders tuned to the procedural ellipsoid head; once the
 * real Polycam head.glb is in, re-measure these in Blender (ticket T0.2).
 *
 * Order defines the region index used by activeRegion in the store.
 */
export const REGIONS: { name: string; pos: THREE.Vector3 }[] = [
  { name: "prefrontal", pos: new THREE.Vector3(0.0, 0.18, 0.72) }, // front-upper
  { name: "fusiform", pos: new THREE.Vector3(0.42, -0.42, 0.28) }, // under-temporal (side)
  { name: "visualCortex", pos: new THREE.Vector3(0.0, -0.12, -0.8) }, // rear-lower
  { name: "parietal", pos: new THREE.Vector3(0.0, 0.7, -0.25) }, // top-rear
];

/** Project slug -> region index. Wired up fully in Milestone B. */
export const PROJECT_REGION: Record<string, number> = {
  volleyball: 2, // visual cortex (+ cerebellum feel)
  facial: 1, // fusiform face area
  parking: 0, // prefrontal / executive
};

/** Nearest region index for an arbitrary surface point. */
export function nearestRegion(p: THREE.Vector3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < REGIONS.length; i++) {
    const d = p.distanceToSquared(REGIONS[i].pos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
