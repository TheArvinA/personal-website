/**
 * Single source of truth for all interactive-head "feel" constants
 * (implementation plan §8). NOTHING in the interaction system may inline a
 * tuning magic number — import from here instead. Comments note the plan's
 * default and intent so a designer can retune without reading the code.
 *
 * Note: the pre-existing scroll-pose constants (ROT_OFFSET_*, RISE_*,
 * ZONE_SMOOTH_TAU, the rotation-smoothing rate) intentionally stay local to
 * ParticleHead.tsx — they define the ORIGINAL scroll choreography and live
 * next to the code that must remain byte-identical when not in explore mode.
 * This file owns only the NEW explore-interaction tuning from §8.
 */

// --- Stage / engagement -----------------------------------------------------

/** Outer wrapper height (vh). Header beat + one sticky 100vh explore stage. */
export const WORK_STAGE_VH = 200;

/** IntersectionObserver ratio at which the sticky stage counts as engaged.
 *  (Legacy: engage is now scroll-scrubbed via EXPLORE_ENGAGE_BAND_VH below;
 *  kept exported for any remaining references.) */
export const EXPLORE_VISIBILITY_THRESHOLD = 0.6;

/**
 * Scroll distance — as a fraction of viewport height — over which the head
 * scrubs between its scroll-driven pose and the centred explore pose as the
 * Work section approaches / leaves. The handoff is tied to scroll position
 * (not a timer), so it is seamless and reversible: scroll in and the head
 * turns to face you; scroll back and it turns away. Larger = more gradual turn.
 */
export const EXPLORE_ENGAGE_BAND_VH = 0.85;

/** Pose-handoff smoothing: exploreWeight lerps toward the scroll-scrubbed
 *  target at k=min(1,dt*K). High so the weight tracks scroll closely (the
 *  pose lerp POSE_LERP_K does the visual smoothing); low would lag scroll. */
export const EXPLORE_ENGAGE_K = 10;

/**
 * Below this exploreWeight the hover system is inert (all alpha targets forced
 * to 0) so scrolling past Work never flashes the glow (§4.1).
 */
export const EXPLORE_INERT_THRESHOLD = 0.15;

// --- Explore pose -----------------------------------------------------------

/** 3/4-angle knob: added to the front-facing explore yaw. 0 = dead front (§1.9). */
export const EXPLORE_POSE_YAW_OFFSET = 0;

// --- Cursor steering — RATE-BASED head rotation -----------------------------
// Replaces the old positional cursor-follow. The cursor's distance from the
// stage centre sets a rotation VELOCITY: near the centre the head barely turns
// (so the user can settle on a zone and hover/click it), and toward the screen
// edges the head keeps rotating that direction — letting you spin the head to
// bring any of the zones that surround it around to the front.

/** Central fraction of the stage (per axis) with ~zero rotation — the stable
 *  "hover/click" region. |normalized cursor| below this contributes no turn. */
export const STEER_DEADZONE = 0.22;
/** Response curve exponent past the deadzone: >1 = gentle near centre, strong
 *  near the edges. */
export const STEER_EXP = 2.2;
/** Max yaw rotation speed (rad/s) when the cursor is at the horizontal edge. */
export const YAW_RATE_MAX = 2.5;
/** Max pitch rotation speed (rad/s) when the cursor is at the vertical edge. */
export const PITCH_RATE_MAX = 1.0;
/** Clamp on accumulated pitch offset from the explore pose (radians), so the
 *  head can tilt up/down a little but never flips over. */
export const PITCH_LIMIT = 0.4;
/** After a hover is lost (cursor over empty space), keep the zone latched
 *  (glow + panel up, steering frozen) for this long (ms) so the cursor can
 *  cross an empty gap from the zone to the panel and click it. Also the delay
 *  before head rotation resumes once the cursor reaches an empty edge, so kept
 *  short. */
export const STEER_LOCK_GRACE_MS = 240;
/** While a zone is already focused, the cursor must DWELL this long (ms) over a
 *  DIFFERENT zone before the focus switches to it. Below this, passing over a
 *  neighbour zone (e.g. while traveling to the panel) is treated as a graze and
 *  ignored, so the focused project doesn't flip away mid-travel. */
export const ZONE_SWITCH_DWELL_MS = 260;

// --- Hover hit-test (§4.3) --------------------------------------------------

/** A zone whose view-space facing z is below this is un-hoverable (back-facing). */
export const FACING_MIN = 0.15;
/** Minimum hover score for a zone to become active. */
export const HIT_THRESHOLD = 0.08;
/**
 * Inner edge of the hover falloff: score = 1 - smoothstep(FACTOR*rEdgePx,
 * rEdgePx, dist). Inside FACTOR*rEdgePx the score is a solid 1.
 */
export const HIT_INNER_FACTOR = 0.55;

// --- Idle cycle (§4.3) — Phase 3; exported now so P1-5 can stub against them -

