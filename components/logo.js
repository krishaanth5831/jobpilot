"use client";

import { motion, useReducedMotion } from "motion/react";

// The jobpilot mark: a hexagonal shield with two interlocking angular hooks
// cut out of it (recreated from the brand image, black-on-white / inverted
// in dark). Entrance: the shield springs in, then the hooks slide in from
// opposite corners. With `loop` the hooks pulse alternately — loop is
// reserved for the hero per the motion principles.
//
// The hooks are painted in var(--background) so they read as true cutouts
// on either theme while still being independently animatable.
const SHIELD = "M 22,5 L 78,5 L 95,20 L 95,58 L 50,101 L 5,58 L 5,20 Z";
const HOOK_TOP = "M 30,24 L 70,24 L 58,39 L 45,39 L 45,54 L 30,70 Z";
const HOOK_BOTTOM = "M 70,78 L 30,78 L 42,63 L 55,63 L 55,48 L 70,32 Z";

export function Logo({ size = 24, loop = false, className, delay = 0 }) {
  const reduced = useReducedMotion();

  // Entrance lives on the group, the loop pulse on the inner path —
  // separate elements so the animate prop can't override the variants.
  const hook = (d, index) => (
    <motion.g
      variants={{
        hidden: { opacity: 0, x: index === 0 ? -10 : 10, y: index === 0 ? -10 : 10 },
        visible: { opacity: 1, x: 0, y: 0 },
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <motion.path
        d={d}
        style={{ fill: "var(--background)" }}
        animate={loop && !reduced ? { opacity: [1, 0.35, 1] } : undefined}
        transition={
          loop && !reduced
            ? {
                duration: 2.4,
                repeat: Infinity,
                delay: delay + 0.6 + index * 1.2,
                ease: "easeInOut",
              }
            : undefined
        }
      />
    </motion.g>
  );

  return (
    <motion.svg
      viewBox="0 0 100 106"
      width={size * (100 / 106)}
      height={size}
      className={className}
      initial={reduced ? false : "hidden"}
      animate="visible"
      transition={{ staggerChildren: 0.12, delayChildren: delay }}
      role="img"
      aria-label="jobpilot logo"
    >
      <motion.path
        d={SHIELD}
        fill="currentColor"
        variants={{
          hidden: { opacity: 0, scale: 0.7 },
          visible: { opacity: 1, scale: 1 },
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ transformOrigin: "50px 53px" }}
      />
      {hook(HOOK_TOP, 0)}
      {hook(HOOK_BOTTOM, 1)}
    </motion.svg>
  );
}
