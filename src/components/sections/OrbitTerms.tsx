"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInteractionStore } from "@/lib/interactionStore";
import { useScrollStore } from "@/lib/scrollStore";
import type { Project } from "@/lib/projectsData";
import {
  ORBIT_SPEED,
  ORBIT_ANGLE_JITTER,
  ORBIT_RADIUS_JITTER,
  ORBIT_FLOAT_AMP,
  ORBIT_FLOAT_FREQ_MIN,
  ORBIT_FLOAT_FREQ_RANGE,
  ORBIT_TERM_MAX,
  ORBIT_RING_RADIUS_FACTOR,
  ORBIT_RING_RADIUS_MIN,
  ORBIT_RING_RADIUS_MAX,
  ORBIT_TERM_BASE_OPACITY,
  ORBIT_TERM_ALPHA_BOOST,
  ORBIT_MAX_DT,
  REPEL_RADIUS,
  REPEL_MAX_DISP,
  REPEL_STIFFNESS,
  REPEL_DAMPING,
} from "@/lib/interactionTuning";

const TWO_PI = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** Deterministic per-label pseudo-random in [0,1) — stable scatter without RNG. */
const hash = (i: number, seed: number) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * OrbitTerms — the ring of stack labels that circle the ACTIVE (or idle-cued)
 * zone (implementation plan §5.4, ticket P4-1). Locked decision: terms appear
 * for the single active/idle-cued zone ONLY, never all zones at once.
 *
 * Mirrors the ZoneDebugOverlay pattern in WorkExplorer: subscribes reactively
 * ONLY to `activeZone` (so it re-renders just to swap the label set — infrequent),
 * then runs its OWN rAF that reads the non-reactive per-frame scratch
 * (`zoneScreen`, `stageRect`, `cursor`) plus the live `zoneAlphas` glow via
 * getState() and writes `el.style.transform` / `opacity` straight to refs. No
 * per-frame React state, zero allocations in the loop (all spring/scratch arrays
 * are preallocated to ORBIT_TERM_MAX).
 *
 * Per label each frame:
 *  - scattered base: anchor + r·(cosθ, sinθ) with an UNEVEN per-label angle
 *    jitter (ORBIT_ANGLE_JITTER) and varied radius (ORBIT_RADIUS_JITTER), a very
 *    slow global drift (ORBIT_SPEED), plus a gentle independent 2D float — so the
 *    labels hover irregularly rather than sit on a spinning ring.
 *  - repulsion (the dominant motion): if the cursor is within REPEL_RADIUS the
 *    label is pushed outward
 *    (stronger when closer, capped at REPEL_MAX_DISP); the ACTUAL displacement is
 *    sprung toward that desired value with a critically-damped spring.
 *  - opacity: base·zoneAlphas[activeZone] so terms fade in/out WITH the zone glow
 *    (≈1 on hover, ≈0.55 during idle, 0 when the zone is dark / back-facing).
 */
