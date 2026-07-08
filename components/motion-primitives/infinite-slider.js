"use client";

import { motion, useReducedMotion } from "motion/react";

// Seamless marquee: renders children twice and translates -50%.
export function InfiniteSlider({ children, className, duration = 24, gap = 48 }) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={`flex flex-wrap justify-center ${className ?? ""}`} style={{ gap }}>
        {children}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className ?? ""}`}>
      <motion.div
        className="flex w-max"
        style={{ gap }}
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        <div className="flex shrink-0 items-center" style={{ gap }}>
          {children}
        </div>
        <div className="flex shrink-0 items-center" style={{ gap }} aria-hidden="true">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
