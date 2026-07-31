// The subscription plans, in one place.
//
// Pure data and pure functions — no server imports — so the pricing page and
// the in-app usage meters can import this exact table rather than restating
// the numbers in JSX where they can drift apart.
//
// THE ATS RESUME SCORE IS NOT IN THIS FILE, DELIBERATELY. It is never gated,
// on any tier, and the way to guarantee that is for it to have no entry any
// gate could read. NEVER_GATED below names it so the intent is testable
// rather than just a comment. Do not add it to FEATURES.

export const TIERS = { FREE: "free", PRO: "pro", UNLIMITED: "unlimited" };
export const TIER_ORDER = [TIERS.FREE, TIERS.PRO, TIERS.UNLIMITED];

/** Metered features — every use increments a counter. */
export const FEATURES = {
  AUTO_APPLY: "auto_apply",
  COVER_LETTER: "cover_letter",
  SKILL_ROADMAP: "skill_roadmap",
  COMPANY_MATCH: "company_match",
  RESUME_VERSION: "resume_version",
  TAILORED_RESUME: "tailored_resume",
  INTERVIEW_PREP: "interview_prep",
  FOLLOW_UP_EMAIL: "follow_up_email",
};

/** Yes/no entitlements — no counter, just "does this tier get it". */
export const CAPABILITIES = {
  PIPELINE_VIEW: "pipeline_view",
  TAILORED_PDF: "tailored_pdf",
  EMAIL_ALERTS: "email_alerts",
  MODEL_CHOICE: "model_choice",
  UNBRANDED_EXPORTS: "unbranded_exports",
  PRIORITY_QUEUE: "priority_queue",
  AGENTIC_AUTO_APPLY: "agentic_auto_apply",
};

/**
 * Things that must never be gated, whatever the tier or flag. Enforced by
 * assertNeverGated() and by a test — a future edit that quietly adds the ATS
 * score to FEATURES will fail rather than silently paywalling it.
 */
export const NEVER_GATED = ["ats_resume_score"];

export const UNLIMITED = Infinity;

// How a counter resets:
//   day   - UTC calendar day, resets 00:00 UTC
//   month - the account's billing anniversary, not the calendar month
//   life  - never resets
//   stock - not a counter at all: a live count of things currently held
//           (resume versions), so deleting one frees a slot
export const PERIODS = { DAY: "day", MONTH: "month", LIFE: "life", STOCK: "stock" };

const unlimited = (period = PERIODS.MONTH) => ({ limit: UNLIMITED, period });

