/**
 * Project data model + content.
 *
 * Extracted from the old `PinnedProjects.tsx` (which exported the `Project`
 * type) and `Projects.tsx` (which held the `PROJECTS` array), so the data is
 * importable without pulling in any component/scroll-choreography code.
 *
 * `zone` replaces the old `PROJECT_ZONE` string-keyed record in
 * `src/lib/regions.ts` (that map is deleted in a later phase, see the
 * interactive-head implementation plan §6/§8) — each project now carries its
 * own zone index directly (01 -> 0, 02 -> 1, 03 -> 2, 04 -> 3, matching the
 * current `PROJECT_ZONE` mapping).
 *
 * `linkStatus`/`href` back the future project panel's link vs. "coming soon"
 * treatment: all four current projects are `"coming-soon"` until Arvin
 * supplies real links.
 */
export interface Project {
  index: string;
  year: string;
  pre?: string;
  accent: string;
  post?: string;
  tagline: string;
  description: string;
  metrics: { value: string; label: string }[];
  stack: string[];
  status: "Live" | "Case Study" | "In Development";
  zone: number; // index into ZONES (src/lib/regions.ts)
  href?: string; // GitHub/demo — set once linkStatus is "live"
  linkStatus: "live" | "coming-soon";
}

export const PROJECTS: Project[] = [
  {
    index: "01",
    year: "2026",
    pre: "Volleyball",
    accent: "Tracker",
    tagline: "Real-time computer vision for sports analytics",
    description:
      "Built an end-to-end computer vision pipeline using YOLOv8 + ByteTrack for player and ball tracking, paired with a FastAPI + React full-stack video system delivering frame-accurate analytics in real time.",
    metrics: [
      { value: "87.9%", label: "Detection Precision" },
      { value: "<50ms", label: "Per-frame Latency" },
      { value: "Full-Stack", label: "End-to-End System" },
    ],
    stack: ["YOLOv8", "ByteTrack", "FastAPI", "React", "OpenCV", "PyTorch"],
    status: "In Development",
    zone: 0,
    linkStatus: "coming-soon",
  },
  {
    index: "02",
    year: "2026",
    accent: "Smart",
    post: "Parking",
    tagline: "Distributed FastAPI services with real-time occupancy",
    description:
      "Engineered a distributed smart-parking platform as three FastAPI microservices with a React frontend, IoT-driven occupancy simulation, and a PostgreSQL-backed reservation system using license-plate + one-time-password authentication.",
    metrics: [
      { value: "3", label: "FastAPI Services" },
      { value: "Real-time", label: "IoT Simulation" },
      { value: "PostgreSQL", label: "Persistent Layer" },
    ],
    stack: ["Python", "FastAPI", "React", "PostgreSQL", "Uvicorn", "Microservices"],
    status: "Case Study",
    zone: 1,
    linkStatus: "coming-soon",
  },
  {
    index: "03",
    year: "2025",
    pre: "Facial",
    accent: "Merging",
    tagline: "Face-landmark pipeline with an interactive web UI",
    description:
      "Built a facial-merging pipeline on the LFW dataset using dlib landmarks, OpenCV warping, and TensorFlow, exposed through both a Jupyter workflow for experimentation and a Gradio web UI for interactive merging in the browser.",
    metrics: [
      { value: "dlib", label: "Face Landmarks" },
      { value: "Gradio", label: "Web UI" },
      { value: "LFW", label: "Dataset" },
    ],
    stack: ["Python", "dlib", "OpenCV", "TensorFlow", "Gradio", "Jupyter"],
    status: "Live",
    zone: 2,
    linkStatus: "coming-soon",
  },
  {
    index: "04",
    year: "2026",
    pre: "Next",
    accent: "Project",
    tagline: "Something new in the works",
    description:
      "A placeholder for the next build — this space is reserved for an upcoming project. Real scope, stack, and results will land here soon; for now it holds the slot so the fourth zone lights up.",
    metrics: [
      { value: "TBD", label: "Scope" },
      { value: "Soon", label: "Timeline" },
      { value: "WIP", label: "Status" },
    ],
    stack: ["Coming", "Soon", "Stay", "Tuned"],
    status: "In Development",
    zone: 3,
    linkStatus: "coming-soon",
  },
];
