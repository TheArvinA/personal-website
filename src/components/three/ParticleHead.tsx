"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import * as THREE from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { useInteractionStore } from "@/lib/interactionStore";
import { ZONES, ZONE_COUNT, ZONE_EDGE_RADIUS, zoneKeep } from "@/lib/regions";
import {
  EXPLORE_ENGAGE_K,
  EXPLORE_POSE_YAW_OFFSET,
  STEER_DEADZONE,
  STEER_EXP,
  YAW_RATE_MAX,
  PITCH_RATE_MAX,
  PITCH_LIMIT,
  IDLE_SPIN_RATE,
  IDLE_SPIN_RAMP_TAU,
} from "@/lib/interactionTuning";

const MODEL_URL = "/head.glb";
const COUNT = 20000; // always-visible base particles (user-tuned look)
const EXTRA_POOL = 165000; // additional uniform samples, filtered down to the zones
const TARGET_SIZE = 1.8; // largest bbox dimension maps to this many world units
// base (20000) + kept extras => matches the old 60000 density inside a zone,
// while the rest of the head stays at the base 20000 look.

// Hard cap on shader per-zone alpha slots. Matches `#define MAX_ZONES` in the
// vertex shader and the plan's MAX_ZONES (§1.5). The uniform array is always
// this long; only the first ZONE_COUNT entries are ever driven.
const MAX_ZONES = 8;

const TWO_PI = Math.PI * 2;

// Orientation fixups — tweak if the scan loads sideways/backwards/tilted.
const ROT_OFFSET_X = 0; // tilt (radians)
const ROT_OFFSET_Y = Math.PI / 2; // spin base; calibrated so progress 0 faces the camera (scan's nose points -X, Ry(+π/2) rotates it to +Z toward camera)

// "Rise at the back": bump peaks at progress 0.5, zero at 0 and 1.
//
// P1-4 rotation-pacing review (WORK_STAGE_VH = 200): shrinking Work from ~480vh
// to ~200vh shortens the page ~35%, so the scroll-driven 360° yaw completes over
// fewer scroll pixels — i.e. the head turns "faster" per wheel-notch everywhere
// (§1.1). The 360° mapping (progress → full turn) is INTENTIONALLY preserved.
// RISE_PITCH/RISE_DROP and POSE_LERP_K are amplitude/smoothing, not pacing, so
// changing them would not fix perceived rush and risks regressing hero/about/
// contact. Decision: leave all rotation constants at their current values;
// flagged for on-device confirmation (the sandbox build cap blocks visual QA).
const RISE_PITCH = 0.42; // forward tilt (radians) at the back — unchanged (P1-4)
const RISE_DROP = 0.35; // downward y shift (world units) at the back — unchanged (P1-4)

// Rotation-smoothing rate for the scroll-driven pose (k = min(1, dt*POSE_LERP_K)).
// This is the ORIGINAL scroll choreography constant — kept here (not in
// interactionTuning) next to the code that must stay byte-identical off-explore.
const POSE_LERP_K = 8;

// Tiny smoothing time-constant (seconds) applied to the scroll-driven zone
// alpha only to avoid micro-stepping between frames. Small enough that the glow
// tracks its target essentially 1:1.
const ZONE_SMOOTH_TAU = 0.05;

