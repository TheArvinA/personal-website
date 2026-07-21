"use client";

import { useEffect } from "react";
import { useScrollStore } from "@/lib/scrollStore";
import { useInteractionStore } from "@/lib/interactionStore";
import { ZONE_COUNT } from "@/lib/regions";
import {
  EXPLORE_INERT_THRESHOLD,
  FACING_MIN,
  HIT_THRESHOLD,
  HIT_INNER_FACTOR,
  STEER_LOCK_GRACE_MS,
  ZONE_SWITCH_DWELL_MS,
  IDLE_DELAY,
  IDLE_DELAY_POST_GRACE,
  IDLE_ALPHA,
  IDLE_FACING_FULL,
  IDLE_CURSOR_MOVE_EPS,
} from "@/lib/interactionTuning";

/** GLSL-style smoothstep. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * useInteractionDirector (v1 — plan P1-5).
 *
 * A DOM-side requestAnimationFrame loop (NOT R3F useFrame — it runs here in the
 * WorkExplorer tree). Each frame it reads the cursor + the per-zone screen
 * projection (`interactionStore.zoneScreen`, written by the R3F ZoneProjector),
 * runs the hover hit-test (§4.3), and writes hover-only alpha TARGETS into
 * `scrollStore.zoneAlphas` (the single glow channel; the shader's ZONE_SMOOTH_TAU
 * is the only easing on top). It also publishes activeZone/activeSource.
 *
 * Phase 3 (P3-1) adds the idle TURNTABLE on top of this same resolve. The
 * design supersedes the plan's held-pose cycle (§4.3): instead of holding the
 * front pose and cueing zones in place, after inactivity the head slowly
 * auto-rotates (ParticleHead reads `idleActive` and adds IDLE_SPIN_RATE to the
 * shared steerYaw accumulator) and each zone glows as it passes the front. The
 * director owns the whole decision: it runs the hover/latch/dwell/grace resolve
 * FIRST (unchanged), and only if that yields no focus (and no hoverLock) and the
 * idle timer has elapsed does it switch into IDLE_ACTIVE for that frame. Any
 * input — cursor movement, a hover hit, or panel hover — resets the timer, so
 * the very next frame falls back to the hover path and idle stops with no snap
 * and no glow flash (the shader's ZONE_SMOOTH_TAU eases the alphas down).
 *
 * State machine: IDLE_WAIT (timer running, hover path live) → IDLE_ACTIVE
 * (turntable) ↔ back to the hover/focus path. The idle delay is IDLE_DELAY
 * normally, shortened to IDLE_DELAY_POST_GRACE right after a focus was released.
 *
 * Gating: glow is force-zeroed whenever exploreWeight < EXPLORE_INERT_THRESHOLD
 * (read from interactionStore, written by ParticleHead each frame). This is why
 * nothing ever glows outside explore mode, and why scrolling past Work never
 * flashes.
 *
 * Lifecycle: the rAF runs only while `engaged`. On disengage (or unmount) the
 * loop is cancelled AND a final zero pass + activeZone reset is written, so no
 * glow or hover state leaks past the explore session.
 */
