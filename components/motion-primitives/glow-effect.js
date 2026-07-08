"use client";

import { motion } from "motion/react";

// A soft accent-gradient glow behind its parent — used only for live
// animation states (drag-over, AI in flight). Parent needs position:relative.
export function GlowEffect({ className, blur = 24, scale = 1.02, active = true }) {
  return (
    <motion.div
      className={`pointer-events-none absolute inset-0 -z-10 rounded-[inherit] ${className ?? ""}`}
      style={{ background: "var(--accent-gradient)", filter: `blur(${blur}px)` }}
      initial={{ opacity: 0 }}
      animate={
        active
          ? { opacity: [0.5, 0.9, 0.5], scale: [scale, scale * 1.01, scale] }
          : { opacity: 0 }
      }
      transition={{ duration: 2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
      aria-hidden="true"
    />
  );
}