// TEMPORARY (P1-2 verification): when true, ignore the store's zoneAlphas and
// cycle each zone 0→1 in turn so you can confirm all ZONE_COUNT zones glow and
// base particles (aZone === -1) are unaffected. Leave OFF by default; flip to
// true locally to eyeball the shader-array plumbing. Not wired to ?debugzones
// so it never fights the real director during P1-4/P1-5 checks.
const DEBUG_ZONE_ALPHA_CYCLE = false;
const DEBUG_CYCLE_PERIOD = 1.2; // seconds per zone while cycling

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Shortest signed angular delta from `from` to `to`, in (-π, π]. */
function shortestArc(from: number, to: number): number {
  const d = to - from;
  return ((((d + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
}

/**
 * Steering response for a normalized cursor axis n ∈ [-1, 1]. Flat (0) inside
 * the central deadzone, then a signed power curve toward the edges: gentle just
 * past centre, strong near |n| = 1. Returns a factor in [-1, 1] scaled to a
 * rotation rate by the caller.
 */
function steerCurve(n: number): number {
  const a = Math.abs(n);
  if (a <= STEER_DEADZONE) return 0;
  const t = (a - STEER_DEADZONE) / (1 - STEER_DEADZONE);
  return Math.sign(n) * Math.pow(t, STEER_EXP);
}

function buildFromScene(scene: THREE.Object3D): THREE.BufferGeometry | null {
  scene.updateWorldMatrix(true, true);

  let mesh: THREE.Mesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!mesh && m.isMesh && m.geometry) mesh = m;
  });
  if (!mesh) return null;

  const target = mesh as THREE.Mesh;
  target.updateWorldMatrix(true, true);
  const sampler = new MeshSurfaceSampler(target).build();
  const world = target.matrixWorld;

  // Sample one big uniform pool: the first COUNT are the always-visible base,
  // the remaining EXTRA_POOL are candidate "extra" particles that only survive
  // if they land inside a zone (with a feathered radial keep-probability).
  const TOTAL = COUNT + EXTRA_POOL;
  const raw = new Float32Array(TOTAL * 3);
  const temp = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let i = 0; i < TOTAL; i++) {
    sampler.sample(temp);
    temp.applyMatrix4(world);
    raw[i * 3] = temp.x;
    raw[i * 3 + 1] = temp.y;
    raw[i * 3 + 2] = temp.z;
    box.expandByPoint(temp);
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = TARGET_SIZE / (Math.max(size.x, size.y, size.z) || 1);

  // First pass: decide which of the TOTAL samples we keep, and their zone.
  // Base samples are always kept with zone = -1.
  const keptX: number[] = [];
  const keptY: number[] = [];
  const keptZ: number[] = [];
  const keptZone: number[] = [];
  const v = new THREE.Vector3();

  for (let i = 0; i < TOTAL; i++) {
    const x = (raw[i * 3] - center.x) * scale;
    const y = (raw[i * 3 + 1] - center.y) * scale;
    const z = (raw[i * 3 + 2] - center.z) * scale;

    if (i < COUNT) {
      keptX.push(x);
      keptY.push(y);
      keptZ.push(z);
      keptZone.push(-1);
      continue;
    }

    // Extra candidate: keep with a soft radial probability inside a zone.
    v.set(x, y, z);
    const { zone, prob } = zoneKeep(v);
    if (zone >= 0 && Math.random() < prob) {
      keptX.push(x);
      keptY.push(y);
      keptZ.push(z);
      keptZone.push(zone);
    }
  }

  const n = keptX.length;
  const positions = new Float32Array(n * 3);
  const scatter = new Float32Array(n * 3);
  const zoneAttr = new Float32Array(n);
  const seed = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const x = keptX[i];
    const y = keptY[i];
    const z = keptZ[i];
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    zoneAttr[i] = keptZone[i];
    seed[i] = Math.random();

    // Entrance scatter — every particle (base + extra) so an activating zone
    // never looks alien during the page-load fly-in.
    const len = Math.hypot(x, y, z) || 1;
    const s = 2.4 + Math.random() * 1.6;
    scatter[i * 3] = (x / len) * s;
    scatter[i * 3 + 1] = (y / len) * s;
    scatter[i * 3 + 2] = (z / len) * s;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aZone", new THREE.BufferAttribute(zoneAttr, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  return geo;
}

// GLSL ES 1.00 note: a uniform array cannot be dynamically indexed by a
// varying-derived value, but it CAN be indexed by a for-loop induction variable
// whose bounds are a compile-time constant (`MAX_ZONES` is a #define). That is
// the portable pattern used below (works on ANGLE/Safari). Base particles
// (aZone === -1) short-circuit to 1.0 and never touch the array.
const VERT = /* glsl */ `
  #define MAX_ZONES 8
  uniform float uTime;
  uniform float uEntrance;
  uniform float uZoneAlpha[MAX_ZONES]; // per-zone visibility 0..1 (lerped on the CPU)
  uniform float uSize;
  attribute vec3 aScatter;
  attribute float aZone; // -1 = base (always visible), 0..MAX_ZONES-1 = extra zone id
  attribute float aSeed;
  varying float vSeed;
  varying float vZoneAlpha;

  void main() {
    vSeed = aSeed;
    // Base particles are always visible; extras follow their zone's alpha.
    float za = 1.0;
    if (aZone > -0.5) {
      za = 0.0;
      for (int i = 0; i < MAX_ZONES; i++) {
        if (abs(aZone - float(i)) < 0.5) za = uZoneAlpha[i];
      }
    }
    vZoneAlpha = za;

    float e = smoothstep(0.0, 1.0, uEntrance);
    vec3 pos = mix(aScatter, position, e);
    float shimmer = sin(uTime * 1.2 + aSeed * 6.2831) * 0.012;
    pos += normalize(position) * shimmer * e;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    // ~4px points at the framing distance, scaled by distance for depth.
    // Identical sizing for base and extras — the zone stands out by density only.
    gl_PointSize = uSize * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vSeed;
  varying float vZoneAlpha;

  void main() {
    if (vZoneAlpha <= 0.001) discard; // fully-faded extras cost nothing
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.12, d);
    // Same colour treatment for every particle — highlighted extras are
    // visually identical to the base; the zone reads purely as extra density.
    vec3 col = mix(uColorA, uColorB, vSeed * 0.15);
    gl_FragColor = vec4(col, alpha * uOpacity * vZoneAlpha);
  }
`;

export function ParticleHead() {
  const pointsRef = useRef<THREE.Points>(null);
  const entrance = useRef(0);

  // Explore-mode animation state (persist across frames, no re-render).
  const exploreWeight = useRef(0);
  // Accumulated steering offsets from the explore pose. Yaw integrates freely
  // (you can spin the head all the way around to reach any surrounding zone);
  // pitch is clamped to PITCH_LIMIT.
  const steerYaw = useRef(0);
  const steerPitch = useRef(0);
  // Eased idle-spin velocity (rad/s): ramps up from 0 when the turntable starts
  // so the head accelerates smoothly instead of snapping to full speed.
  const idleSpin = useRef(0);

  const { camera, size } = useThree();

  // Preallocated scratch so the per-frame projector allocates nothing.
  const scratch = useMemo(
    () => ({
      camRight: new THREE.Vector3(),
      center: new THREE.Vector3(),
      edge: new THREE.Vector3(),
      ndc: new THREE.Vector3(),
      normal: new THREE.Vector3(),
    }),
    []
  );
  const debugTargets = useMemo(() => new Array(ZONE_COUNT).fill(0) as number[], []);

  const { scene } = useGLTF(MODEL_URL);
  const geometry = useMemo(() => buildFromScene(scene), [scene]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uEntrance: { value: 0 },
          uZoneAlpha: { value: new Float32Array(MAX_ZONES) },
          uSize: { value: 2.4 },
          uOpacity: { value: 0.72 },
          uColorA: { value: new THREE.Color("#6792b1") },
          uColorB: { value: new THREE.Color("#739abe") },
        },
      }),
    []
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const pts = pointsRef.current;
    if (!pts) return;

    const u = material.uniforms;
    u.uTime.value += dt;
    entrance.current = Math.min(1, entrance.current + dt / 1.6);
    u.uEntrance.value = entrance.current;

    // `rotationProgress` drives the head's scroll rotation. It equals overall
    // scroll progress everywhere EXCEPT the Work section, where it freezes (and
    // resumes from the same value on exit) so the head's rotation pauses while
    // the mouse steers it and rejoins scroll seamlessly in either direction.
    const { zoneAlphas, rotationProgress } = useScrollStore.getState();
    const interaction = useInteractionStore.getState();
    const { exploreTarget, cursor, stageRect, activeZone, hoverLock, idleActive } =
      interaction;
    // Freeze head rotation while a zone is focused (panel up) or the cursor is
    // over the panel, so the user can travel to the panel and click without the
    // head steering away to a different zone. Steering resumes once the cursor
    // returns to neutral space (activeZone back to -1).
    //
    // Idle is the exception: the director sets `activeZone` to the front-most
    // idle zone (for Phase 4) with `idleActive` true, but idle must NOT freeze
    // steering — the turntable spins and any input hands straight back to the
    // user. So exclude the idle-owned activeZone from the freeze.
    const steerFrozen = hoverLock || (activeZone >= 0 && !idleActive);

    // --- Zone alpha smoothing (per-zone loop over the uniform array) ---------
    // The glow's ALPHA SOURCE is scrollStore.zoneAlphas (written by the
    // interaction director). Track it nearly 1:1 with a tiny framerate-
    // independent exponential smoothing purely to avoid inter-frame micro-steps.
    const za = u.uZoneAlpha.value as Float32Array;
    const kFade = 1 - Math.exp(-dt / ZONE_SMOOTH_TAU);
    let targets: number[] = zoneAlphas;
    if (DEBUG_ZONE_ALPHA_CYCLE) {
      const active = Math.floor(u.uTime.value / DEBUG_CYCLE_PERIOD) % ZONE_COUNT;
      for (let i = 0; i < ZONE_COUNT; i++) debugTargets[i] = i === active ? 1 : 0;
      targets = debugTargets;
    }
    for (let i = 0; i < ZONE_COUNT; i++) {
      za[i] += ((targets[i] ?? 0) - za[i]) * kFade;
    }

    // --- Explore weight (scroll ↔ cursor blend) ------------------------------
    const engageK = Math.min(1, dt * EXPLORE_ENGAGE_K);
    let w = exploreWeight.current + (exploreTarget - exploreWeight.current) * engageK;
    // Snap to the endpoints so the OFF-explore path can be byte-identical (w
    // reaches EXACTLY 0) and the ON-explore pose fully settles.
    if (exploreTarget === 0 && w < 1e-4) w = 0;
    else if (exploreTarget === 1 && w > 1 - 1e-4) w = 1;
    exploreWeight.current = w;
    interaction.exploreWeight = w; // publish (non-reactive) for the director

    // --- Cursor STEERING: distance-from-centre → rotation VELOCITY -----------
    // Near the stage centre the head barely turns (stable region to hover/click
    // a facing zone); toward the edges it rotates that direction so you can spin
    // the head to bring any surrounding zone to the front. Reset to the explore
    // pose while fully disengaged so each re-entry starts front-facing.
    if (exploreWeight.current <= 0) {
      steerYaw.current = 0;
      steerPitch.current = 0;
      // Collapse any whole turns the steering accumulated into rotation.y down to
      // the 2π-equivalent nearest the scroll pose. This is invisible (a multiple
      // of 2π) but means when scroll takes back over, the head returns the SHORT
      // way instead of rapidly unwinding every spin the user made. Only touches
      // rotation.y when there is an actual multi-turn offset (never in pure
      // scroll, so hero/about/contact stay byte-identical).
      const scrollYaw0 = ROT_OFFSET_Y - rotationProgress * TWO_PI;
      const nearest = scrollYaw0 + shortestArc(scrollYaw0, pts.rotation.y);
      if (Math.abs(nearest - pts.rotation.y) > 1e-6) pts.rotation.y = nearest;
    } else {
      // Idle turntable: while the director says idle is active (and steering is
      // not frozen), integrate a slow auto-yaw into the SAME steerYaw accumulator
      // the cursor uses. When the user takes over, steering continues seamlessly
      // from this angle — no snap, no reset. HeadLayer routes reduced-motion /
      // small viewports to the static fallback, so this never runs for them.
      // Ease the idle spin IN from a standstill (no velocity snap); cut it
      // instantly when idle ends so the user's own steering takes over cleanly.
      const idleTarget = idleActive && !steerFrozen ? IDLE_SPIN_RATE : 0;
      if (idleTarget > idleSpin.current) {
        idleSpin.current +=
          (idleTarget - idleSpin.current) * (1 - Math.exp(-dt / IDLE_SPIN_RAMP_TAU));
      } else {
        idleSpin.current = idleTarget;
      }
      steerYaw.current += idleSpin.current * dt;
      // Cursor STEERING: distance-from-centre → rotation velocity. Runs
      // alongside idle so the handback is immediate (idle spin + user steer share
      // steerYaw). cursor.inside === false → no velocity, head holds its angle.
      if (!steerFrozen && cursor.inside && stageRect.w > 0 && stageRect.h > 0) {
        const nx = clamp(((cursor.x - stageRect.x) / stageRect.w) * 2 - 1, -1, 1);
        const ny = clamp(((cursor.y - stageRect.y) / stageRect.h) * 2 - 1, -1, 1);
        const yawVel = -steerCurve(nx) * YAW_RATE_MAX; // reversed: cursor left/right
        const pitchVel = steerCurve(ny) * PITCH_RATE_MAX;
        steerYaw.current += yawVel * dt; // integrates freely — full turn reachable
        steerPitch.current = clamp(
          steerPitch.current + pitchVel * dt,
          -PITCH_LIMIT,
          PITCH_LIMIT
        );
      }
    }

    // --- Head pose -----------------------------------------------------------
    if (exploreWeight.current <= 0) {
      // Scroll path (drives hero/about/contact and the frozen-through-Work pose).
      // Guaranteed reachable because w snaps to exactly 0 above whenever
      // exploreTarget === 0. Uses rotationProgress, which == raw progress outside
      // Work, so those sections are unchanged.
      const targetYaw = ROT_OFFSET_Y - rotationProgress * TWO_PI;
      const bump = Math.sin(Math.PI * rotationProgress);
      const targetPitch = ROT_OFFSET_X + bump * RISE_PITCH;
      const targetY = -bump * RISE_DROP;

      const k = Math.min(1, dt * POSE_LERP_K);
      pts.rotation.y += (targetYaw - pts.rotation.y) * k;
      pts.rotation.x += (targetPitch - pts.rotation.x) * k;
      pts.position.y += (targetY - pts.position.y) * k;
    } else {
      // Blended explore path. The scroll pose is driven by rotationProgress,
      // which FREEZES while Work is engaged — so scrollYaw/pitch/posY hold at the
      // exact angle the head arrived with. Explore mode then just adds the mouse-
      // steering offset on top (gated by wEase). Because the FROZEN scroll pose
      // is the base, there is nothing to scrub on entry OR exit in either scroll
      // direction: the head keeps its current rotation and the cursor takes over.
      const scrollYaw = ROT_OFFSET_Y - rotationProgress * TWO_PI;
      const bump = Math.sin(Math.PI * rotationProgress);
      const scrollPitch = ROT_OFFSET_X + bump * RISE_PITCH;
      const scrollPosY = -bump * RISE_DROP;

      // Explore pose = frozen scroll pose + accumulated steering.
      const exploreYawBase = scrollYaw + EXPLORE_POSE_YAW_OFFSET + steerYaw.current;
      const explorePitch = scrollPitch + steerPitch.current;

      const wEase = easeInOut(exploreWeight.current);
      // Yaw blends via SHORTEST ARC anchored at scrollYaw; with the base being
      // the frozen scroll pose this only ever applies the steering offset (0 at
      // the boundaries → seamless). pitch is a plain lerp of the steer offset;
      // posY holds the frozen scroll value (no vertical recenter → no jump).
      const yawTarget = scrollYaw + shortestArc(scrollYaw, exploreYawBase) * wEase;
      const pitchTarget = scrollPitch + (explorePitch - scrollPitch) * wEase;
      const posYTarget = scrollPosY;

      const k = Math.min(1, dt * POSE_LERP_K);
      // Drive toward the 2π-equivalent of yawTarget NEAREST the head's current
      // orientation. yawTarget itself can jump by 2π when scrollYaw crosses the
      // front pose's antipode (the shortest-arc sign flips); anchoring the step
      // to rotation.y cancels those jumps so the head never suddenly whips a
      // full turn while scrolling through the pinned section.
      const yawStep = shortestArc(pts.rotation.y, yawTarget);
      pts.rotation.y += yawStep * k;
      pts.rotation.x += (pitchTarget - pts.rotation.x) * k;
      pts.position.y += (posYTarget - pts.position.y) * k;
    }

    // --- ZoneProjector: per-zone screen position + rEdgePx + facing ----------
    // Refresh the world matrix now so projection reflects THIS frame's pose
    // (R3F would otherwise only update it just before render). Zero allocations:
    // all vectors are preallocated scratch; results mutate zoneScreen in place.
    pts.updateMatrixWorld();
    scratch.camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const zs = interaction.zoneScreen;
    const halfW = size.width * 0.5;
    const halfH = size.height * 0.5;
    for (let i = 0; i < ZONE_COUNT; i++) {
      const zone = ZONES[i];
      scratch.center.copy(zone).applyMatrix4(pts.matrixWorld);
      scratch.edge.copy(scratch.center).addScaledVector(scratch.camRight, ZONE_EDGE_RADIUS);

      scratch.ndc.copy(scratch.center).project(camera);
      const cx = (scratch.ndc.x + 1) * halfW;
      const cy = (1 - scratch.ndc.y) * halfH;

      scratch.ndc.copy(scratch.edge).project(camera);
      const ex = (scratch.ndc.x + 1) * halfW;
      const ey = (1 - scratch.ndc.y) * halfH;

      // Facing: outward zone normal (≈ normalize(zonePos)) rotated by the head,
      // transformed into view space; z>0 means it faces the camera.
      scratch.normal.copy(zone).normalize().applyQuaternion(pts.quaternion);
      scratch.normal.transformDirection(camera.matrixWorldInverse);

      const t = zs[i];
      t.x = cx;
      t.y = cy;
      t.rEdgePx = Math.hypot(ex - cx, ey - cy);
      t.facing = scratch.normal.z;
    }
  });

  if (!geometry) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      rotation={[ROT_OFFSET_X, ROT_OFFSET_Y, 0]}
    />
  );
}

useGLTF.preload(MODEL_URL);
