"use client";

import { motion, useScroll, useSpring } from "motion/react";

// Hairline reading-progress bar fixed to the top of the viewport.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 300, damping: 40 });

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 h-px origin-left bg-neutral-950 dark:bg-white"
      style={{ scaleX }}
      aria-hidden="true"
    />
  );
}
