"use client";

import { motion } from "motion/react";

const presets = {
  blur: {
    hidden: { opacity: 0, filter: "blur(10px)", y: 10 },
    visible: { opacity: 1, filter: "blur(0px)", y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slide: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
};

// Animates text in per word (or per character) with a preset.
export function TextEffect({
  children,
  per = "word",
  preset = "blur",
  as = "p",
  className,
  delay = 0,
  speedSegment = 1,
  onView = false,
}) {
  const MotionTag = motion[as] ?? motion.p;
  const segments =
    per === "char" ? String(children).split("") : String(children).split(/(\s+)/);
  const variants = presets[preset] ?? presets.blur;
  const trigger = onView
    ? { whileInView: "visible", viewport: { once: true, margin: "0px 0px -80px 0px" } }
    : { animate: "visible" };

  return (
    <MotionTag
      className={className}
      initial="hidden"
      {...trigger}
      transition={{ staggerChildren: 0.06 / speedSegment, delayChildren: delay }}
      aria-label={String(children)}
    >
      {segments.map((segment, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          variants={variants}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="inline-block whitespace-pre"
        >
          {segment}
        </motion.span>
      ))}
    </MotionTag>
  );
}
