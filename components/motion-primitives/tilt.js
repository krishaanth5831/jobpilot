"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

// Subtle 3D tilt toward the cursor.
export function Tilt({ children, className, rotationFactor = 3 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(
    useTransform(y, [0, 1], [rotationFactor, -rotationFactor]),
    { stiffness: 250, damping: 25 }
  );
  const rotateY = useSpring(
    useTransform(x, [0, 1], [-rotationFactor, rotationFactor]),
    { stiffness: 250, damping: 25 }
  );

  function onPointerMove(event) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((event.clientX - rect.left) / rect.width);
    y.set((event.clientY - rect.top) / rect.height);
  }

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 800 }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
    >
      {children}
    </motion.div>
  );
}