/** Delay before the idle cycle starts (seconds). Shortened form used post-grace. */
export const IDLE_DELAY = 2.5;
export const IDLE_DELAY_POST_GRACE = 1.0;
/** Idle-cue envelope (seconds): ramp up / hold / gap before next zone. */
export const IDLE_RAMP = 0.6;
export const IDLE_HOLD = 2.2;
export const IDLE_GAP = 0.5;
/** Idle-cue alpha, multiplied by the zone's facing factor. */
export const IDLE_ALPHA = 0.55;
/**
 * Idle turntable (P3-1, supersedes the plan's held-pose cycle): after inactivity
 * the head gently auto-rotates so every surrounding zone glows as it comes to the
 * front, then hands back instantly on any input.
 */
/** Auto-yaw rate while the idle turntable runs (rad/s). With zones ~90° apart
 *  this sets how often the glowing region changes (≈ (π/2)/rate seconds). */
export const IDLE_SPIN_RATE = 0.42;
/** Ease-in time constant (s) for the idle spin so it accelerates smoothly from
 *  a standstill at the head's current angle instead of snapping to full speed.
 *  Stopping is instant (the user's steering takes over cleanly). */
export const IDLE_SPIN_RAMP_TAU = 0.6;
/** Facing value at which an idle-cued zone reaches full IDLE_ALPHA. Alpha target
 *  = IDLE_ALPHA * smoothstep(FACING_MIN, IDLE_FACING_FULL, facing) — so the
 *  front-most zone(s) glow and dim as they pass; back-facing zones stay dark. */
export const IDLE_FACING_FULL = 0.6;
/** Cursor movement (px, per axis) beyond which idle resets its timer / exits.
 *  Anything smaller is treated as sensor noise, not intentional input. */
export const IDLE_CURSOR_MOVE_EPS = 3;

// --- Grace / panel (§4.3, §5.2) --------------------------------------------

/** Anti-flicker window to re-hover between zones without restarting idle (ms). */
export const GRACE_MS = 1200;
/** How long the panel lingers before fading in the grace state (seconds). */
export const PANEL_LINGER = 0.4;

// --- Panel entry/exit/content-swap (§5.2) — Phase 2 -------------------------

/** Whole-panel entrance: opacity + translate, seconds (ease-out). */
export const PANEL_ENTER_DURATION = 0.3;
/** Whole-panel exit: opacity + translate, seconds. */
export const PANEL_EXIT_DURATION = 0.2;
/** Panel entry/exit translate distance (px). */
export const PANEL_TRANSLATE_PX = 12;
/** Content cross-fade when the active zone switches directly (panel stays
 *  mounted, only its content swaps) — out then in, seconds. */
export const PANEL_CONTENT_OUT_DURATION = 0.15;
export const PANEL_CONTENT_IN_DURATION = 0.2;
/** Minimum stage width (px) for the side-anchored panel layout; below this the
 *  panel falls back to a bottom-anchored overlay (desktop-first, simple rule —
 *  §5.2 small-viewport fallback). */
export const PANEL_SIDE_MIN_STAGE_WIDTH = 760;

// --- Orbit terms (§5.4) — Phase 4 ------------------------------------------

export const ORBIT_SPEED = 0.03; // rad/s — very slow drift, NOT a spin. The
// labels mostly float in place; the cursor repulsion gives them most of their
// motion.
export const REPEL_RADIUS = 110; // px cursor proximity that repels a label
export const REPEL_MAX_DISP = 54; // px max repulsion displacement
export const REPEL_STIFFNESS = 120; // critically-damped spring
export const REPEL_DAMPING = 18;

/** Uneven scatter (deterministic per label) so the labels don't sit on a
 *  perfect ring: angle is jittered off its even slot by up to ±this (radians),
 *  and radius is scaled within ±ORBIT_RADIUS_JITTER/2. */
export const ORBIT_ANGLE_JITTER = 0.9;
export const ORBIT_RADIUS_JITTER = 0.5;
/** Gentle independent "floating" drift per label (px amplitude, rad/s freq band)
 *  layered on the scattered base position — replaces the old rigid bob. */
export const ORBIT_FLOAT_AMP = 17;
export const ORBIT_FLOAT_FREQ_MIN = 0.22;
export const ORBIT_FLOAT_FREQ_RANGE = 0.34;

/** Max stack terms shown on the orbit ring for a zone. */
export const ORBIT_TERM_MAX = 6;
/** Ring radius = clamp(rEdgePx * FACTOR, MIN, MAX) (px). Sits the labels just
 *  outside the zone's projected edge, with sane bounds as depth changes. */
export const ORBIT_RING_RADIUS_FACTOR = 1.35;
export const ORBIT_RING_RADIUS_MIN = 90;
export const ORBIT_RING_RADIUS_MAX = 150;
/** Vertical-bob frequency (rad/s) applied per label on top of the ring spin. */
export const ORBIT_BOB_FREQ = 0.8;
/** Base opacity the labels reach at full zone glow. */
export const ORBIT_TERM_BASE_OPACITY = 1.0;
/** The active zone's live alpha is multiplied by this before driving label
 *  opacity, so terms still fade in/out WITH the glow but reach full brightness
 *  well before the glow peaks — keeps keywords legible over the particles even
 *  during the dimmer idle cue (idle alpha ~0.55 → ~1.0). */
export const ORBIT_TERM_ALPHA_BOOST = 1.9;
/** Max integration step (s) for the repulsion spring, so a long rAF gap (tab
 *  refocus) can't blow the spring up. */
export const ORBIT_MAX_DT = 0.05;
