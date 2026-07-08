"use client";

import { motion } from "motion/react";

// Text with a light sweep moving across it. Monochrome by default;
// pass accent to use the accent gradient (AI-in-flight states only).
export function TextShimmer({ children, className, duration = 1.5, accent = false }) {
  const gradient = accent
    ? "linear-gradient(90deg, var(--subtle) 0%, var(--accent-from) 45%, var(--accent-to) 55%, var(--subtle) 100%)"
    : "linear-gradient(90deg, var(--subtle) 0%, var(--foreground) 50%, var(--subtle) 100%)";

  return (
    <motion.span
      className={`inline-block bg-clip-text text-transparent ${className ?? ""}`}
      style={{
        backgroundImage: gradient,
        backgroundSize: "200% 100%",
      }}
      animate={{ backgroundPosition: ["150% 0%", "-50% 0%"] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}
