"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { useInteractionStore } from "@/lib/interactionStore";
import { useScrollStore } from "@/lib/scrollStore";
import { useInteractionDirector } from "@/hooks/useInteractionDirector";
import { ProjectPanel } from "@/components/sections/ProjectPanel";
import { OrbitTerms } from "@/components/sections/OrbitTerms";
import { ZONE_COUNT } from "@/lib/regions";
import {
  WORK_STAGE_VH,
  EXPLORE_ENGAGE_BAND_VH,
  EXPLORE_INERT_THRESHOLD,
  FACING_MIN,
} from "@/lib/interactionTuning";
import type { Project } from "@/lib/projectsData";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * WorkExplorer — the sticky "explore stage" that replaces the old pinned-scroll
 * projects section (implementation plan §5.1, ticket P1-1).
 *
 * Phase 1 scope = SKELETON + state wiring only:
 *  - Outer wrapper WORK_STAGE_VH tall; inner `sticky top-0 h-screen` stage that
 *    gives the user a dwell region while the head is centred.
 *  - The reused Work header (site `Reveal` entrance).
 *  - IntersectionObserver on the stage (threshold EXPLORE_VISIBILITY_THRESHOLD)
 *    → interactionStore.exploreTarget (1/0) and a local `engaged` flag.
 *  - A window-level `pointermove` listener registered ONLY while engaged
 *    (removed on disengage) that writes cursor px + an `inside` flag.
 *  - Publishes the stage rect into interactionStore (read by ParticleHead for
 *    the cursor→yaw mapping) on engage / scroll / resize.
 *  - Runs `useInteractionDirector` (hover hit-test → glow).
 *
 * No ProjectPanel / OrbitTerms yet (Phases 2/4). The `?debugzones` overlay is
 * present for P1-4/P1-5 verification and OFF unless the query flag is set.
 */