export function useInteractionDirector(engaged: boolean): void {
  useEffect(() => {
    const setZoneAlphas = useScrollStore.getState().setZoneAlphas;
    const setActive = useInteractionStore.getState().setActive;
    const setIdleActive = useInteractionStore.getState().setIdleActive;

    // Reusable target buffer for the shallow-equal-guarded store write.
    const zeros = () => new Array(ZONE_COUNT).fill(0) as number[];

    const clearGlow = () => {
      setZoneAlphas(zeros());
      setActive(-1, "none");
      setIdleActive(false);
    };

    if (!engaged) {
      // Not in explore: make sure nothing is left glowing.
      clearGlow();
      return;
    }

    // Latch state (persists across frames):
    //  latched      — the zone currently "held" (focused).
    //  lostAt       — when the cursor entered EMPTY space (neutral) while a zone
    //                 was latched, for the travel-through-gap grace window.
    //  candidate/-Since — a DIFFERENT zone the cursor is currently over and how
    //                 long it has dwelled there, so a graze doesn't switch focus.
    let latched = -1;
    let lostAt = 0;
    let candidate = -1;
    let candidateSince = 0;

    // Idle turntable state (persists across frames):
    //  lastInputAt        — timestamp of the last "activity" (focus held, panel
    //                       hover, or cursor movement). The idle timer counts
    //                       from here.
    //  lastActiveWasFocus — whether that last activity was a real focus (vs. a
    //                       bare cursor move). Selects the shortened post-grace
    //                       delay once a focus is released.
    //  prevCursorX/Y      — last frame's cursor px, to detect movement.
    const now0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    let lastInputAt = now0;
    let lastActiveWasFocus = false;
    const c0 = useInteractionStore.getState().cursor;
    let prevCursorX = c0.x;
    let prevCursorY = c0.y;

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);

      const interaction = useInteractionStore.getState();
      const { cursor, zoneScreen, exploreWeight, hoverLock } = interaction;

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      // Cursor movement since last frame (idle reset / seamless exit trigger).
      const moved =
        Math.abs(cursor.x - prevCursorX) > IDLE_CURSOR_MOVE_EPS ||
        Math.abs(cursor.y - prevCursorY) > IDLE_CURSOR_MOVE_EPS;
      prevCursorX = cursor.x;
      prevCursorY = cursor.y;

      // Inert while the pose handoff is still ramping (no glow flashes).
      if (exploreWeight < EXPLORE_INERT_THRESHOLD) {
        latched = -1;
        lostAt = 0;
        candidate = -1;
        candidateSince = 0;
        lastInputAt = now;
        lastActiveWasFocus = false;
        setZoneAlphas(zeros());
        setActive(-1, "none");
        setIdleActive(false);
        return;
      }

      // Hover hit-test — argmax score over front-facing zones.
      let bestZone = -1;
      let bestScore = HIT_THRESHOLD; // must exceed the floor to activate
      if (cursor.inside) {
        for (let i = 0; i < ZONE_COUNT; i++) {
          const zs = zoneScreen[i];
          if (zs.facing < FACING_MIN) continue; // back-facing → un-hoverable
          const dx = cursor.x - zs.x;
          const dy = cursor.y - zs.y;
          const dist = Math.hypot(dx, dy);
          const score = 1 - smoothstep(HIT_INNER_FACTOR * zs.rEdgePx, zs.rEdgePx, dist);
          if (score >= bestScore) {
            bestScore = score;
            bestZone = i;
          }
        }
      }

      // Resolve the ACTIVE zone. Goal: once a zone is focused, moving to its
      // panel must not flip focus to a neighbour zone the cursor merely grazes.
      //  - No zone latched yet → the hovered zone activates immediately.
      //  - Zone latched, cursor over the panel (hoverLock) → hold it.
      //  - Zone latched, cursor back on it → hold it.
      //  - Zone latched, cursor over a DIFFERENT zone → only switch if the
      //    cursor DWELLS there ZONE_SWITCH_DWELL_MS (a graze is ignored).
      //  - Zone latched, cursor over empty space → hold for STEER_LOCK_GRACE_MS
      //    (bridge the gap to the panel), then release.
      let active: number;

      if (latched < 0) {
        // Nothing focused yet — first hover activates instantly.
        active = bestZone;
        latched = bestZone;
        lostAt = 0;
        candidate = -1;
      } else if (hoverLock || bestZone === latched) {
        // Over the panel, or back on the focused zone → hold.
        active = latched;
        lostAt = 0;
        candidate = -1;
      } else if (bestZone >= 0) {
        // Over a DIFFERENT zone — switch only after a deliberate dwell.
        if (bestZone !== candidate) {
          candidate = bestZone;
          candidateSince = now;
        }
        if (now - candidateSince >= ZONE_SWITCH_DWELL_MS) {
          latched = bestZone;
          candidate = -1;
          active = bestZone;
        } else {
          active = latched; // graze — keep the focused zone
        }
        lostAt = 0;
      } else {
        // Empty space — grace-hold, then release.
        candidate = -1;
        if (lostAt === 0) lostAt = now;
        if (now - lostAt < STEER_LOCK_GRACE_MS) {
          active = latched;
        } else {
          active = -1;
          latched = -1;
          lostAt = 0;
        }
      }

      // --- Idle turntable resolve (layered on top of the hover path) ---------
      // The hover/latch/dwell/grace resolve above is the "active interaction"
      // path and always wins. Idle only takes the frame when there is NO focus
      // and NO panel hover and the idle timer has elapsed.
      const focusHeld = active >= 0;

      // Any activity resets the idle timer. A held focus (or panel hover) also
      // marks the timer so that once it releases we use the shortened post-grace
      // delay; a bare cursor move does not (full IDLE_DELAY from a cold cursor).
      if (focusHeld || hoverLock) {
        lastInputAt = now;
        lastActiveWasFocus = true;
      } else if (moved) {
        lastInputAt = now;
        lastActiveWasFocus = false;
      }

      const idleDelayMs =
        (lastActiveWasFocus ? IDLE_DELAY_POST_GRACE : IDLE_DELAY) * 1000;
      const idleEligible = !focusHeld && !hoverLock;
      const idleActive = idleEligible && now - lastInputAt >= idleDelayMs;

      if (idleActive) {
        // Turntable: each zone's glow follows its facing so the front-most
        // zone(s) glow and dim as the head auto-rotates past them. Publish the
        // front-most zone (highest facing) as activeZone/"idle" for Phase 4 —
        // the panel ignores the "idle" source, so it stays closed.
        const targets = zeros();
        let frontZone = -1;
        let frontFacing = FACING_MIN;
        for (let i = 0; i < ZONE_COUNT; i++) {
          const facing = zoneScreen[i].facing;
          targets[i] = IDLE_ALPHA * smoothstep(FACING_MIN, IDLE_FACING_FULL, facing);
          if (facing > frontFacing) {
            frontFacing = facing;
            frontZone = i;
          }
        }
        setZoneAlphas(targets);
        setActive(frontZone, "idle");
        setIdleActive(true);
        return;
      }

      // Active-interaction (hover) path — unchanged glow semantics.
      const targets = zeros();
      if (active >= 0) targets[active] = 1;
      setZoneAlphas(targets);
      setActive(active, active >= 0 ? "hover" : "none");
      setIdleActive(false);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearGlow();
    };
  }, [engaged]);
}
