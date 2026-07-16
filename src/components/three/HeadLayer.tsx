"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSectionObserver } from "@/hooks/useSectionObserver";

// Load the WebGL canvas client-side only (Three.js has no SSR).
const HeadCanvas = dynamic(() => import("./HeadCanvas"), { ssr: false });

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Fixed, behind-the-DOM 3D layer for the whole site.
 * Decides between the live particle head and a static fallback:
 * fallback when the viewport is small, reduced-motion is on, or WebGL is
 * unavailable — so the site is always fast and never breaks (ticket TA.6).
 */
export function HeadLayer() {
  // Section tracking runs regardless of render mode so the store stays warm.
  useSectionObserver();

  const [mode, setMode] = useState<"pending" | "3d" | "fallback">("pending");

  useEffect(() => {
    const decide = () => {
      const small = window.innerWidth < 768;
      if (small || prefersReducedMotion() || !webglAvailable()) {
        setMode("fallback");
      } else {
        setMode("3d");
      }
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    >
      {mode === "3d" && <HeadCanvas />}
      {mode === "fallback" && <StaticFallback />}
    </div>
  );
}

/**
 * Placeholder static background. Replace with an exported 3/4 particle-head
 * PNG at /head-fallback.png once the scene is dialed in (ticket TA.6):
 *   <img src="/head-fallback.png" alt="" className="h-full w-full object-cover opacity-70" />
 */
function StaticFallback() {
  return (
    <div
      className="h-full w-full"
      style={{
        background:
          "radial-gradient(closest-side at 50% 42%, rgba(64,224,208,0.16), rgba(64,224,208,0.05) 45%, transparent 70%)",
      }}
    />
  );
}
