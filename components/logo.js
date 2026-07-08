"use client";

import { motion, useReducedMotion } from "motion/react";

// The jobpilot mark: a ring of pixel squares (digitized from the brand
// image, white-on-black / black-on-white). Squares pop in staggered around
// the ring; with `loop` a shimmer keeps traveling around it — loop is
// reserved for the hero per the motion principles.
// Order matters: it's the animation sequence, clockwise from the top.
const SQUARES = [
  [140, 45],
  [186, 45],
  [245, 15],
  [222, 88],
  [224, 133],
  [221, 203],
  [175, 203],
  [148, 175],
  [105, 170],
  [95, 212],
  [90, 130],
  [100, 85],
];

const SIZE = 40;

export function Logo({ size = 24, loop = false, className, delay = 0 }) {
  const reduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 383 267"
      width={size * (383 / 267)}
      height={size}
      className={className}
      initial={reduced ? false : "hidden"}
      animate="visible"
      transition={{ staggerChildren: 0.05, delayChildren: delay }}
      role="img"
      aria-label="jobpilot logo"
    >
      {SQUARES.map(([x, y], i) => (
        <motion.g
          key={`${x}-${y}`}
          variants={{
            hidden: { opacity: 0, scale: 0.4 },
            visible: { opacity: 1, scale: 1 },
          }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
          style={{ transformOrigin: `${x + SIZE / 2}px ${y + SIZE / 2}px` }}
        >
          <motion.rect
            x={x}
            y={y}
            width={SIZE}
            height={SIZE}
            fill="currentColor"
            animate={loop && !reduced ? { opacity: [1, 0.3, 1] } : undefined}
            transition={
              loop && !reduced
                ? {
                    duration: 2.4,
                    repeat: Infinity,
                    delay: delay + i * 0.2,
                    ease: "easeInOut",
                  }
                : undefined
            }
          />
        </motion.g>
      ))}
    </motion.svg>
  );
}
