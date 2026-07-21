# Interactive Head Explorer — Implementation Plan

**Version:** 1.0 · **Date:** 2026-07-19 · **Author:** PM (Fable) · **Source spec:** `docs/interactive-head-outline.md`
**Audience:** Opus/Sonnet implementation agents. Each ticket is self-contained; read this whole document once before starting any ticket.

> **Repo-wide rule (from `AGENTS.md`):** this project runs Next.js 16.2.4, which differs from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next-specific code. Most work here is client components + Three.js, so exposure is low, but heed it.

---

## 0. Locked decisions (PM review with Arvin, 2026-07-19)

| Question | Decision |
|---|---|
| Work section scroll footprint | **Single pinned viewport.** Work becomes ~200vh total: a header beat + one sticky 100vh "explore stage." No forced scroll-through. |
| Mobile | **Head should be interactive on mobile.** No fixed spec yet — Phase 6 is an investigation spike with a perf gate, then implementation. Desktop ships first and must not be blocked by mobile. |
| Orbit terms visibility | **Active/idle-cued zone only.** Never all zones at once. |
| Panel placement | **Opposite side of the active zone** (zone projects on screen-left → panel on right, and vice versa), with the edge/hysteresis rules in §5.3. |

---

## 1. Corrections and improvements to the outline

These override or extend the outline where they conflict. Implementation agents follow **this** document.

1. **Global rotation coupling (missed by the outline).** `progress` in `scrollStore` is `window.scrollY / (scrollHeight - innerHeight)` (`useSectionObserver.ts`), and `ParticleHead` maps it to a full 360° yaw. Work currently owns ~480vh of a page whose total length sets the rotation pace. Shrinking Work to ~200vh shortens the page ~35%, which **speeds up the head's rotation everywhere** (hero, about, contact). This is not a Work-local change. Ticket P1-4 owns retuning; the acceptance criteria include checking pacing in all non-Work sections.
2. **Pointer events cannot come from the canvas.** `HeadLayer` renders the canvas `fixed inset-0 -z-10 pointer-events-none` behind the whole DOM. Do **not** add pointer listeners to the canvas or flip its pointer-events. Cursor position is sampled with a window-level `pointermove` listener, active only while explore mode is engaged (§4.2). This also confirms the outline's §9 recommendation: **screen-space hit-testing (option b), not raycasting** — there is no pointer pipeline into R3F to raycast with anyway, and the zones are already soft radial patches.
3. **Back-facing zones (missed by the outline).** A pure screen-space distance check will "hover" zones on the far side of the head (e.g. right-ear zone hidden behind the skull when the head is turned). Every frame, each zone gets a **facing factor**: the zone's local position (head is origin-centered, so `normalize(zonePos)` approximates the outward surface normal) rotated by the head's current rotation; require its view-space z component `> FACING_MIN` (default 0.15) for the zone to be hoverable, and multiply the idle-cue alpha by facing so a cued zone never glows invisibly behind the head.
4. **New store, don't overload `scrollStore`.** Interaction state (cursor, active zone, mode, zone screen positions) lives in a new `interactionStore`. `scrollStore` keeps its current job (section, progress, zoneAlphas) so hero/about/contact are untouched. `zoneAlphas` remains the single glow-alpha channel into the shader — only its **writer** changes.
5. **Shader `vec4` cap → float array now, not later.** The outline defers N-zone support to a late phase, but Phase 1 already rewrites the alpha plumbing and touches the shader. Do the `uZoneAlpha: vec4` → `uniform float uZoneAlpha[MAX_ZONES]` conversion once, in Phase 1 (ticket P1-2), with `MAX_ZONES = 8`. Touching the shader twice is wasted work and re-testing.
6. **`ZoneObserver.tsx` is already dead.** Nothing imports it (`PinnedProjects` drives `zoneAlphas` directly). Same for `ProjectsHeader.tsx`. Delete both in Phase 0 after verifying zero imports.
7. **The header machinery dies with `PinnedProjects`.** `cardOpacity()`, `HEADER_LEAD_VH`, the header-lead timeline — all of it is scroll-choreography for the old model. The new Work header is a plain header using the site's existing `Reveal` pattern. Do not port the lead/fade timeline.
8. **`PROJECT_ZONE` record → data model field.** The string-keyed `Record<"01"…>` mapping is replaced by a `zone` field on each project (§6). `regions.ts` keeps geometry only.
9. **Explore pose is a tunable, not a TBD.** Default: front-facing (`yaw = ROT_OFFSET_Y`, i.e. the progress-0 pose), `EXPLORE_POSE_YAW_OFFSET = 0` as a named constant so a 3/4 angle is a one-line tune later. Head also recenters vertically (`position.y → 0`, pitch → `ROT_OFFSET_X`).
10. **Reuse the existing card markup.** The panel (§5.2) is a restyled composition of the existing `ProjectCard` content blocks (title pre/accent/post, tagline, description, 3 metrics, stack pills, status badge, year, index) — same fields, same type. Don't invent a new content schema.

