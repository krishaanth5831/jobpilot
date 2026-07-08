"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Cycles through a list of strings with an up-and-out transition.
export function TextLoop({ children, className, interval = 2.4 }) {
  const items = Array.isArray(children) ? children : [children];
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      interval * 1000
    );
    return () => clearInterval(id);
  }, [items.length, interval]);

  return (
    <span className={`relative inline-block align-bottom ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          className="inline-block whitespace-nowrap"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16, filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {items[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
