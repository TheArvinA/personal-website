# Interactive Head — Project Outline (for Fable / PM refinement)

Status: concept outline, not yet built. This replaces the scroll-driven "pinned one-card-at-a-time" Projects section (`PinnedProjects.tsx`, `ProjectsHeader.tsx`, `ZoneObserver.tsx`) with a hover/cursor-driven explorer built on the existing particle-head density-zone system.

## 1. Concept summary

The particle head becomes an interactive explorer for the Work section. Instead of scroll advancing through project cards, the user moves their mouse; the head turns to follow the cursor, and whichever brain "zone" ends up under the cursor densifies (glows) and reveals its project in a side panel. Each zone also has a ring of orbiting language/framework labels that gently repel from the cursor. When idle, zones take turns lighting up on their own as a discovery cue.

This keeps the site's core visual identity (the particle head, the density-zone glow language established in the current build) but turns Work from a linear reveal into an explorable object.

## 2. What's reused vs. replaced

**Reused as-is or lightly adapted:**
- `ParticleHead.tsx` — particle geometry, shader, entrance/shimmer, the `EXTRA_POOL`/zone-density mechanism (`aZone` attribute, `uZoneAlpha` uniform). The *density* glow concept stays; only what *drives* `zoneAlphas` changes (cursor instead of scroll).
- `src/lib/regions.ts` — `ZONES`, `zoneKeep()`, `ZONE_CORE_RADIUS`/`ZONE_EDGE_RADIUS`, `PROJECT_ZONE`. Needs to become N-scalable (see §8) but the falloff math is sound.
- `src/lib/scrollStore.ts` — `zoneAlphas` vector concept survives; `progress`/`activeSection` still drive rotation elsewhere on the site (hero/about/contact untouched).
- Card content model (title, tagline, description, metrics, stack) from `Projects.tsx`'s `PROJECTS` array.

**Being scrapped:**
- `PinnedProjects.tsx` (pinned scroll cross-fade, `cardOpacity`, header lead/fade timeline)
- `ProjectsHeader.tsx` (unused already)
- `ZoneObserver.tsx` (scroll-intersection zone trigger)
- The whole "one project auto-shown per scroll segment" model.

## 3. Section entry / exit

- On scroll into Work: the head eases out of its normal scroll-driven rotation into a fixed, centered "explore" pose (front-facing or a chosen 3/4 angle — TBD visually).
- While centered, scroll-driven rotation (`progress`-based yaw/pitch/rise in `ParticleHead.tsx`) is suspended; mouse position becomes the rotation driver.
- On scroll out of Work (either direction), control hands back to scroll and the head resumes its normal scroll-driven pose/rotation from wherever it is.
- Needs a defined transition curve (duration, easing) for the handoff so it doesn't feel like a snap — likely reuse the existing lerp pattern (`k = min(1, dt*8)` style) already in the codebase.

## 4. Core interaction loop