---

## 2. Current-state reference (what exists today)

| File | Role | Fate |
|---|---|---|
| `src/components/three/ParticleHead.tsx` | Particle geometry (20k base + 165k pool filtered by `zoneKeep`), shader with `aZone`/`uZoneAlpha`, scroll-driven yaw/pitch/rise, entrance/shimmer | **Modified** (pose controller + shader array) |
| `src/lib/regions.ts` | 4 hardcoded zone `Vector3`s, `zoneKeep()` falloff, `PROJECT_ZONE` map | **Modified** (N-scalable layout, drop `PROJECT_ZONE`) |
| `src/lib/scrollStore.ts` | `activeSection`, `zoneAlphas: [n,n,n,n]`, `progress` | **Modified** (`zoneAlphas` → `number[]`) |
| `src/components/sections/PinnedProjects.tsx` | Pinned scroll cross-fade, header lead, `cardOpacity`, zone-alpha writer; exports `Project` type + `ProjectCard` markup | **Deleted** (type + card markup extracted first) |
| `src/components/sections/Projects.tsx` | `PROJECTS` data array + section shell | **Modified** (data model + new explorer) |
| `src/components/sections/ProjectsHeader.tsx` | Unused | **Deleted** |
| `src/components/three/ZoneObserver.tsx` | Unused (orphaned by PinnedProjects) | **Deleted** |
| `src/components/three/HeadLayer.tsx` | Mode decision: 3d vs fallback (<768px, reduced-motion, no WebGL) | **Modified** (Phase 6 mobile gate; reduced-motion path kept) |
| `src/components/three/HeadCanvas.tsx` | Thin `<Canvas>` wrapper | Mostly untouched |
| `src/hooks/useSectionObserver.ts` | Writes `activeSection` + `progress` | Untouched |
| `src/components/SmoothScroll.tsx` | Lenis | Untouched |

Existing conventions to reuse: framerate-independent lerp `k = Math.min(1, dt * N)`, exponential smoothing `1 - Math.exp(-dt/tau)` (`ZONE_SMOOTH_TAU` pattern), zustand `getState()` reads inside `useFrame` (no React re-render per frame), Tailwind v4 tokens (`text-turquoise`, `bg-card`, `rounded-pill`, `text-mute`, etc.), `Reveal` for section entrances.

---

## 3. Target architecture

### 3.1 Data flow (per frame)

