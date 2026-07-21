"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useInteractionStore } from "@/lib/interactionStore";
import {
  PANEL_ENTER_DURATION,
  PANEL_EXIT_DURATION,
  PANEL_TRANSLATE_PX,
  PANEL_CONTENT_OUT_DURATION,
  PANEL_CONTENT_IN_DURATION,
  PANEL_SIDE_MIN_STAGE_WIDTH,
} from "@/lib/interactionTuning";
import type { Project } from "@/lib/projectsData";

/** Matches the site's `--ease-out-expo` (Reveal.tsx uses the same array). */
const EASE_OUT_EXPO: [number, number, number, number] = [0.19, 1, 0.22, 1];

type Side = "left" | "right" | "bottom";

/**
 * ProjectPanel — the side panel that surfaces a project's content next to the
 * particle head (implementation plan §5.2, ticket P2-1).
 *
 * - Subscribes reactively to `interactionStore.activeZone` AND `activeSource`;
 *   resolves the project whose `zone` matches. Hidden (faded out) when
 *   `activeZone === -1`, no project claims that zone, OR the active source is
 *   not a user focus. The idle turntable (Phase 3) sets `activeZone` to the
 *   front-most idle zone with source `"idle"` for orbit terms to use, but the
 *   panel must stay CLOSED during idle — so only `"hover"`/`"tap"` open it.
 * - Side placement is computed ONCE per activation (when `activeZone` changes
 *   to a new value) from `zoneScreen[activeZone].x` at that instant, and
 *   frozen for as long as that same zone stays active — it does NOT track the
 *   zone's screen position while the head keeps turning under a held hover.
 *   Small-viewport fallback: bottom-anchored overlay when the stage can't fit
 *   panel + margin beside the head.
 * - Two nested AnimatePresence layers: the outer controls whole-panel
 *   mount/unmount (opacity + 12px translate, 300ms in / 200ms out) for the
 *   hidden <-> visible transition; the inner is keyed by the active project's
 *   zone and cross-fades content (150ms out / 200ms in) when the user moves
 *   directly from one zone to another without the panel ever fully hiding.
 */
