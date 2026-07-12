"use client";

import { motion } from "motion/react";
import { Children } from "react";

const defaultContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const defaultItem = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

// Staggers its children in on mount (or when `animate` flips to visible).
export function AnimatedGroup({
  children,
  className,
  variants,
  as = "div",
  asChild = "div",
}) {
  const MotionTag = motion[as] ?? motion.div;
  const MotionChild = motion[asChild] ?? motion.div;

  return (
    <MotionTag
      initial="hidden"
      animate="visible"
      variants={variants?.container ?? defaultContainer}
      className={className}
    >
      {Children.map(children, (child, i) => (
        <MotionChild key={i} variants={variants?.item ?? defaultItem}>
          {child}
        </MotionChild>
      ))}
    </MotionTag>
  );
}
