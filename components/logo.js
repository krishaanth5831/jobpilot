"use client";

import { motion, useReducedMotion } from "motion/react";

// The jobpilot mark: a blocky rocket at liftoff on a 9×12 pixel grid
// ('#' = hull pixel, '.' = empty — the two holes are the window, digits =
// flame pixels keyed into FLAME). Entrance: the rocket assembles nose-to-tail,
// flame last. With `loop` the whole mark rumbles and rises while the flame
// flickers — loop is reserved for the hero per the motion principles.
const GRID = [
  "....#....",
  "...###...",
  "..#####..",
  "..##.##..",
  "..##.##..",
  "..#####..",
  ".#######.",
  "#########",
  "...###...",
  "..11111..",
  "...222...",
  "....3....",
];

// Flame gradient, hottest at the nozzle: amber → orange → red tip.
const FLAME = { 1: "#fbbf24", 2: "#f97316", 3: "#ef4444" };

export const ROCKET_PIXELS = [];
GRID.forEach((row, y) => {
  [...row].forEach((ch, x) => {
    if (ch !== ".") ROCKET_PIXELS.push({ x, y, flame: FLAME[ch] });
  });
});

export function Logo({ size = 24, loop = false, className, delay = 0 }) {
  const reduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="jobpilot logo"
      animate={
        loop && !reduced ? { y: [0, -2.5, 0], x: [0, 0.4, -0.4, 0] } : undefined
      }
      transition={
        loop && !reduced
          ? {
              // Slow climb-and-settle bob, with a fast sub-pixel launch rumble.
              y: { duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.9 },
              x: { duration: 0.35, repeat: Infinity, ease: "easeInOut", delay: delay + 0.9 },
            }
          : undefined
      }
    >
      {ROCKET_PIXELS.map(({ x, y, flame }, i) => (
        <motion.rect
          key={i}
          x={x + 1.575}
          y={y + 0.075}
          width={0.85}
          height={0.85}
          fill={flame ?? "currentColor"}
          initial={reduced ? false : { opacity: 0, scale: 0 }}
          animate={
            loop && !reduced && flame
              ? { opacity: [1, 0.25, 1], scale: [1, 0.7, 1] }
              : { opacity: 1, scale: 1 }
          }
          transition={
            loop && !reduced && flame
              ? // Flame ignites after the hull assembles, then flickers forever
                // at slightly desynced rates so it reads as fire, not a blink.
                {
                  duration: 0.45 + (i % 3) * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: delay + 0.8 + (i % 5) * 0.09,
                }
              : // Entrance sweep: nose down to flame.
                {
                  duration: 0.25,
                  ease: "easeOut",
                  delay: delay + y * 0.05,
                }
          }
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
    </motion.svg>
  );
}
