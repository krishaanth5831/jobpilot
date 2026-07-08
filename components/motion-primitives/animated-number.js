"use client";

import { useEffect, useState } from "react";
import { useSpring, useReducedMotion } from "motion/react";

// Counts a number up/down with a spring. Renders in Geist Mono by default
// per the design system (scores, data).
export function AnimatedNumber({ value, className, springOptions }) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, springOptions ?? { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const unsubscribe = spring.on("change", (latest) =>
      setDisplay(Math.round(latest))
    );
    spring.set(value);
    return unsubscribe;
  }, [spring, value, reduced]);

  return (
    <span className={`font-mono tabular-nums ${className ?? ""}`}>
      {reduced ? Math.round(value) : display}
    </span>
  );
}
