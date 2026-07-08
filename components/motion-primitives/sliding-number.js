"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Each digit slides vertically when it changes.
export function SlidingNumber({ value, className }) {
  const reduced = useReducedMotion();
  const digits = String(value).split("");

  if (reduced) {
    return <span className={`font-mono tabular-nums ${className ?? ""}`}>{value}</span>;
  }

  return (
    <span className={`inline-flex font-mono tabular-nums ${className ?? ""}`}>
      {digits.map((digit, i) => (
        <span key={i} className="relative inline-block overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={digit}
              className="inline-block"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
