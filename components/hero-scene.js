"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

// The 3D hero render: a slowly orbiting wireframe paper plane drawn on
// canvas with perspective projection. This is the one place on the page
// where color lives (the accent gradient), per the design system.
// Swappable for a Spline scene later — same slot, same poster fallback.

// Dart-style paper plane vertices [x, y, z]
const V = {
  nose: [1.7, 0.05, 0],
  leftTip: [-1.3, 0.35, 1.25],
  rightTip: [-1.3, 0.35, -1.25],
  tailTop: [-1.3, 0.1, 0],
  keel: [-1.15, -0.55, 0],
  foldL: [-1.3, 0.18, 0.35],
  foldR: [-1.3, 0.18, -0.35],
};

const EDGES = [
  ["nose", "leftTip"],
  ["nose", "rightTip"],
  ["nose", "tailTop"],
  ["nose", "keel"],
  ["leftTip", "foldL"],
  ["rightTip", "foldR"],
  ["foldL", "tailTop"],
  ["foldR", "tailTop"],
  ["tailTop", "keel"],
  ["nose", "foldL"],
  ["nose", "foldR"],
];

function rotateY([x, y, z], a) {
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}
function rotateZ([x, y, z], a) {
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
}

export function HeroScene({ className }) {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const styles = getComputedStyle(document.documentElement);
    const accentFrom = styles.getPropertyValue("--accent-from").trim() || "#6366f1";
    const accentTo = styles.getPropertyValue("--accent-to").trim() || "#22d3ee";

    function project([x, y, z], scale) {
      const depth = 5;
      const f = depth / (depth - z);
      return [x * f * scale, -y * f * scale, f];
    }

    function draw(t) {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) / 4.4;
      const angle = t * 0.00035;
      const bank = Math.sin(t * 0.0007) * 0.16;
      const bob = Math.sin(t * 0.0009) * 0.12;

      ctx.save();
      ctx.translate(cx, cy + bob * scale * 0.6);

      const gradient = ctx.createLinearGradient(-scale * 1.5, 0, scale * 1.5, 0);
      gradient.addColorStop(0, accentFrom);
      gradient.addColorStop(1, accentTo);

      // Orbit ring of drifting particles behind the plane
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 26; i++) {
        const pa = (i / 26) * Math.PI * 2 + t * 0.0002;
        const p = project(rotateY([Math.cos(pa) * 2.4, Math.sin(pa * 2) * 0.28, Math.sin(pa) * 2.4], angle * 0.5), scale);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.3 * p[2] * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? accentFrom : accentTo;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // The plane
      const transformed = {};
      for (const key of Object.keys(V)) {
        transformed[key] = project(rotateZ(rotateY(V[key], angle), bank), scale);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.shadowBlur = 14;
      ctx.shadowColor = accentFrom;
      for (const [a, b] of EDGES) {
        ctx.beginPath();
        ctx.moveTo(transformed[a][0], transformed[a][1]);
        ctx.lineTo(transformed[b][0], transformed[b][1]);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Vertex dots
      for (const key of Object.keys(transformed)) {
        const [x, y] = transformed[key];
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = accentTo;
        ctx.fill();
      }

      ctx.restore();
    }

    if (reduced) {
      draw(1200); // single static frame
    } else {
      const loop = (t) => {
        draw(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full ${className ?? ""}`}
      role="img"
      aria-label="Animated wireframe paper plane"
    />
  );
}

export default HeroScene;
