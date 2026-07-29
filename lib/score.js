// The 0-100 match score is the one number that makes jobblast different from
// a job board, so it gets the only semantic colour scale on the site. Kept
// separate from the terracotta brand accent on purpose: a low score means
// "not yet", not "brand emphasis".
//
// Bands match how the screen actually reads: below 45 the posting wants
// things the resume does not show, 45-69 is partial, 70+ is where Claude
// marks someone qualified.

export const SCORE_BANDS = [
  { min: 70, tone: "strong", label: "Strong match" },
  { min: 45, tone: "partial", label: "Partial match" },
  { min: 0, tone: "weak", label: "Not yet" },
];

/** "strong" | "partial" | "weak" for a 0-100 score. */
export function scoreTone(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "weak";
  return SCORE_BANDS.find((b) => n >= b.min).tone;
}

// Full class strings, not interpolated fragments: Tailwind only ships classes
// it can see written out.
const TEXT = {
  strong: "text-score-strong",
  partial: "text-score-partial",
  weak: "text-score-weak",
};

const BORDER = {
  strong: "border-score-strong",
  partial: "border-score-partial",
  weak: "border-score-weak",
};

export const scoreTextClass = (score) => TEXT[scoreTone(score)];
export const scoreBorderClass = (score) => BORDER[scoreTone(score)];