export function WorkExplorer({ projects }: { projects: Project[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [engaged, setEngaged] = useState(false);
  // Set on the client after mount so SSR and first client render agree (no
  // hydration mismatch when `?debugzones` is present).
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debugzones"));
  }, []);

  useInteractionDirector(engaged);

  // Publish the current stage rect into interactionStore (non-reactive mutate)
  // and mirror it locally for the pointermove inside-test. Stable (refs + store
  // getState only) so it can sit in effect deps without re-subscribing.
  const publishStageRect = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    rectRef.current = { x: r.left, y: r.top, w: r.width, h: r.height };
    const sr = useInteractionStore.getState().stageRect;
    sr.x = r.left;
    sr.y = r.top;
    sr.w = r.width;
    sr.h = r.height;
  }, []);

  // Scroll-scrubbed engage: derive a CONTINUOUS 0..1 explore weight from the
  // Work wrapper's position, so the head's turn-to-face-you handoff is locked
  // to scroll (seamless + reversible) instead of a binary flip + self-clocked
  // ease that fought the user's scrolling. The head scrubs to the explore pose
  // over EXPLORE_ENGAGE_BAND_VH of approach, holds while pinned, and scrubs back
  // over the same band on exit. Reaches EXACTLY 0/1 at the ends so ParticleHead's
  // byte-identical off-explore path stays reachable.
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;

    const compute = () => {
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const band = EXPLORE_ENGAGE_BAND_VH * vh;
      let target: number;
      if (rect.top > 0) {
        // Approaching: wrapper top from `band` down to 0 → weight 0 → 1.
        target = clamp01(1 - rect.top / band);
      } else if (rect.bottom < vh) {
        // Leaving: wrapper bottom from vh down to vh-band → weight 1 → 0.
        target = clamp01((rect.bottom - (vh - band)) / band);
      } else {
        // Fully pinned.
        target = 1;
      }
      useInteractionStore.getState().setExploreTarget(target);
      setEngaged(target > EXPLORE_INERT_THRESHOLD);

      // Head-rotation progress that FREEZES across the Work section, so the
      // scroll-driven head rotation pauses while Work is engaged and resumes
      // from the SAME angle on the far side — no catch-up spin on entry or exit,
      // in either direction. The frozen span is exactly the range where explore
      // has influence: [wrapperTop - band, wrapperTop + H - vh + band]. Denom is
      // the raw scrollable height, so hero/about/contact keep their rotation rate
      // (the head simply holds through Work, then continues from the handoff).
      const scrollY = window.scrollY || 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
      const wrapperTop = rect.top + scrollY; // absolute document position
      const freezeStart = wrapperTop - band;
      const freezeEnd = wrapperTop + rect.height - vh + band;
      const frozenSpan = Math.max(0, freezeEnd - freezeStart);
      let eff: number;
      if (scrollY <= freezeStart) eff = scrollY;
      else if (scrollY >= freezeEnd) eff = scrollY - frozenSpan;
      else eff = freezeStart;
      useScrollStore.getState().setRotationProgress(clamp01(eff / maxScroll));
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
      useInteractionStore.getState().setExploreTarget(0);
    };
  }, []);

  // Pointer + rect listeners live ONLY while engaged (no leaks off-explore).
  useEffect(() => {
    if (!engaged) return;
    const setCursor = useInteractionStore.getState().setCursor;

    publishStageRect();

    const onPointerMove = (e: PointerEvent) => {
      const r = rectRef.current;
      const inside =
        e.clientX >= r.x &&
        e.clientX <= r.x + r.w &&
        e.clientY >= r.y &&
        e.clientY <= r.y + r.h;
      setCursor(e.clientX, e.clientY, inside);
    };
    const onScrollOrResize = () => publishStageRect();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      // Mark cursor outside so the head eases back to the explore pose.
      const c = useInteractionStore.getState().cursor;
      setCursor(c.x, c.y, false);
    };
  }, [engaged, publishStageRect]);

  return (
    <section
      id="work"
      className="relative border-t border-white/5"
      data-project-count={projects.length}
    >
      {/* Header beat (reused markup, site Reveal entrance). */}
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 pt-32 md:pt-40">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <Reveal>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mute">
              <span className="text-dim">[ 003 ]</span>
              <span className="h-px w-12 bg-mute/40" />
              <span>Selected Work</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-5xl md:text-7xl font-light leading-[0.95] tracking-[-0.03em]">
              Projects &{" "}
              <span className="font-serif italic text-turquoise">
                case studies
              </span>
            </h2>
          </Reveal>
        </div>
      </div>

      {/* Explore stage: WORK_STAGE_VH-tall wrapper, sticky 100vh pinned stage. */}
      <div
        ref={wrapperRef}
        className="relative mt-20 md:mt-28"
        style={{ height: `${WORK_STAGE_VH}vh` }}
      >
        <div
          ref={stageRef}
          className="sticky top-0 h-screen w-full overflow-hidden"
        >
          {/* Bottom-edge hint line (copy TBD by Arvin — placeholder). */}
          <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
              Move your cursor — the head responds
            </span>
          </div>

          {/* Orbit terms (§5.4) — stack labels ringing the active/idle-cued zone.
              Sits BEHIND the panel (z-20 < panel z-30) and never blocks the
              cursor (pointer-events-none). */}
          <OrbitTerms projects={projects} />

          {/* Side panel (§5.2) — shows the active zone's project, opposite side. */}
          <ProjectPanel projects={projects} />

          {debug && <ZoneDebugOverlay />}
        </div>
      </div>
    </section>
  );
}

/**
 * TEMPORARY debug overlay (P1-4/P1-5), gated on `?debugzones`. Runs its own rAF,
 * reads `interactionStore.zoneScreen` each frame, and draws a dot + facing
 * readout at every projected zone centre. Dimmed when a zone is back-facing.
 */
function ZoneDebugOverlay() {
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const zs = useInteractionStore.getState().zoneScreen;
      const stage = useInteractionStore.getState().stageRect;
      for (let i = 0; i < ZONE_COUNT; i++) {
        const el = dotRefs.current[i];
        if (!el) continue;
        const z = zs[i];
        // zoneScreen is in viewport px; the overlay is inside the stage, so
        // subtract the stage origin to place it correctly.
        const lx = z.x - stage.x;
        const ly = z.y - stage.y;
        const front = z.facing >= FACING_MIN;
        el.style.transform = `translate(${lx}px, ${ly}px)`;
        el.style.opacity = front ? "1" : "0.25";
        const label = el.firstElementChild as HTMLElement | null;
        if (label) label.textContent = `z${i} f=${z.facing.toFixed(2)}`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {Array.from({ length: ZONE_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            dotRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-turquoise"
          style={{ willChange: "transform, opacity" }}
        >
          <span className="absolute left-4 top-0 whitespace-nowrap font-mono text-[10px] text-turquoise" />
        </div>
      ))}
    </div>
  );
}