```
DOM world                                 R3F world (useFrame in ParticleHead + helpers)
─────────                                 ──────────────────────────────────────────────
window pointermove ──► interactionStore.cursor (px)
scroll ──► scrollStore.progress / activeSection
WorkExplorer (sticky stage in view?) ──► interactionStore.exploreTarget (0|1)

                    ┌─ exploreWeight lerps toward exploreTarget (the scroll↔cursor blend)
useFrame ───────────┤
                    ├─ HeadPose: blend(scrollPose, cursorFollowPose, exploreWeight) → rotation/position
                    ├─ ZoneProjector: for each zone → screen px position + radius + facing
                    │     writes interactionStore.zoneScreen[]  (plain mutable array, not setState)
                    ├─ HoverResolver (in useInteractionDirector, DOM side, rAF):
                    │     cursor + zoneScreen + touch taps + idle-cycle state machine
                    │     → interactionStore.activeZone / activeSource
                    ├─ AlphaDirector: per-zone target alpha (hover=1, idleCue=0.55×facing, else 0)
                    │     → scrollStore.zoneAlphas  (same channel the shader already reads)
                    └─ shader: uZoneAlpha[i] smoothed exactly as today (ZONE_SMOOTH_TAU)

WorkExplorer (React) subscribes to activeZone → renders ProjectPanel + OrbitTerms
```

### 3.2 New files

| File | Contents |
|---|---|
| `src/lib/interactionStore.ts` | Zustand store, §4.1 |
| `src/lib/projectsData.ts` | `Project` type (extended, §6) + `PROJECTS` array, extracted so data is importable without component code |
| `src/components/sections/WorkExplorer.tsx` | Sticky explore stage: header, pointer/tap capture, idle-cycle director hook, renders panel + orbit terms |
| `src/components/sections/ProjectPanel.tsx` | The side panel (§5.2) |
| `src/components/sections/OrbitTerms.tsx` | Orbiting labels + repulsion (§5.4) |
| `src/hooks/useInteractionDirector.ts` | rAF loop on the DOM side: hover resolution, idle state machine, alpha targets (§4.3) |
| `src/components/sections/WorkFallbackList.tsx` | Accessible/no-canvas project list (§5.5, Phase 7) |

### 3.3 Store contracts

```ts
// interactionStore.ts
export type ExploreMode = "scroll" | "explore";
export type ActiveSource = "none" | "hover" | "tap" | "idle";

interface InteractionState {
  exploreTarget: 0 | 1;            // set by WorkExplorer visibility observer
  cursor: { x: number; y: number; inside: boolean }; // viewport px; inside = over the stage
  activeZone: number;              // -1 = none
  activeSource: ActiveSource;
  setExploreTarget(v: 0 | 1): void;
  setCursor(...): void;
  setActive(zone: number, source: ActiveSource): void;
}

// NOT reactive state (mutated in place, read via getState() each frame — avoids
// 60fps setState): zoneScreen: { x: number; y: number; rEdgePx: number; facing: number }[]
// Written by ZoneProjector (R3F), read by useInteractionDirector + OrbitTerms.
```

`scrollStore.zoneAlphas` becomes `number[]` (length `ZONE_COUNT`); the shallow-equal guard generalizes to a loop. `ZoneAlphas` tuple type is removed.

---

## 4. Behavior specifications

### 4.1 Explore mode engage/disengage (section entry/exit)

- `WorkExplorer` observes its sticky stage with an `IntersectionObserver` (`threshold: 0.6`): ≥60% visible → `exploreTarget = 1`, else `0`.
- In `useFrame`, `exploreWeight` lerps toward target with `k = min(1, dt * 3)` (~0.5s handoff). The head pose is `slerp/lerp(scrollPose, explorePose+cursorOffset, easeInOut(exploreWeight))`. Yaw must blend via shortest-arc (wrap-aware) so the head never spins the long way around during handoff.
- While `exploreWeight < 0.15`, the hover system is inert (no zone activation, alphas forced to 0 targets). This prevents glow flashes while scrolling past.

### 4.2 Cursor-follow rotation

- Window-level `pointermove` (registered only while `exploreTarget === 1`; removed on disengage). Store cursor in viewport px.
- Cursor → target offsets from the explore pose: `yawOffset = mapClamped(cursorX, stageRect, ±YAW_RANGE)`, `pitchOffset = mapClamped(cursorY, stageRect, ±PITCH_RANGE)`. Defaults: `YAW_RANGE = 0.45` rad, `PITCH_RANGE = 0.22` rad.
- Damped follow: `tau = 0.15s` exponential smoothing on the offsets (twitch-free, motion-sickness-safe). When `cursor.inside === false`, offsets ease to 0 (head returns to explore pose).

