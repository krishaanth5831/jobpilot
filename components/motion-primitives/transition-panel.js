"use client";

import { AnimatePresence, motion } from "motion/react";

// Cross-fades between indexed panels (e.g. status states).
export function TransitionPanel({ activeIndex, children, className }) {
  const panels = Array.isArray(children) ? children : [children];

  return (
    <div className={`relative ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {panels[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
