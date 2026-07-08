"use client";

import { motion } from "motion/react";
import { ScrollProgress } from "@/components/motion-primitives/scroll-progress";

// Consistent page frame: hairline scroll progress + fade-and-rise entrance.
// Bottom padding clears the floating dock.
export function PageShell({ children, className, width = "max-w-3xl" }) {
  return (
    <>
      <ScrollProgress />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`mx-auto w-full ${width} flex-1 px-6 pb-36 pt-16 ${className ?? ""}`}
      >
        {children}
      </motion.main>
    </>
  );
}
