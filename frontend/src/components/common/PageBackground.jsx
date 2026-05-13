import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

// ── Center glow ───────────────────────────────────────────────────────────────

export function CenterGlow() {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className="pointer-events-none fixed inset-0"
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 50%, oklch(0.635 0.167 228 / 0.07) 0%, transparent 100%)",
      }}
      animate={shouldReduce ? {} : { opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Dot grid ──────────────────────────────────────────────────────────────────

export function DotGridBackground() {
  const shouldReduce = useReducedMotion();
  const { resolvedTheme } = useTheme();

  const dotColor =
    resolvedTheme === "dark"
      ? "oklch(0.635 0.167 228 / 0.28)"
      : "oklch(0.635 0.167 228 / 0.18)";

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }}
      animate={shouldReduce ? {} : { opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Grain overlay ─────────────────────────────────────────────────────────────

const NOISE_SVG = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='300' height='300' filter='url(%23f)'/></svg>")`;

export function GrainOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundImage: NOISE_SVG, opacity: 0.1, mixBlendMode: "soft-light" }}
    />
  );
}