### 4.3 Hover / idle / grace state machine

States: `IDLE_WAIT` → `IDLE_CYCLING` ↔ `HOVER_ACTIVE` → `GRACE`.

| State | Behavior | Transitions |
|---|---|---|
| `IDLE_WAIT` | Nothing active. Timer runs. | after `IDLE_DELAY` (2.5s) → `IDLE_CYCLING`. Hover hit → `HOVER_ACTIVE`. |
| `IDLE_CYCLING` | Zones cued in order (skipping zones with `facing < FACING_MIN`): ramp-up 0.6s → hold 2.2s → ramp-down 0.6s → gap 0.5s → next. Loops forever (never stops after first interaction). Cued zone alpha target = `IDLE_ALPHA (0.55) × facing`. Panel does **not** open for idle cues; orbit terms **do** show around the cued zone. | Hover hit → `HOVER_ACTIVE` (current cue ramps down over 0.3s, no snap). Explore disengage → `IDLE_WAIT`. |
| `HOVER_ACTIVE` | `activeZone` alpha target = 1. Panel open. Idle timers frozen. Moving directly onto another zone re-targets `activeZone` in place (panel content cross-fades, state stays `HOVER_ACTIVE`). | Cursor leaves all zones (still in stage) → `GRACE`. Cursor leaves stage → `GRACE`. Tap elsewhere (touch) → `GRACE`. |
| `GRACE` | Previous zone's alpha eases to 0 (`ZONE_SMOOTH_TAU` handles it). Panel stays visible but begins fading after `PANEL_LINGER` (0.4s). | Re-hover any zone within `GRACE_MS` (1.2s) → `HOVER_ACTIVE` (no idle restart — this is the anti-flicker rule for passing between zones). Timeout → `IDLE_WAIT` with `IDLE_DELAY` shortened to 1.0s. |

Hover hit-test (each rAF): for each zone with `facing ≥ FACING_MIN`, score `= 1 − smoothstep(0.55×rEdgePx, rEdgePx, dist(cursor, zoneScreen))`; active zone = argmax score if max ≥ `HIT_THRESHOLD` (0.08). `rEdgePx` comes from projecting `ZONE_EDGE_RADIUS` at the zone's depth (ZoneProjector projects zone center and one edge-offset point per zone per frame — cheap, ≤ 2N projections).

### 4.4 Alpha targets summary

`hover/tap zone: 1.0` · `idle-cued zone: 0.55 × facing` · `all others: 0`. Written into `scrollStore.zoneAlphas`; the shader's existing `ZONE_SMOOTH_TAU` smoothing is the only easing on the GPU side — the state machine sets **targets**, ramp durations above are implemented as target envelopes in the director, matching the existing "CPU writes target, shader-side smoothing is tiny" philosophy.

---

## 5. Component specifications

### 5.1 `WorkExplorer.tsx` (replaces `PinnedProjects`)

- Section shell in `Projects.tsx` stays `id="work"`; inside it: header block (Reveal-animated, reusing the current "[ 003 ] Selected Work / Projects & case studies" markup from `PinnedProjects`) then a `relative h-[100vh]`… actually: outer wrapper `~200vh` with `sticky top-0 h-screen` stage so the user gets a dwell region — matching decision §0 row 1. Exact height tunable (`WORK_STAGE_VH = 200`).
- The stage is the pointer reference frame (its `getBoundingClientRect()` feeds §4.2 mapping) and hosts `ProjectPanel`, `OrbitTerms`, and a bottom-edge hint line (e.g. "move your cursor — the head responds"; copy TBD by Arvin, put placeholder).
- Registers/unregisters the pointer listener and runs `useInteractionDirector`.

### 5.2 `ProjectPanel.tsx`

