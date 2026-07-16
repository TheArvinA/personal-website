"use client";

import { Canvas } from "@react-three/fiber";
import { ParticleHead } from "./ParticleHead";

/**
 * The WebGL canvas. Kept intentionally thin so it can be dynamically
 * imported with ssr:false from HeadLayer. No lights needed — the points
 * use an unlit additive shader.
 */
export default function HeadCanvas() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 3.6], fov: 38 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ParticleHead />
    </Canvas>
  );
}