1. **Idle (nothing hovered):** zones take turns glowing on a loop, indefinitely (doesn't stop after first interaction) — a slow, ambient cycle, not distracting. Orbiting term labels are visible around whichever zone is currently cued (or around all zones at low opacity — TBD).
2. **Mouse enters the Work canvas:** the head begins turning to track cursor position (not 1:1 — a damped follow, consistent with the site's existing smoothing style).
3. **A zone comes under the cursor:** that zone's density ramps up (reusing `uZoneAlpha` fade), the idle auto-cycle pauses/defers, and the side panel fades in with that project's full info (title, tagline, description, metrics, stack — same depth as today's cards).
4. **Orbiting terms react:** the zone's stack-label ring is visible and terms nearest the cursor repel outward (soft radial force, spring back when cursor moves away). Decorative only — not clickable/filterable.
5. **Cursor leaves the zone (but stays in the canvas):** zone fades back to base density; if no other zone is immediately hovered, idle auto-cycle resumes after a short grace period (avoid flicker if the user is just passing between zones).
6. **Cursor leaves the canvas entirely:** head eases back toward its idle "explore" pose; auto-cycle resumes.
7. **Click on the panel:** opens the project's GitHub/live-demo link in a new tab. If no link exists yet for that project, click is inert and the panel shows a "link coming soon" state instead of navigating. If a link truly never comes, fallback is the general GitHub profile — TBD per-project at data-entry time (see §8).

## 5. Touch / mobile behavior

No hover on touch devices, so:
- Tap a glowing zone → same reveal as desktop hover (zone densifies, panel shows).
- Tap elsewhere on the head / tap a different zone → switches or dismisses.
- Idle auto-cycle still runs so touch users get the same discovery cue before their first tap.
- Head "mouse-follow" rotation has no touch equivalent — likely stays in its centered idle pose on touch, with tap being the only input (no drag-to-rotate, to avoid conflicting with page scroll gestures) — **flag for Fable: confirm this default, or consider drag-to-rotate as a stretch goal.**

## 6. Orbiting terms

- Decorative labels (e.g. "YOLOv8", "FastAPI", "React") arranged in a ring/orbit around their zone.
- Idle: gentle continuous orbit motion (slow rotation, maybe slight bob), independent of hover state, always alive.
- On cursor proximity: soft repulsion — terms push away from the cursor and spring back once it moves off, like a small force field. Purely visual flourish, no click/filter behavior.
- Needs an effort/complexity flag: this is 2D-over-3D UI (screen-space labels tracking a 3D zone's projected position) with physics-like repulsion — more involved than the rest of the interaction (see §9).

## 7. Panel design

- Appears beside the head, positioned toward the side of whichever zone is active (left-side zones → panel on the left, etc., or a fixed side — TBD visually).
- Content: same fields as today's project cards — index, year, status badge, title, tagline, description, metrics (3 stats), stack pills.
- Entry/exit: fade (matching the site's existing `Reveal`-style easing), not a hard cut.
- Only one panel/project visible at a time, matching the "one at a time" spirit of the original design — just hover-triggered instead of scroll-triggered.

## 8. Scalability (design for growth)

Today: 4 zones, `PROJECT_ZONE` is a hand-placed `Record<string, number>` mapping project index → zone index (0–3), with zone centers/radii hardcoded in `regions.ts`.

For N projects, needs:
- A generative or configurable zone-layout function instead of 4 hardcoded `Vector3`s — e.g. distribute N zones around the head surface algorithmically (even angular spacing around a band, or a small curated pool of "good" anchor points that new projects get assigned to in order).
- `PROJECTS` data model gains a required `zone` (or auto-assigned index) and an optional `href` (GitHub/demo link) + `linkStatus: "live" | "coming-soon"` used by the click-through fallback (§4.7).
- Decide a practical max (realistically the head can only cleanly support so many non-overlapping zones — Fable should sanity-check a visual cap, e.g. 6–8, before the layout gets crowded).

## 9. Technical considerations & risks (for Fable's planning)

- **Hover detection on a particle cloud:** the head is a WebGL `THREE.Points` object, not discrete clickable meshes. Detecting "cursor is over zone X" is not standard DOM hover — options: (a) raycast against invisible proxy geometry (small spheres/discs positioned at each zone's *current rotated* world position, projected each frame) — most robust; (b) screen-space distance check between cursor and each zone's projected 2D position (cheaper, no raycasting, likely sufficient given zones are large soft radial patches already). Recommend (b) first — reuses the "soft circular zone" concept already in `regions.ts` almost verbatim, just evaluated in screen space instead of head-local space.
- **Mouse-follow rotation feel:** needs tuning so it reads as "tracking the viewer" without being twitchy or motion-sickness-inducing — damped/lerped, capped rotation range so the head doesn't spin uncomfortably far to reach edge-of-screen cursor positions.
- **Idle cycle vs. hover conflict:** need clear state machine (idle-cycling ↔ hover-active ↔ grace-period) so the auto-cycle doesn't fight the user's actual hover, and doesn't restart jarringly when moving between adjacent zones.
- **Orbiting term repulsion performance:** screen-space physics-like repulsion for potentially 20+ labels (N projects × ~5 stack terms) needs to stay cheap — likely fine at this scale but worth a perf pass.
- **Accessibility / reduced motion:** `HeadLayer.tsx` already has a `prefers-reduced-motion` fallback path (static gradient) — confirm the new hover system doesn't need its own on-canvas fallback beyond that, and that keyboard-only users have *some* way to reach project info (e.g. the panel content could also exist as visually-hidden accessible text, or a simple keyboard-navigable list as a progressive-enhancement fallback below the canvas).
- **Zone layout generation:** if going generative (§8), needs a one-time design pass to make sure auto-placed zones don't overlap or land somewhere anatomically awkward (e.g. face-front) as more projects are added.

## 10. Open questions still to resolve (flagged for Fable, not yet decided)

- Exact idle-cycle timing (how long each zone glows, gap between, total loop length).
- Panel position rule when a zone's projected position is near screen edge (does the panel side ever swap to stay on-screen?).
- Visual treatment of "link coming soon" state in the panel.
- Whether orbiting terms are visible for ALL zones simultaneously at low opacity, or only the active/idle-cued zone.
- Exact centered "explore" pose angle for section entry.
- Practical max zone count before the layout needs a redesign (§8).

## 11. Suggested phased build order

1. **Foundation:** screen-space zone hit-testing + cursor-driven rotation replacing scroll-driven rotation within Work section bounds; reuse existing `zoneAlphas`/shader density system untouched.
2. **Panel:** hover → panel reveal/dismiss with existing card content, no orbit terms yet.
3. **Idle cue:** auto-cycling zones when nothing is hovered, with the hover/idle state machine.
4. **Orbit terms:** decorative ring + cursor repulsion.
5. **Touch parity:** tap-to-reveal pass, confirm mobile viewport behavior.
6. **Scalability pass:** generalize zone layout + `PROJECTS` data model for N projects, click-through link fallback states.
7. **Polish/accessibility:** reduced-motion confirmation, keyboard fallback, panel-position edge handling.