export function OrbitTerms({ projects }: { projects: Project[] }) {
  const activeZone = useInteractionStore((s) => s.activeZone);

  const project =
    activeZone >= 0
      ? projects.find((p) => p.zone === activeZone)
      : undefined;

  const labels = useMemo(
    () => (project ? project.stack.slice(0, ORBIT_TERM_MAX) : []),
    [project]
  );

  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // Preallocated per-label spring state (displacement + velocity) and bob phase.
  // Sized to ORBIT_TERM_MAX once so the frame loop never allocates.
  const spring = useRef({
    dx: new Float32Array(ORBIT_TERM_MAX),
    dy: new Float32Array(ORBIT_TERM_MAX),
    vx: new Float32Array(ORBIT_TERM_MAX),
    vy: new Float32Array(ORBIT_TERM_MAX),
    // Deterministic per-label scatter + independent float parameters.
    angOff: new Float32Array(ORBIT_TERM_MAX), // angle jitter off the even slot
    radScale: new Float32Array(ORBIT_TERM_MAX), // radius multiplier
    fFreqX: new Float32Array(ORBIT_TERM_MAX), // float freqs / phases
    fFreqY: new Float32Array(ORBIT_TERM_MAX),
    fPhaseX: new Float32Array(ORBIT_TERM_MAX),
    fPhaseY: new Float32Array(ORBIT_TERM_MAX),
  });

  const n = labels.length;

  useEffect(() => {
    if (activeZone < 0 || n === 0) return;

    const s = spring.current;
    // Reset spring state + (re)seed the deterministic scatter/float params so a
    // new label set starts clean but still looks irregular (uneven angle +
    // radius, independent gentle drift).
    for (let i = 0; i < ORBIT_TERM_MAX; i++) {
      s.dx[i] = 0;
      s.dy[i] = 0;
      s.vx[i] = 0;
      s.vy[i] = 0;
      s.angOff[i] = (hash(i, 1) - 0.5) * 2 * ORBIT_ANGLE_JITTER;
      s.radScale[i] = 1 - ORBIT_RADIUS_JITTER / 2 + hash(i, 2) * ORBIT_RADIUS_JITTER;
      s.fFreqX[i] = ORBIT_FLOAT_FREQ_MIN + hash(i, 3) * ORBIT_FLOAT_FREQ_RANGE;
      s.fFreqY[i] = ORBIT_FLOAT_FREQ_MIN + hash(i, 4) * ORBIT_FLOAT_FREQ_RANGE;
      s.fPhaseX[i] = hash(i, 5) * TWO_PI;
      s.fPhaseY[i] = hash(i, 6) * TWO_PI;
    }

    const getInteraction = useInteractionStore.getState;
    const getScroll = useScrollStore.getState;

    let raf = 0;
    const start = performance.now();
    let last = start;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      let dt = (now - last) / 1000;
      last = now;
      if (dt > ORBIT_MAX_DT) dt = ORBIT_MAX_DT;
      const t = (now - start) / 1000;

      const is = getInteraction();
      const zs = is.zoneScreen[activeZone];
      const stage = is.stageRect;
      const cursor = is.cursor;
      const alpha = getScroll().zoneAlphas[activeZone] ?? 0;

      // Ring anchor + cursor in STAGE-local px (subtract stage origin, matching
      // ZoneDebugOverlay).
      const ax = zs.x - stage.x;
      const ay = zs.y - stage.y;
      const curX = cursor.x - stage.x;
      const curY = cursor.y - stage.y;

      const radius = clamp(
        zs.rEdgePx * ORBIT_RING_RADIUS_FACTOR,
        ORBIT_RING_RADIUS_MIN,
        ORBIT_RING_RADIUS_MAX
      );
      const opacity =
        clamp(alpha * ORBIT_TERM_ALPHA_BOOST, 0, 1) * ORBIT_TERM_BASE_OPACITY;

      for (let i = 0; i < n; i++) {
        const el = spanRefs.current[i];
        if (!el) continue;

        // Scattered base position: even slot + per-label angle jitter + a very
        // slow global drift, at a per-label varied radius. Then a gentle
        // independent 2D float so they hover in place (repulsion does the rest).
        const theta = i * (TWO_PI / n) + s.angOff[i] + ORBIT_SPEED * t;
        const r = radius * s.radScale[i];
        const floatX = Math.sin(t * s.fFreqX[i] + s.fPhaseX[i]) * ORBIT_FLOAT_AMP;
        const floatY = Math.cos(t * s.fFreqY[i] + s.fPhaseY[i]) * ORBIT_FLOAT_AMP;
        const baseX = ax + r * Math.cos(theta) + floatX;
        const baseY = ay + r * Math.sin(theta) + floatY;

        // Desired outward repulsion from the cursor (0 outside REPEL_RADIUS).
        let desX = 0;
        let desY = 0;
        if (cursor.inside) {
          const toX = baseX - curX;
          const toY = baseY - curY;
          const dist = Math.sqrt(toX * toX + toY * toY);
          if (dist < REPEL_RADIUS && dist > 1e-4) {
            const prox = 1 - dist / REPEL_RADIUS; // 1 at cursor → 0 at radius
            const mag = prox * REPEL_MAX_DISP;
            const inv = 1 / dist;
            desX = toX * inv * mag;
            desY = toY * inv * mag;
          }
        }

        // Critically-damped spring toward the desired displacement.
        s.vx[i] +=
          (REPEL_STIFFNESS * (desX - s.dx[i]) - REPEL_DAMPING * s.vx[i]) * dt;
        s.vy[i] +=
          (REPEL_STIFFNESS * (desY - s.dy[i]) - REPEL_DAMPING * s.vy[i]) * dt;
        s.dx[i] += s.vx[i] * dt;
        s.dy[i] += s.vy[i] * dt;

        const x = baseX + s.dx[i];
        const y = baseY + s.dy[i];
        // translate(-50%, -50%) centres each chip on its ring point.
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        el.style.opacity = opacity.toFixed(3);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Re-run (and reset spring state) whenever the active zone or label count
    // changes — i.e. whenever a new label set is shown.
  }, [activeZone, n]);

  if (!project || n === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {labels.map((term, i) => (
        <span
          key={`${activeZone}-${i}-${term}`}
          ref={(el) => {
            spanRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 whitespace-nowrap rounded-pill border border-white/15 bg-onyx-deep/85 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-smoke backdrop-blur-sm"
          style={{ willChange: "transform, opacity", opacity: 0 }}
        >
          {term}
        </span>
      ))}
    </div>
  );
}