- Width ~`clamp(320px, 28vw, 460px)`, vertically centered in the stage, on the side **opposite** the active zone.
- **Side rule:** compute once per activation from the zone's projected x at activation time: zone on screen-left half → panel right; else left. The side is **frozen while that zone stays active** (no mid-hover swaps). If the chosen side would put the panel off-screen (stage narrower than panel + margin — only possible on small viewports), fall back to bottom-anchored overlay.
- Content: index, year, status badge, title (pre/accent/post styling preserved: serif italic turquoise accent), tagline, description, 3 metrics, stack pills — extracted/restyled from `ProjectCard`.
- Entry/exit: opacity + 12px translate fade, 300ms ease-out in / 200ms out (motion/react, consistent with `Reveal` easing). Content swap between zones: cross-fade 150ms out / 200ms in.
- **Click-through:** panel (or its CTA row) is a link when `linkStatus === "live"` (`href`, `target="_blank" rel="noopener noreferrer"`). When `"coming-soon"`: inert, cursor-default, and a small "link coming soon" pill in the CTA position (visual treatment: same pill style as stack tags, `text-mute`, pulse-dot). No navigation fallback to the GitHub profile unless a project explicitly sets `href` to it.

### 5.3 Panel/zone geometry note

The head is horizontally centered (fixed full-viewport canvas). With the panel opposite the active zone, the glowing zone and panel never overlap by construction; no additional edge-swap logic is needed beyond the small-viewport fallback above.

### 5.4 `OrbitTerms.tsx`

- Shown only for `activeZone` or the idle-cued zone (§0). Labels = that project's `stack` array (≤6).
- DOM `<span>`s absolutely positioned in the stage, anchored to the zone's projected screen center (read from `zoneScreen` each rAF — this component runs its own rAF and writes transforms directly to refs; **no React state per frame**).
- Layout: even angular spacing on a ring, `radius = rEdgePx × 1.35` (min 90px, max 150px). Idle motion: ring rotates at 0.12 rad/s + per-label bob `sin(t·0.8 + phase) × 4px`.
- Repulsion: per label, if `dist(cursor, label) < REPEL_RADIUS (90px)`, apply radial offset with spring return — critically damped spring (`stiffness 120, damping 18`), max displacement 44px. Integrate in the rAF with the same `dt`-clamped pattern.
- Style: `font-mono text-[10px] uppercase tracking-[0.22em] text-mute`, opacity follows the zone's alpha (read from `scrollStore.zoneAlphas`), `pointer-events-none`.
- Perf: worst case ~6 labels — trivial. Still, zero allocations in the loop.

### 5.5 Accessibility & fallbacks (Phase 7)

- `WorkFallbackList.tsx`: a semantic, keyboard-navigable list of all projects (same fields), rendered **always** but `sr-only` when the interactive stage is live; rendered visibly when `HeadLayer` is in `fallback` mode or on non-interactive mobile tiers. This gives keyboard and screen-reader users full project access without inventing canvas focus semantics.
- Keyboard progressive enhancement: the stage is focusable (`tabIndex=0`); Left/Right arrows step `activeZone` (source `"tap"`), Enter follows the link, Escape dismisses. Announce panel changes via `aria-live="polite"` region containing title + tagline.
- `prefers-reduced-motion`: `HeadLayer` already falls back to a static gradient (no canvas) — Work then shows the visible fallback list. Inside the interactive path, reduced-motion is therefore unreachable; no second on-canvas fallback needed (confirming outline §9). If Phase 6 later renders the head for reduced-motion users, idle cycle and orbit motion must be disabled there.

---

## 6. Data model & `regions.ts` generalization

```ts
// projectsData.ts
export interface Project {
  index: string; year: string;
  pre?: string; accent: string; post?: string;
  tagline: string; description: string;
  metrics: { value: string; label: string }[];
  stack: string[];
  status: "Live" | "Case Study" | "In Development";
  zone: number;                       // NEW, required — index into ZONES
  href?: string;                      // NEW — GitHub/demo
  linkStatus: "live" | "coming-soon"; // NEW, required
}
```

`regions.ts` changes (ticket P5-1):

