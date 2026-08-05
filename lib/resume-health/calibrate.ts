// Raw weighted score -> the number the user sees.
//
// PROVISIONAL — AWAITING LABELLED DATA. Tuned deliberately HARSH, because the
// failure mode of a resume checker is telling someone their resume is fine
// when it is about to be filtered out. A generous score here costs the user
// interviews they will never know they missed.
//
// Targets: median around 62, only ~5% above 88.
//
// Replace these once there is outcome data (applications sent vs. replies).
// HEALTH_VERSION is persisted with every stored result, so recalibrating never
// rewrites history.

import type { Band } from "./types";

/**
 * Monotonic piecewise-linear knots, [rawScore, calibratedScore].
 *
 * The curve sits BELOW the identity line across the whole working range. A
 * resume that does everything structurally right but has flat, unquantified
 * bullets lands around raw 72, which maps to 60 — "needs work", which is the
 * honest answer.
 */
export const CALIBRATION = {
  knots: [
    [0, 0],
    // Anything under raw 30 is unreadable in practice; no point spreading it.
    [30, 15],
    [55, 40],
    // The 70-80 band is where most competent resumes land, and it is pushed
    // firmly into "needs work" rather than being flattered into "minor fixes".
    [70, 58],
    [80, 70],
    [90, 82],
    // Above raw 96 the document is genuinely clean; only then does it clear 88.
    [96, 90],
    [100, 100],
  ] as readonly (readonly [number, number])[],
} as const;

/** Lowest calibrated score in each band, checked high to low. `unreadable` is
 *  set by the gates and never appears here. */
export const BAND_THRESHOLDS = [
  { band: "ats-ready" as const, min: 85 },
  { band: "minor-fixes" as const, min: 70 },
  { band: "needs-work" as const, min: 50 },
  { band: "will-be-filtered" as const, min: 0 },
] as const;

/** Points recoverable at or above which a fix is critical / major. */
export const SEVERITY_CRITICAL_POINTS = 8;
export const SEVERITY_MAJOR_POINTS = 3;

(function assertMonotonic(): void {
  const { knots } = CALIBRATION;
  if (knots.length < 2) throw new Error("CALIBRATION.knots needs at least two points");
  for (let i = 1; i < knots.length; i++) {
    const prev = knots[i - 1];
    const cur = knots[i];
    if (prev === undefined || cur === undefined) throw new Error("CALIBRATION.knots is sparse");
    if (cur[0] <= prev[0]) throw new Error(`CALIBRATION.knots raw must increase (index ${i})`);
    if (cur[1] < prev[1]) throw new Error(`CALIBRATION.knots must be monotonic (index ${i})`);
  }
})();

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Raw 0-100 -> calibrated 0-100. Monotonic non-decreasing, deterministic. */
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

/** Calibrated score -> band. */
export function bandFor(score: number): Exclude<Band, "unreadable"> {
  for (const { band, min } of BAND_THRESHOLDS) {
    if (score >= min) return band;
  }
  return "will-be-filtered";
}
