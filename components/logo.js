"use client";

import { motion, useReducedMotion } from "motion/react";

// The jobpilot mark: a pixel-art rocket climbing at 45°, recreated from the
// brand image as a grid ('#' = hull pixel, 'o' = exhaust pixel, '.' = empty).
// Entrance: the pixels materialize tail-to-nose. With `loop` the rocket bobs
// along its flight path while the exhaust flickers — loop is reserved for the
// hero per the motion principles.
const GRID = [
  "........###",
  ".......####",
  "......####.",
  ".....#.##..",
  "..#.####...",
  "...####....",
  "..####.....",
  ".#####.....",
  "..###......",
  ".o.........",
  "o.o........",
];

export const ROCKET_PIXELS = [];
GRID.forEach((row, y) => {
  [...row].forEach((ch, x) => {
    if (ch !== ".") ROCKET_PIXELS.push({ x, y, exhaust: ch === "o" });
  });
});

export function Logo({ size = 24, loop = false, className, delay = 0 }) {
  const reduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 11 11"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="jobpilot logo"
      animate={loop && !reduced ? { x: [0, 2, 0], y: [0, -2, 0] } : undefined}
      transition={
        loop && !reduced
          ? { duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.9 }
          : undefined
      }
    >
      {ROCKET_PIXELS.map(({ x, y, exhaust }, i) => (
        <motion.rect
          key={i}
          x={x + 0.075}
          y={y + 0.075}
          width={0.85}
          height={0.85}
          fill="currentColor"
          initial={reduced ? false : { opacity: 0, scale: 0 }}
          animate={
            loop && !reduced && exhaust
              ? { opacity: [1, 0.15, 1], scale: 1 }
              : { opacity: 1, scale: 1 }
          }
          transition={
            loop && !reduced && exhaust
              ? // Exhaust ignites after the hull assembles, then flickers forever.
                {
                  duration: 0.9,
                  repeat: Infinity,
                  repeatDelay: 0.15,
                  ease: "easeInOut",
                  delay: delay + 0.7 + i * 0.12,
                }
              : // Entrance sweep: tail (bottom-left) to nose (top-right).
                {
                  duration: 0.25,
                  ease: "easeOut",
                  delay: delay + (x - y + 10) * 0.025,
                }
          }
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
    </motion.svg>
  );
}
