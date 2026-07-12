"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const CHARS = "abcdefghijklmnopqrstuvwxyz!<>-_\\/[]{}—=+*^?#";

// Scrambles random characters into the target text.
export function TextScramble({ children, className, duration = 0.9, as: Tag = "span" }) {
  const target = String(children);
  const [display, setDisplay] = useState(target);
  const frameRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const settled = Math.floor(target.length * progress);
      let out = target.slice(0, settled);
      for (let i = settled; i < target.length; i++) {
        out += target[i] === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setDisplay(out);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, reduced]);

  return <Tag className={className}>{reduced ? target : display}</Tag>;
}
