"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useMotionTemplate } from "motion/react";

// A cursor-following radial highlight inside its parent (parent needs
// position:relative and overflow:hidden). Monochrome — white or black glow.
export function Spotlight({ className, size = 240 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });
  const background = useMotionTemplate`radial-gradient(${size}px circle at ${springX}px ${springY}px, var(--foreground), transparent 70%)`;

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;

    function onPointerMove(event) {
      const rect = parent.getBoundingClientRect();
      x.set(event.clientX - rect.left);
      y.set(event.clientY - rect.top);
    }
    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);

    parent.addEventListener("pointermove", onPointerMove);
    parent.addEventListener("pointerenter", onEnter);
    parent.addEventListener("pointerleave", onLeave);
    return () => {
      parent.removeEventListener("pointermove", onPointerMove);
      parent.removeEventListener("pointerenter", onEnter);
      parent.removeEventListener("pointerleave", onLeave);
    };
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${className ?? ""}`}
      style={{ background, opacity: visible ? 0.06 : 0 }}
      aria-hidden="true"
    />
  );
}