export const PLANS = {
  [TIERS.FREE]: {
    id: TIERS.FREE,
    name: "Free",
    blurb: "Enough to see whether it works for you.",
    limits: {
      // A one-time taste, not a monthly allowance — this one never resets.
      [FEATURES.AUTO_APPLY]: { limit: 3, period: PERIODS.LIFE },
      [FEATURES.COVER_LETTER]: { limit: 3, period: PERIODS.MONTH },
      [FEATURES.SKILL_ROADMAP]: { limit: 1, period: PERIODS.MONTH },
      [FEATURES.COMPANY_MATCH]: { limit: 5, period: PERIODS.DAY },
      [FEATURES.RESUME_VERSION]: { limit: 1, period: PERIODS.STOCK },
      // Paid-tier features: a limit of 0 is what makes the upgrade prompt
      // name the right tier instead of showing a used/limit meter.
      [FEATURES.TAILORED_RESUME]: { limit: 0, period: PERIODS.MONTH },
      [FEATURES.INTERVIEW_PREP]: { limit: 0, period: PERIODS.MONTH },
      [FEATURES.FOLLOW_UP_EMAIL]: { limit: 0, period: PERIODS.MONTH },
    },
    capabilities: [],
    // Which rows the pricing card shows. The SELECTION is editorial; the
    // numbers beside them are read from `limits` above, so a card can never
    // advertise a limit the server does not enforce.
    highlights: [
      FEATURES.COMPANY_MATCH,
      FEATURES.COVER_LETTER,
      FEATURES.SKILL_ROADMAP,
      FEATURES.AUTO_APPLY,
      FEATURES.RESUME_VERSION,
    ],
  },

  [TIERS.PRO]: {
    id: TIERS.PRO,
    name: "Pro",
    blurb: "For an active search.",
    limits: {
      [FEATURES.AUTO_APPLY]: { limit: 50, period: PERIODS.MONTH },
      [FEATURES.COVER_LETTER]: unlimited(),
      [FEATURES.SKILL_ROADMAP]: unlimited(),
      [FEATURES.COMPANY_MATCH]: unlimited(PERIODS.DAY),
      [FEATURES.RESUME_VERSION]: { limit: 5, period: PERIODS.STOCK },
      [FEATURES.TAILORED_RESUME]: unlimited(),
      [FEATURES.INTERVIEW_PREP]: { limit: 0, period: PERIODS.MONTH },
      [FEATURES.FOLLOW_UP_EMAIL]: { limit: 0, period: PERIODS.MONTH },
    },
    capabilities: [
      CAPABILITIES.PIPELINE_VIEW,
      CAPABILITIES.TAILORED_PDF,
      CAPABILITIES.EMAIL_ALERTS,
      CAPABILITIES.MODEL_CHOICE,
      CAPABILITIES.UNBRANDED_EXPORTS,
    ],
    highlights: [
      FEATURES.COMPANY_MATCH,
      FEATURES.COVER_LETTER,
      FEATURES.TAILORED_RESUME,
      FEATURES.AUTO_APPLY,
      FEATURES.RESUME_VERSION,
      CAPABILITIES.PIPELINE_VIEW,
      CAPABILITIES.TAILORED_PDF,
    ],
  },

  [TIERS.UNLIMITED]: {
    id: TIERS.UNLIMITED,
    name: "Unlimited",
    blurb: "Everything, at full speed.",
    limits: {
      // Marketed as unlimited; 300/month is a fair-use ceiling that exists to
      // stop one runaway account from draining the Claude budget.
      [FEATURES.AUTO_APPLY]: { limit: 300, period: PERIODS.MONTH },
      [FEATURES.COVER_LETTER]: unlimited(),
      [FEATURES.SKILL_ROADMAP]: unlimited(),
      [FEATURES.COMPANY_MATCH]: unlimited(PERIODS.DAY),
      [FEATURES.RESUME_VERSION]: unlimited(PERIODS.STOCK),
      [FEATURES.TAILORED_RESUME]: unlimited(),
      [FEATURES.INTERVIEW_PREP]: unlimited(),
      [FEATURES.FOLLOW_UP_EMAIL]: unlimited(),
    },
    capabilities: [
      CAPABILITIES.PIPELINE_VIEW,
      CAPABILITIES.TAILORED_PDF,
      CAPABILITIES.EMAIL_ALERTS,
      CAPABILITIES.MODEL_CHOICE,
      CAPABILITIES.UNBRANDED_EXPORTS,
      CAPABILITIES.PRIORITY_QUEUE,
      CAPABILITIES.AGENTIC_AUTO_APPLY,
    ],
    highlights: [
      FEATURES.INTERVIEW_PREP,
      FEATURES.FOLLOW_UP_EMAIL,
      FEATURES.AUTO_APPLY,
      FEATURES.RESUME_VERSION,
      CAPABILITIES.PRIORITY_QUEUE,
    ],
  },
};

// Prices in EUR. `annual` is the PER-MONTH price when billed annually, which
// is how the pricing page shows it; the amount actually charged once a year is
// annual * 12 (see annualTotal).
export const PRICING = {
  [TIERS.PRO]: { monthly: 21.99, annual: 9.99, currency: "EUR" },
  [TIERS.UNLIMITED]: { monthly: 29.99, annual: 14.99, currency: "EUR" },
};

export const annualTotal = (tier) => Math.round(PRICING[tier].annual * 12 * 100) / 100;

/** Whole-percent saving from paying annually — the badge on the toggle. */
export const savingsPercent = (tier) => {
  const p = PRICING[tier];
  return Math.round((1 - p.annual / p.monthly) * 100);
};

// ---------------------------------------------------------------------------
// Presentation. Labels live here, beside the numbers they describe, so the
// pricing page and the in-app meters cannot drift apart from the limits the
// server actually enforces.
// ---------------------------------------------------------------------------

export const FEATURE_LABELS = {
  [FEATURES.COMPANY_MATCH]: "Jobs screened",
  [FEATURES.COVER_LETTER]: "Cover letters",
  [FEATURES.AUTO_APPLY]: "Auto-drafted applications",
  [FEATURES.RESUME_VERSION]: "Saved resume versions",
  [FEATURES.TAILORED_RESUME]: "Tailored resumes",
  [FEATURES.SKILL_ROADMAP]: "Skill roadmaps",
  [FEATURES.INTERVIEW_PREP]: "Interview prep",
  [FEATURES.FOLLOW_UP_EMAIL]: "Follow-up emails",
};

