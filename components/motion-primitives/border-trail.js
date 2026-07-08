"use client";

import { motion } from "motion/react";

// A glowing segment traveling around the parent's border. This is an
// animation, so it uses the accent gradient — the one place color lives.
// Parent needs position:relative, overflow:hidden and a border radius.
export function BorderTrail({ className, size = 80, duration = 3 }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      aria-hidden="true"
    >
      <motion.div
        className={`absolute aspect-square ${className ?? ""}`}
        style={{
          width: size,
          background: "var(--accent-gradient)",
          borderRadius: "50%",
          filter: "blur(16px)",
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
        }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
