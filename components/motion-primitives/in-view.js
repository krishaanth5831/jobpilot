"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

// Animates children once when they scroll into view.
export function InView({
  children,
  variants = {
    hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
  transition = { duration: 0.35, ease: "easeOut" },
  viewOptions = { once: true, margin: "0px 0px -80px 0px" },
  as = "div",
  className,
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const MotionTag = motion[as] ?? motion.div;

  return (
    <MotionTag
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={transition}
      className={className}
    >
      {children}
    </MotionTag>
  );
}