const CAPABILITY_LABELS = {
  [CAPABILITIES.PIPELINE_VIEW]: "Application tracker",
  [CAPABILITIES.TAILORED_PDF]: "PDF export",
  [CAPABILITIES.EMAIL_ALERTS]: "Email alerts for new matches",
  [CAPABILITIES.MODEL_CHOICE]: "Choose your AI model",
  [CAPABILITIES.UNBRANDED_EXPORTS]: "Unbranded exports",
  [CAPABILITIES.PRIORITY_QUEUE]: "Priority queue",
  [CAPABILITIES.AGENTIC_AUTO_APPLY]: "Agentic auto-apply",
};

/** Labels for the things no plan can ever take away. */
export const NEVER_GATED_LABELS = { ats_resume_score: "ATS resume score" };

export const labelFor = (name) => FEATURE_LABELS[name] ?? CAPABILITY_LABELS[name] ?? name;

/** Row order for the comparison table — features first, then capabilities. */
export const COMPARISON_ROWS = [
  ...Object.keys(FEATURE_LABELS),
  ...Object.keys(CAPABILITY_LABELS),
];

const PERIOD_SUFFIX = {
  [PERIODS.DAY]: "/ day",
  [PERIODS.MONTH]: "/ month",
  [PERIODS.LIFE]: "total",
  [PERIODS.STOCK]: "saved",
};

/**
 * A limit as a person would read it: "5 / day", "3 total", "Unlimited".
 * Returns null when the tier does not include the feature at all, which is
 * what the table renders as a dash rather than as "0".
 */
function describeLimit(rule) {
  if (!rule) return null;
  if (rule.limit === UNLIMITED) return "Unlimited";
  if (rule.limit <= 0) return null;
  return `${rule.limit} ${PERIOD_SUFFIX[rule.period] ?? ""}`.trim();
}

export const isFeature = (name) => Object.values(FEATURES).includes(name);
export const isCapability = (name) => Object.values(CAPABILITIES).includes(name);

/** The rule for a feature on a tier, or null when the name is unknown. */
export const limitFor = (tier, feature) => PLANS[tier]?.limits?.[feature] ?? null;
export const hasCapability = (tier, capability) =>
  Boolean(PLANS[tier]?.capabilities?.includes(capability));

/**
 * What a tier offers for one row of the comparison table: a readable limit,
 * "Included" for a yes/no capability, or null for "this plan doesn't have it".
 */
export function cellFor(tier, name) {
  if (isCapability(name)) return hasCapability(tier, name) ? "Included" : null;
  return describeLimit(limitFor(tier, name));
}

/**
 * The cheapest tier that offers this feature at all — for the pricing page's
 * "included in" column.
 */
function lowestTierWith(name) {
  return (
    TIER_ORDER.find((tier) =>
      isCapability(name)
        ? hasCapability(tier, name)
        : (limitFor(tier, name)?.limit ?? 0) > 0,
    ) ?? null
  );
}

/**
 * The tier to actually offer someone who just ran out.
 *
 * NOT the same question as lowestTierWith. A Free account that hits its 1
 * roadmap a month already *has* the feature, so the cheapest tier offering it
 * is the one they are on — useless as an upgrade prompt. This finds the
 * cheapest tier strictly better than theirs for this feature, and returns null
 * when nothing beats it (an Unlimited account at the 300 fair-use ceiling has
 * nowhere to upgrade to).
 */
export function upgradeTierFor(currentTier, name) {
  const above = TIER_ORDER.slice(TIER_ORDER.indexOf(currentTier) + 1);
  if (isCapability(name)) return above.find((t) => hasCapability(t, name)) ?? null;
  const current = limitFor(currentTier, name)?.limit ?? 0;
  return above.find((t) => (limitFor(t, name)?.limit ?? 0) > current) ?? null;
}

/**
 * Throws if something tries to gate a never-gated feature. Called by the
 * entitlement check so the guarantee is enforced at runtime, not just in
 * review.
 */
export function assertNeverGated(name) {
  if (NEVER_GATED.includes(name)) {
    throw new Error(
      `${name} must never be gated — it is on NEVER_GATED in lib/tiers.js. ` +
        "If a limit is genuinely wanted here, that is a product decision, not a code change.",
    );
  }
}
