"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
} from "motion/react";
import { scoreTone } from "@/lib/score";

// The hero's interactive moment. Drag the dial and the verdict flips at 70,
// which is the whole product in one gesture: above the line you apply, below
// it you get a gap to close.
//
// The score is a motion value, never React state, so dragging does not
// re-render the tree on every frame. Only the colour band is state, and that
// changes at most twice across a full sweep.

const SIZE = 260;
const STROKE = 14;
const R = (SIZE - STROKE) / 2 - 8;
const CIRC = 2 * Math.PI * R;
const SWEEP = 0.75; // 270 degrees, gap at the bottom
const ARC = CIRC * SWEEP;
const INTRO = 84; // the score the hero screenshot shows

const TONE_VAR = {
  strong: "var(--score-strong)",
  partial: "var(--score-partial)",
  weak: "var(--score-weak)",
};

export function ScoreDial() {
  const reduce = useReducedMotion();
  const svgRef = useRef(null);
  const labelRef = useRef(null);

  const score = useMotionValue(reduce ? INTRO : 0);
  const smooth = useSpring(score, { stiffness: 160, damping: 22, mass: 0.6 });

  const offset = useTransform(smooth, [0, 100], [ARC, 0]);
  const shown = useTransform(smooth, (v) => Math.round(v));

  const [tone, setTone] = useState(scoreTone(reduce ? INTRO : 0));
  const [qualified, setQualified] = useState(reduce ? true : false);

  // Band and verdict are the only things that need a render, and they change
  // at most twice across a full 0-100 sweep.
  useMotionValueEvent(smooth, "change", (v) => {
    const t = scoreTone(v);
    setTone((prev) => (prev === t ? prev : t));
    setQualified((prev) => (prev === v >= 70 ? prev : v >= 70));
    // aria-valuenow imperatively: keeping it in state would re-render on
    // every frame of the drag.
    svgRef.current?.setAttribute("aria-valuenow", String(Math.round(v)));
  });

  // Intro: run the dial up to the hero score once, so a visitor who never
  // touches it still sees what the number does.
  useEffect(() => {
    if (reduce) return;
    const controls = animate(score, INTRO, {
      duration: 1.4,
      delay: 0.35,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [reduce, score]);

  /** Pointer angle to a 0-100 score, clamped to the visible 270 degree arc. */
  const setFromPointer = (event) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Rotate so 0 sits at the arc's start (bottom left) and sweep clockwise.
    let deg = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
    deg = (deg - 135 + 360) % 360;
    if (deg > SWEEP * 360) {
      // In the dead zone at the bottom: snap to whichever end is nearer.
      score.set(deg < (SWEEP * 360 + 360) / 2 ? 100 : 0);
      return;
    }
    score.set(Math.round((deg / (SWEEP * 360)) * 100));
  };

  const onPointerDown = (event) => {
    // Move first: pointer capture is best-effort (it throws for a synthetic
    // pointerId), and a throw here would swallow the interaction entirely.
    setFromPointer(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is an enhancement, dragging still works without it */
    }
  };
  const onPointerMove = (event) => {
    if (event.buttons !== 1) return;
    setFromPointer(event);
  };
  const onKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 1;
    const current = score.get();
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      score.set(Math.min(100, current + step));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      score.set(Math.max(0, current - step));
    } else if (event.key === "Home") {
      score.set(0);
    } else if (event.key === "End") {
      score.set(100);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        tabIndex={0}
        aria-label="Try the match score. Seventy and above counts as qualified."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={reduce ? INTRO : 0}
        aria-valuetext={qualified ? "Qualified" : "Not yet"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="max-w-full cursor-grab touch-none select-none rounded-full active:cursor-grabbing"
        style={{ transform: "rotate(135deg)" }}
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRC}`}
        />
        {/* Progress */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={TONE_VAR[tone]}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRC}`}
          style={{ strokeDashoffset: offset, transition: "stroke 300ms ease" }}
        />
        {/* The 70 line: where "not yet" becomes "apply" */}
        <line
          x1={SIZE / 2 + R - STROKE}
          y1={SIZE / 2}
          x2={SIZE / 2 + R + STROKE}
          y2={SIZE / 2}
          stroke="var(--paper)"
          strokeWidth={3}
          transform={`rotate(${0.7 * SWEEP * 360} ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>

      {/* The svg is rotated, so the readout is a sibling overlay rather than
          a child, and stays upright. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          ref={labelRef}
          className="font-mono text-5xl font-semibold tabular-nums"
          style={{ color: TONE_VAR[tone], transition: "color 300ms ease" }}
        >
          {shown}
        </motion.span>
        <span className="mt-1 font-mono text-xs text-muted">/100</span>
      </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span
          className={`rounded-xl px-3 py-1 text-sm font-medium transition ${
            qualified ? "bg-ink text-paper" : "border border-line text-muted"
          }`}
        >
          {qualified ? "Qualified" : "Not yet"}
        </span>
        <span className="text-xs text-muted">Drag the dial</span>
      </div>
    </div>
  );
}
