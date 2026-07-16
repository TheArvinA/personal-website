"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import * as THREE from "three";
import { useScrollStore } from "@/lib/scrollStore";
import { nearestRegion } from "@/lib/regions";

const MODEL_URL = "/head.glb";
const COUNT = 60000; // number of particles in model
const TARGET_SIZE = 1.8; // largest bbox dimension maps to this many world units

const TWO_PI = Math.PI * 2;

// Orientation fixups — tweak if the scan loads sideways/backwards/tilted.
const ROT_OFFSET_X = 0; // tilt (radians)
const ROT_OFFSET_Y = Math.PI / 2; // spin base; calibrated so progress 0 faces the camera (scan's nose points -X, Ry(+π/2) rotates it to +Z toward camera)

// "Rise at the back": bump peaks at progress 0.5, zero at 0 and 1.
const RISE_PITCH = 0.42; // forward tilt (radians) at the back
const RISE_DROP = 0.35; // downward y shift (world units) at the back

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

  const raw = new Float32Array(COUNT * 3);
  const temp = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let i = 0; i < COUNT; i++) {
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

  const positions = new Float32Array(COUNT * 3);
  const scatter = new Float32Array(COUNT * 3);
  const region = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  const v = new THREE.Vector3();

  for (let i = 0; i < COUNT; i++) {
    const x = (raw[i * 3] - center.x) * scale;
    const y = (raw[i * 3 + 1] - center.y) * scale;
    const z = (raw[i * 3 + 2] - center.z) * scale;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    v.set(x, y, z);
    region[i] = nearestRegion(v);
    seed[i] = Math.random();

    const len = Math.hypot(x, y, z) || 1;
    const s = 2.4 + Math.random() * 1.6;
    scatter[i * 3] = (x / len) * s;
    scatter[i * 3 + 1] = (y / len) * s;
    scatter[i * 3 + 2] = (z / len) * s;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aRegion", new THREE.BufferAttribute(region, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  return geo;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uEntrance;
  uniform float uActiveRegion;
  uniform float uSize;
  attribute vec3 aScatter;
  attribute float aRegion;
  attribute float aSeed;
  varying float vGlow;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    float e = smoothstep(0.0, 1.0, uEntrance);
    vec3 pos = mix(aScatter, position, e);
    float shimmer = sin(uTime * 1.2 + aSeed * 6.2831) * 0.012;
    pos += normalize(position) * shimmer * e;
    vGlow = (abs(aRegion - uActiveRegion) < 0.5) ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float glowBoost = 1.0 + vGlow * 0.9;
    // ~4px points at the framing distance, scaled by distance for depth.
    gl_PointSize = uSize * glowBoost * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vGlow;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.12, d);
    vec3 col = mix(uColorA, uColorB, vGlow * 0.85 + vSeed * 0.15);
    float brightness = 1.0 + vGlow * 1.6;
    gl_FragColor = vec4(col * brightness, alpha * uOpacity);
  }
`;

export function ParticleHead() {
  const pointsRef = useRef<THREE.Points>(null);
  const entrance = useRef(0);

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
          uActiveRegion: { value: -1 },
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

    const { activeRegion, progress } = useScrollStore.getState();
    u.uActiveRegion.value = activeRegion;

    // Continuous 360° turn driven purely by scroll: front (0) -> left profile
    // (0.25) -> back (0.5) -> right profile (0.75) -> front (1). Negative yaw
    // sends the nose to the viewer's left.
    const targetYaw = ROT_OFFSET_Y - progress * TWO_PI;
    // Bump that rises at the back of the turn: forward pitch + downward drop.
    const bump = M