export function ProjectPanel({ projects }: { projects: Project[] }) {
  const activeZone = useInteractionStore((s) => s.activeZone);
  const activeSource = useInteractionStore((s) => s.activeSource);
  // Only a user focus (hover / tap) opens the panel. "idle" and "none" keep it
  // closed, even though idle still publishes a front-most activeZone.
  const panelVisible = activeSource === "hover" || activeSource === "tap";
  const active =
    panelVisible && activeZone !== -1
      ? projects.find((p) => p.zone === activeZone)
      : undefined;

  const [side, setSide] = useState<Side>("right");

  // Freeze-side rule: recompute ONLY when the panel becomes visible for a zone
  // (an "activation") — gated on `panelVisible` so idle-source activeZone
  // changes (panel hidden) never compute a side, and a real hover activation on
  // the same zone idle was cueing still recomputes (panelVisible flips false→
  // true). Reading zoneScreen/stageRect here — not in render — means later
  // frames of the same held hover (where zoneScreen keeps updating as the head
  // rotates) never re-trigger this effect.
  useEffect(() => {
    if (!panelVisible || activeZone === -1) {
      // No user-focused zone → make sure the panel hover-lock is released.
      useInteractionStore.getState().setHoverLock(false);
      return;
    }
    const { zoneScreen, stageRect } = useInteractionStore.getState();
    const zs = zoneScreen[activeZone];
    const stageMidX = stageRect.x + stageRect.w / 2;
    const onLeftHalf = (zs?.x ?? stageMidX) < stageMidX;
    const fitsSide = stageRect.w >= PANEL_SIDE_MIN_STAGE_WIDTH;
    setSide(!fitsSide ? "bottom" : onLeftHalf ? "right" : "left");
  }, [activeZone, panelVisible]);

  // Panel hover-lock: while the cursor is over the panel, freeze head steering
  // and latch the active zone (see interactionStore.hoverLock) so the user can
  // click without the head rotating away.
  const lockOn = () => useInteractionStore.getState().setHoverLock(true);
  const lockOff = () => useInteractionStore.getState().setHoverLock(false);

  return (
    <div className={wrapperClass(side)}>
      <AnimatePresence>
        {active && (
          <motion.div
            key="panel"
            onPointerEnter={lockOn}
            onPointerLeave={lockOff}
            initial={{ opacity: 0, y: PANEL_TRANSLATE_PX }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: PANEL_ENTER_DURATION, ease: EASE_OUT_EXPO },
            }}
            exit={{
              opacity: 0,
              y: PANEL_TRANSLATE_PX,
              transition: { duration: PANEL_EXIT_DURATION, ease: EASE_OUT_EXPO },
            }}
            className={panelBoxClass(side)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <PanelContent key={active.zone} project={active} />
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function wrapperClass(side: Side): string {
  // Larger horizontal insets on wider screens pull the panel in toward the
  // middle of the stage (closer to the head) instead of hugging the edge.
  const base =
    "pointer-events-none absolute inset-0 z-30 flex px-6 md:px-12 lg:px-[8vw] xl:px-[11vw]";
  if (side === "left") return `${base} items-center justify-start`;
  if (side === "right") return `${base} items-center justify-end`;
  return `${base} items-end justify-center pb-8 md:pb-12`;
}

function panelBoxClass(side: Side): string {
  return side === "bottom"
    ? "pointer-events-auto w-full max-w-[560px]"
    : "pointer-events-auto w-[clamp(320px,28vw,460px)]";
}

function PanelContent({ project }: { project: Project }) {
  const isLive = project.linkStatus === "live" && Boolean(project.href);

  const inner = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-onyx-deep/70 border border-white/10 text-[10px] uppercase tracking-[0.22em] text-mute">
          <span className="pulse-dot" />
          {project.status}
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
          <span>{project.index}</span>
          <span className="h-px w-4 bg-mute/40" />
          <span>{project.year}</span>
        </div>
      </div>

      <h3 className="mt-6 text-3xl md:text-4xl leading-[0.95] tracking-[-0.03em] font-light">
        {project.pre && <>{project.pre} </>}
        <span className="font-serif italic text-turquoise">{project.accent}</span>
        {project.post && <> {project.post}</>}
      </h3>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {project.tagline}
      </p>

      <p className="mt-4 text-sm md:text-[15px] text-smoke-dim leading-[1.6]">
        {project.description}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {project.metrics.map((m) => (
          <div key={m.label} className="border-l border-white/10 pl-2.5">
            <div className="font-serif italic text-lg md:text-xl text-smoke">{m.value}</div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-mute leading-tight">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {project.stack.map((tech) => (
          <span
            key={tech}
            className="px-3 py-1 rounded-pill border border-white/10 text-[10px] uppercase tracking-[0.16em] text-mute"
          >
            {tech}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-center border-t border-white/10 pt-5">
        {isLive ? (
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-turquoise">
            View project
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <path
                d="M3 9L9 3M9 3H4M9 3V8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill border border-white/10 text-[11px] uppercase tracking-[0.18em] text-mute">
            <span className="pulse-dot" />
            Link coming soon
          </span>
        )}
      </div>
    </>
  );

  const crossfadeProps = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: PANEL_CONTENT_IN_DURATION, ease: EASE_OUT_EXPO },
    },
    exit: {
      opacity: 0,
      transition: { duration: PANEL_CONTENT_OUT_DURATION, ease: EASE_OUT_EXPO },
    },
    className:
      "block rounded-card border border-white/10 bg-onyx-deep/85 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-black/40 transition-colors",
  };

  if (isLive) {
    return (
      <motion.a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        {...crossfadeProps}
        className={`${crossfadeProps.className} cursor-pointer hover:border-turquoise/30`}
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.div {...crossfadeProps} className={`${crossfadeProps.className} cursor-default`}>
      {inner}
    </motion.div>
  );
}
