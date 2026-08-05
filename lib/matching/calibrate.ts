// Maps a raw weighted score onto the number the user sees.
//
// PROVISIONAL — AWAITING LABELLED DATA. Every coefficient below is a
// judgement call, not a fit. The raw weighted sum clusters in the middle
// (the convex requiredSkills term pulls almost everything under 80), so an
// uncalibrated score would show a wall of 50s and mean nothing. The curve
// stretches that middle out and compresses both tails.
//
// Replace the knots once there is outcome data — applications sent, replies,
// interviews. Because SCORE_VERSION is persisted with every stored result,
// recalibrating never rewrites history: old scores keep their old curve.

import type { Band } from "./types";

/**
 * Knots of a monotonic piecewise-linear curve, as [rawScore, calibratedScore].
 * Between knots the mapping is linear; outside the ends it clamps.
 *
 * Chosen so the raw distribution lands roughly on the target shape:
 *   ~10% above 85  (needs raw >= ~82.6 — near-complete required skills)
 *   ~30% in 60-85  (raw ~58.2 to ~82.6 — the realistic-application band)
 *   the rest below.
 */
export const CALIBRATION = {
  knots: [
    // Raw 0-25 is compressed: nothing in this range is worth applying to, and
    // spreading it out only makes hopeless matches look survivable.
    [0, 0],
    [25, 20],
    // The 25-75 middle is stretched (slope > 1) because this is where real
    // candidates sit and where a 5-point difference actually means something.
    [45, 45],
    [60, 62],
    [75, 78],
    // The top is compressed again: past raw 88 the remaining differences are
    // noise in the extraction, not signal about the candidate.
    [88, 90],
    [100, 100],
  ] as readonly (readonly [number, number])[],
} as const;

/** Lowest calibrated score in each band. Order matters — checked high to low. */
export const BAND_THRESHOLDS = [
  { band: "strong" as const, min: 85 },
  { band: "good" as const, min: 70 },
  { band: "stretch" as const, min: 55 },
  { band: "reach" as const, min: 0 },
] as const;

// Fail fast on an unusable curve rather than silently returning nonsense.
(function assertMonotonic(): void {
  const { knots } = CALIBRATION;
  if (knots.length < 2) throw new Error("CALIBRATION.knots needs at least two points");
  for (let i = 1; i < knots.length; i++) {
    const prev = knots[i - 1];
    const cur = knots[i];
    if (prev === undefined || cur === undefined) throw new Error("CALIBRATION.knots is sparse");
    if (cur[0] <= prev[0]) throw new Error(`CALIBRATION.knots raw values must strictly increase (index ${i})`);
    if (cur[1] < prev[1]) throw new Error(`CALIBRATION.knots must be monotonic in output (index ${i})`);
  }
})();

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Raw 0-100 -> calibrated 0-100. Monotonic non-decreasing and deterministic:
 * a higher raw score can never produce a lower calibrated score.
 * Returns an unrounded value; `computeMatch` does the rounding once.
 */
export function calibrate(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const x = clamp(raw, 0, 100);
  const { knots } = CALIBRATION;

  for (let i = 1; i < knots.length; i++) {
    const prev = knots[i - 1];
    const cur = knots[i];
    if (prev === undefined || cur === undefined) continue;
    const [x0, y0] = prev;
    const [x1, y1] = cur;
    if (x <= x1) {
      const span = x1 - x0;
      const t = span === 0 ? 0 : (x - x0) / span;
      return clamp(y0 + t * (y1 - y0), 0, 100);
    }
  }
  const last = knots[knots.length - 1];
  return last === undefined ? 0 : clamp(last[1], 0, 100);
}

/** Calibrated score -> band. `ineligible` is set by the gate logic, never here. */
export function bandFor(score: number): Exclude<Band, "ineligible"> {
  for (const { band, min } of BAND_THRESHOLDS) {
    if (score >= min) return band;
  }
  return "reach";
}
