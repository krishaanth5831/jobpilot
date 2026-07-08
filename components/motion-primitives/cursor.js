"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { useMediaQuery } from "@/components/use-mounted";

// A trailing cursor dot (mix-blend-difference, so it stays monochrome on
// any background). Landing page only; disabled for touch and
// reduced-motion users. The native cursor stays visible.
export function Cursor({ size = 12 }) {
  const reduced = useReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const [active, setActive] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 250, damping: 22 });
  const springY = useSpring(y, { stiffness: 250, damping: 22 });

  useEffect(() => {
    if (reduced || !finePointer) return;
    function onMove(event) {
      x.set(event.clientX - size / 2);
      y.set(event.clientY - size / 2);
      setActive(true);
    }
    const onLeave = () => setActive(false);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced, finePointer, size, x, y]);

  if (reduced || !finePointer) return null;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[60] rounded-full bg-white mix-blend-difference"
      style={{ width: size, height: size, x: springX, y: springY, opacity: active ? 1 : 0 }}
      aria-hidden="true"
    />
  );
}
