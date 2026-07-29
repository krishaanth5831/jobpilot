"use client";

import { useEffect, useRef } from "react";

// Decorative hero background: a few thousand particles drifting through a
// slowly rotating flow field, leaving ink trails that fade out. Purely
// atmospheric, it does not encode anything.
//
// Canvas rather than DOM or SVG: this is thousands of tiny draws per frame,
// which is exactly what a 2D context is for and exactly what the layout
// engine is not. Colours are read from the CSS custom properties so the
// field re-themes with the rest of the page.

const PARTICLES = 1100;
const TRAIL_FADE = 0.028; // lower means trails persist and the field looks woven
const SPEED = 0.85;
const FIELD_SCALE = 0.0016; // lower means longer, lazier curves
const DRIFT = 0.00007; // how fast the field itself rotates over time

/** Cheap, smooth, non-repeating enough. Not real Perlin noise, does not need to be. */
function fieldAngle(x, y, t) {
  return (
    Math.sin(x * FIELD_SCALE + t) * 1.6 +
    Math.cos(y * FIELD_SCALE - t * 0.8) * 1.6 +
    Math.sin((x + y) * FIELD_SCALE * 0.5 + t * 1.3)
  );
}

export function HeroField({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let raf = 0;
    let t = 0;
    let running = true;

    const readColors = () => {
      const style = getComputedStyle(document.documentElement);
      // Thin dark strokes on paper read much fainter than light strokes on a
      // dark ground, so light mode needs more ink to land at the same weight.
      const dark = document.documentElement.classList.contains("dark");
      return {
        paper: style.getPropertyValue("--paper").trim() || "#fbfaf8",
        accent: style.getPropertyValue("--accent").trim() || "#bc4a2b",
        muted: style.getPropertyValue("--muted").trim() || "#6b6560",
        inkAlpha: dark ? 0.3 : 0.5,
        emberAlpha: dark ? 0.55 : 0.72,
      };
    };
    let colors = readColors();

    const seed = () => {
      particles = Array.from({ length: PARTICLES }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        // A minority get the accent so the field reads as ink with embers in
        // it rather than a two-tone gradient.
        accent: Math.random() < 0.22,
        life: Math.random() * 220,
      }));
    };

    // Declared before resize so the reduced-motion branch can call it.
    let renderStatic = () => {};

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      seed();
      // Resizing wipes the bitmap. With motion running the next frame refills
      // it, but the static render has no next frame, so redraw it here or the
      // field is blank for anyone who asked for reduced motion.
      if (reduce) renderStatic();
    };

    const step = () => {
      // Wash the previous frame toward the page colour instead of clearing:
      // that is what leaves trails behind the particles.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = colors.paper;
      ctx.globalAlpha = TRAIL_FADE;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      ctx.lineWidth = 0.9;
      for (const p of particles) {
        const angle = fieldAngle(p.x, p.y, t);
        const nx = p.x + Math.cos(angle) * SPEED;
        const ny = p.y + Math.sin(angle) * SPEED;

        ctx.strokeStyle = p.accent ? colors.accent : colors.muted;
        ctx.globalAlpha = p.accent ? colors.emberAlpha : colors.inkAlpha;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        p.x = nx;
        p.y = ny;
        p.life -= 1;

        // Respawn when it wanders off or ages out, so the field never thins.
        if (p.life <= 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.life = 160 + Math.random() * 260;
        }
      }
      ctx.globalAlpha = 1;
      t += DRIFT * 16;
    };

    const loop = () => {
      if (!running) return;
      step();
      raf = requestAnimationFrame(loop);
    };

    // No animation: draw a few hundred steps once so the field still has a
    // composed, woven look, then stop.
    renderStatic = () => {
      for (let i = 0; i < 320; i++) step();
    };

    resize();
    if (!reduce) raf = requestAnimationFrame(loop);

    // Stop burning frames when the tab is hidden or the hero is scrolled away.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (reduce) return;
        if (entry.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(loop);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // next-themes swaps a class on <html>; re-read the palette when it does.
    const mo = new MutationObserver(() => {
      colors = readColors();
      ctx.clearRect(0, 0, width, height);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{
        // Clear behind the copy on the left, full strength on the right, and
        // fading out into the section below. A single directional wash reads
        // as intentional; a radial spot in one corner reads as a smudge.
        maskImage:
          "linear-gradient(to right, transparent 8%, rgba(0,0,0,0.5) 38%, black 62%), linear-gradient(to bottom, black 72%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 8%, rgba(0,0,0,0.5) 38%, black 62%), linear-gradient(to bottom, black 72%, transparent 100%)",
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    />
  );
}