- `ZONES` becomes the output of `buildZoneLayout(n: number): Vector3[]`. Strategy: a **curated anchor pool** (not pure math) — 8 hand-tuned head-surface anchors ordered by visual priority (the current 4 first, then 4 more: rear-crown L/R, upper-rear L/R). `buildZoneLayout(n)` returns the first `n`. Pure algorithmic placement risks anatomically awkward spots (outline §9's own warning); a curated pool is deterministic and art-directable.
- `MAX_ZONES = 8` exported; build-time assert `PROJECTS.length ≤ MAX_ZONES` and that `zone` values are unique and `< ZONE_COUNT`.
- `ZONE_COUNT = min(PROJECTS.length, MAX_ZONES)`… careful: `ParticleHead` bakes zones into geometry at build time from `ZONES`, so `ZONE_COUNT` derives from the layout, which derives from project count → geometry regenerates only when project count changes (rebuild-time, fine).
- `PROJECT_ZONE` deleted. `zoneKeep()`, `ZONE_CORE_RADIUS`, `ZONE_EDGE_RADIUS` unchanged.
- **Practical cap:** 8 is the hard max; visual QA in P5-2 confirms 6 as the comfortable default recommendation. Document in the file header.

---

## 7. Tickets

Agent key: **[O]** = Opus (3D/shader/state-machine/perf-critical), **[S]** = Sonnet (UI, data, refactors, QA). Tickets within a phase may run in parallel unless a dependency is listed. Every ticket: run `npm run lint` and `npm run build` clean before done.

### Phase 0 — Extraction & demolition
- **P0-1 [S]** Extract `Project` type + `PROJECTS` into `src/lib/projectsData.ts` with the new fields (§6): `zone` (01→0, 02→1, 03→2, 04→3), `linkStatus` (`"coming-soon"` for all four until Arvin supplies links), `href` omitted. Extract reusable card content markup notes (or a shared subcomponent) for the panel. Update imports. *Accept:* build clean; site renders unchanged.
- **P0-2 [S]** *(depends P0-1, and lands together with P1-1 on a branch — the site must not ship with Work gutted)* Delete `PinnedProjects.tsx`, `ProjectsHeader.tsx`, `ZoneObserver.tsx`. Verify with grep: zero remaining imports. `Projects.tsx` temporarily renders header + placeholder stage.

### Phase 1 — Foundation (pose, projection, hit-test, alphas)
- **P1-1 [O]** `interactionStore.ts` (§3.3) + `WorkExplorer.tsx` skeleton: sticky 200vh/100vh-stage layout, header, IO-driven `exploreTarget`, pointer listener lifecycle. No panel yet.
- **P1-2 [O]** Shader generalization: `uZoneAlpha` vec4 → `float uZoneAlpha[MAX_ZONES]` (GLSL ES 1.00: index with a compile-time loop over `MAX_ZONES` comparing to `aZone`, or inject `MAX_ZONES` via `#define`; dynamic indexing of uniform arrays by a varying-derived value is not portable — branch or loop as the current code already does for vec4). `scrollStore.zoneAlphas` → `number[]`. CPU-side smoothing loop generalized. *Accept:* with a temporary debug writer cycling each zone, all `ZONE_COUNT` zones glow correctly; base particles unaffected.
- **P1-3 [O]** *(depends P1-1)* HeadPose controller in `ParticleHead.tsx`: explore pose constants, `exploreWeight` blend (shortest-arc yaw, §4.1), cursor-follow offsets (§4.2). Scroll path byte-identical when `exploreWeight === 0`. *Accept:* scrolling into Work eases the head to center-front over ~0.5s; mouse moves it smoothly within capped range; scrolling out hands back with no snap or long-way spin; hero/about/contact behavior unchanged.
- **P1-4 [O]** *(depends P1-3)* ZoneProjector: per-frame zone screen positions + `rEdgePx` + facing into `interactionStore.zoneScreen` (mutable, zero-alloc: preallocated array + scratch `Vector3`s). Rotation-pacing retune for the shorter page: keep the 360° mapping, review by eye at `WORK_STAGE_VH = 200`, adjust `RISE_*`/turn constants only if pacing feels rushed; document final values. *Accept:* debug overlay (temporary, behind `?debugzones`) draws circles at projected positions tracking rotation correctly; back-facing zones report `facing < FACING_MIN`.
- **P1-5 [O]** *(depends P1-2, P1-4)* `useInteractionDirector.ts` v1: hit-test + hover-only alpha writing (no idle machine yet — `IDLE_*` states stubbed to `IDLE_WAIT`). *Accept:* hovering a zone densifies it (target 1.0), leaving fades it; back-facing zones un-hoverable; no glow outside explore mode.

### Phase 2 — Panel
- **P2-1 [S]** *(depends P1-5)* `ProjectPanel.tsx` per §5.2: side rule, freeze, fades, content cross-fade, link/coming-soon states. *Accept:* hover each zone → correct project on the opposite side; rapid A→B→A hovers never double-render or flicker; coming-soon click is inert; live link opens new tab.

### Phase 3 — Idle cycle
- **P3-1 [O]** *(depends P1-5; parallel with P2-1)* Full state machine (§4.3) with all timing constants exported from a single `interactionTuning.ts`. Idle cue skips back-facing zones, never opens the panel, loops forever. *Accept:* leave cursor out of stage → cycle begins after 2.5s and loops; hovering mid-cue hands off within 0.3s without flash; passing between two zones within 1.2s never restarts idle; leaving/entering the section resets cleanly.

### Phase 4 — Orbit terms
- **P4-1 [O]** *(depends P2-1, P3-1)* `OrbitTerms.tsx` per §5.4. *Accept:* ring tracks the zone while the head follows the cursor (no 1-frame lag jitter — read `zoneScreen` in the same rAF that writes transforms); repulsion springs back smoothly; opacity follows zone alpha; Chrome DevTools perf trace shows no long tasks and no per-frame React renders.

### Phase 5 — Scalability
- **P5-1 [O]** `regions.ts` generalization per §6 (anchor pool, `buildZoneLayout`, asserts, delete `PROJECT_ZONE`). `ParticleHead` geometry derives zone count from layout.
- **P5-2 [S]** *(depends P5-1)* Add 2 temporary dummy projects (6 total) behind a local flag; visual QA pass on zone placement, idle cycle length, panel side behavior at 6 zones; record the recommended cap in `regions.ts` header; remove dummies. *Accept:* screenshots of all 6 zones glowing at explore pose attached to the ticket.

### Phase 6 — Mobile (investigation → implementation)
- **P6-1 [O] Spike (timeboxed):** goal — interactive head on touch devices, per Arvin. Investigate and report before building:
  1. **Perf tiers:** measure FPS on a throttled-CPU mobile emulation + at least one real device profile with (a) current budget (20k + kept extras), (b) reduced budget (`COUNT 8000`, `EXTRA_POOL 40000`, dpr cap 1.5), (c) reduced + `uSize` bump to compensate visual density.
  2. **Gating strategy:** replace the blunt `width < 768` kill switch with capability gating (`pointer: coarse` detection, `navigator.hardwareConcurrency`, `deviceMemory` where present, plus a first-frames FPS probe that can demote to fallback at runtime).
  3. **Layout:** where the panel goes on portrait phones (recommend: bottom sheet over the stage) and whether the stage height/head framing needs a mobile camera adjustment.
  4. **Input model:** tap-to-activate via the same screen-space hit test on `pointerup` (tap = <10px movement, <300ms); tap-outside dismisses; **no drag-to-rotate in v1** (conflicts with page scroll) — assess feasibility of a later opt-in drag on the stage only, report as stretch.
  *Deliverable:* short findings doc (`docs/mobile-head-findings.md`) + go/no-go per tier. **Desktop ships regardless of this spike's outcome.**
- **P6-2 [O]** *(depends P6-1 + Arvin sign-off on findings)* Implement the approved tier plan: `HeadLayer` gating, particle budget scaling, tap interaction, mobile panel layout, idle cycle retained as the touch discovery cue. *Accept:* mid-tier emulated device ≥30fps sustained in explore mode; low tier cleanly falls back to `WorkFallbackList`; no double-fire of tap+hover on hybrid devices (pointer-event based, not touch events).

### Phase 7 — Accessibility, polish, QA
- **P7-1 [S]** `WorkFallbackList.tsx` + keyboard/ARIA per §5.5.
- **P7-2 [S]** Copy + micro-polish: stage hint line, coming-soon pill treatment, panel typography pass against the site's tokens.
- **P7-3 [S] Verification sweep (final gate):** run the full QA checklist (§9), `npm run lint` + `npm run build`, Chrome perf trace of a 60s explore session (no leaks: listener add/remove balanced across 20 section enter/exits), cross-browser (Chromium, Firefox, Safari), and confirm hero/about/contact pixel-identical behavior vs. `main`. File issues rather than fixing in-place if non-trivial.

**Suggested branch strategy:** feature branch `feat/interactive-head`; P0–P2 land there in order; P3/P4 parallel after; merge to main only after P7-3 for desktop (Phases 1–5, 7), with Phase 6 as a follow-up branch.

---

## 8. Tuning constants (single source: `src/lib/interactionTuning.ts`)

| Constant | Default | Notes |
|---|---|---|
| `WORK_STAGE_VH` | 200 | Outer wrapper height |
| `EXPLORE_ENGAGE_K` | `dt*3` | ~0.5s pose handoff |
| `EXPLORE_POSE_YAW_OFFSET` | 0 | 3/4-angle knob |
| `YAW_RANGE / PITCH_RANGE` | 0.45 / 0.22 rad | Cursor-follow caps |
| `CURSOR_FOLLOW_TAU` | 0.15 s | Follow damping |
| `FACING_MIN` | 0.15 | Hoverability threshold |
| `HIT_THRESHOLD` | 0.08 | Hover score floor |
| `IDLE_DELAY` | 2.5 s (1.0 s post-grace) | |
| `IDLE_RAMP / HOLD / GAP` | 0.6 / 2.2 / 0.5 s | Cycle envelope |
| `IDLE_ALPHA` | 0.55 | × facing |
| `GRACE_MS` | 1200 ms | Anti-flicker window |
| `PANEL_LINGER` | 0.4 s | Before panel fade in grace |
| `ORBIT_SPEED / BOB` | 0.12 rad/s / 4px | |
| `REPEL_RADIUS / MAX_DISP` | 90px / 44px | Spring: stiffness 120, damping 18 |

All "feel" acceptance criteria are judged at these defaults; agents may propose changes but must land them in this file with a comment, never inline magic numbers.

## 9. QA checklist (P7-3, abridged — expand in ticket)

Handoff in/out of Work at slow/fast scroll and mid-animation reversal · no long-way yaw spin · hover every zone at multiple head angles · far-side zone unhoverable · idle loop full cycle ×2 · idle→hover handoff · A↔B zone flicker test · panel side correctness per zone · coming-soon vs live link · rapid section enter/exit ×20 (listener/leak check) · resize during explore (projection stays correct) · reduced-motion → fallback list · keyboard path end-to-end · Lighthouse perf not regressed vs. main.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Page-length change alters site-wide rotation feel | P1-4 explicit retune + review gate |
| Hover feels laggy through two stores + rAF | zoneScreen is non-reactive/mutable; director runs every rAF; only `activeZone` transitions touch React |
| Idle/hover races (the classic flicker bug) | Single state machine owns all alpha targets; nothing else writes `zoneAlphas` |
| GLSL uniform-array portability | Compile-time loop/branch pattern (P1-2); test on Safari/ANGLE early |
| Mobile perf unknown | Spike-first with go/no-go; runtime FPS demotion to fallback |
| Scope creep on orbit-term physics | Decorative only; hard-capped constants; timebox |
