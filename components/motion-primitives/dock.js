"use client";

import { createContext, useContext, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

const DockContext = createContext({ mouseX: null, magnification: 56, baseSize: 40 });

// macOS-style dock: icons magnify near the cursor.
export function Dock({ children, className, magnification = 56, baseSize = 40 }) {
  const mouseX = useMotionValue(Infinity);
  const reduced = useReducedMotion();

  return (
    <DockContext.Provider
      value={{ mouseX: reduced ? null : mouseX, magnification, baseSize }}
    >
      <motion.nav
        onPointerMove={(e) => mouseX.set(e.clientX)}
        onPointerLeave={() => mouseX.set(Infinity)}
        className={`flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white/80 px-3 py-2 backdrop-blur-md dark:border-neutral-800 dark:bg-black/80 ${className ?? ""}`}
      >
        {children}
      </motion.nav>
    </DockContext.Provider>
  );
}

export function DockItem({ children, className }) {
  const ref = useRef(null);
  const { mouseX, magnification, baseSize } = useContext(DockContext);

  const fallback = useMotionValue(Infinity);
  const distance = useTransform(mouseX ?? fallback, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });
  const sizeTransform = useTransform(
    distance,
    [-120, 0, 120],
    [baseSize, magnification, baseSize]
  );
  const size = useSpring(sizeTransform, { stiffness: 300, damping: 20 });

  return (
    <motion.div
      ref={ref}
      style={{ width: mouseX ? size : baseSize, height: mouseX ? size : baseSize }}
      className={`flex aspect-square items-center justify-center ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}
