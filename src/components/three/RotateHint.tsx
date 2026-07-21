"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useInteractionStore } from "@/lib/interactionStore";
import { EXPLORE_INERT_THRESHOLD } from "@/lib/interactionTuning";

/**
 * RotateHint — soft particle chevrons ‹  › flanking the head that cue the user
 * to rotate it. Built from the SAME additive round-point look as ParticleHead so
 * it reads as part of the same system. It is a SEPARATE points object (it does
 * not rotate with the head), positioned beside the head in world space.
 *
 * Lifecycle:
 *  - Invisible outside the Work section; fades in with `exploreWeight`.
 *  - Gently "breathes" outward (uPulse) and twinkles.
 *  - Dismisses (fades out, permanently for the visit) once the user moves the
 *    cursor enough to have started interacting; re-arms next time Work is entered
 *    (exploreWeight drops below the inert threshold on exit).
 */

// Placement / feel constants (self-contained visual cue).
const CHEVRON_CX = 1.55; // |x| offset of each chevron from head centre (world units)
const ARM_HALF_H = 0.13; // chevron arm vertical half-extent (small)
const VERTEX_OUT = 0.075; // how far the chevron point sits outward from its centre
const ARM_IN = 0.05; // how far the arm ends sit inward (toward the head)
const PER_ARM = 20; // particles per arm (denser → fills the thicker stroke)
const HINT_PULSE_SPEED = 2.2; // breathing speed
const HINT_PULSE_AMP = 0.09; // outward breathing amplitude (world units)
const HINT_BASE_OPACITY = 0.9;
const HINT_MOVE_DISMISS = 130; // px of cursor travel in Work before the cue dismisses

function buildChevrons(): THREE.BufferGeometry {
  const pos: number[] = [];
  const dir: number[] = [];
  const seed: number[] = [];
  // Left chevron (s=-1, points ‹) and right chevron (s=+1, points ›).
  for (const s of [-1, 1]) {
    const cx = s * CHEVRON_CX;
    const vx = cx + s * VERTEX_OUT; // vertex sits outward
    const ax = cx - s * ARM_IN; // arm ends sit inward (toward head)
    for (const endY of [ARM_HALF_H, -ARM_HALF_H]) {
      for (let i = 0; i < PER_ARM; i++) {
        const t = i / (PER_ARM - 1);
        pos.push(vx + (ax - vx) * t, endY * t, 0);
        dir.push(s, 0, 0); // outward horizontal direction (for the breathing offset)
        seed.push(Math.random());
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aDir", new THREE.BufferAttribute(new Float32Array(dir), 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seed), 1));
  return g;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  uniform float uSize;
  attribute vec3 aDir;
  attribute float aSeed;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position + aDir * uPulse;
    p += aDir * sin(uTime * 2.0 + aSeed * 6.2831) * 0.008; // subtle twinkle
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vSeed;
  void main() {
    if (uOpacity <= 0.001) discard;
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d);
    vec3 col = mix(uColorA, uColorB, vSeed);
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

export function RotateHint() {
  const geometry = useMemo(() => buildChevrons(), []);
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
          uPulse: { value: 0 },
          uSize: { value: 3.6 },
          uOpacity: { value: 0 },
          // Match the head's particle palette (ParticleHead uColorA/uColorB).
          uColorA: { value: new THREE.Color("#6792b1") },
          uColorB: { value: new THREE.Color("#739abe") },
        },
      }),
    []
  );

  const dismissed = useRef(false);
  const moveAccum = useRef(0);
  const prevCursor = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const u = material.uniforms;
    u.uTime.value += dt;

    const { exploreWeight, cursor } = useInteractionStore.getState();

    if (exploreWeight < EXPLORE_INERT_THRESHOLD) {
      // Outside Work — hidden and re-armed for next entry.
      dismissed.current = false;
      moveAccum.current = 0;
      prevCursor.current.x = cursor.x;
      prevCursor.current.y = cursor.y;
    } else {
      const dx = cursor.x - prevCursor.current.x;
      const dy = cursor.y - prevCursor.current.y;
      prevCursor.current.x = cursor.x;
      prevCursor.current.y = cursor.y;
      if (cursor.inside) moveAccum.current += Math.hypot(dx, dy);
      if (moveAccum.current > HINT_MOVE_DISMISS) dismissed.current = true;
    }

    const pulse = 0.5 + 0.5 * Math.sin(u.uTime.value * HINT_PULSE_SPEED);
    u.uPulse.value = pulse * HINT_PULSE_AMP;

    const target = dismissed.current
      ? 0
      : exploreWeight * (0.4 + 0.6 * pulse) * HINT_BASE_OPACITY;
    u.uOpacity.value += (target - u.uOpacity.value) * Math.min(1, dt * 6);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
