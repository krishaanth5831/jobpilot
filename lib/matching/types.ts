// Shared types for the deterministic match-scoring engine.
//
// ARCHITECTURAL RULE: LLMs extract the facts in `UserProfile` and
// `JobPosting`. The math in score.ts computes the number. Nothing in this
// directory performs I/O, and `computeMatch` is pure and synchronous, so the
// same inputs always produce the same output.

/** 0 none · 1 familiar · 2 proficient · 3 expert. */
export type SkillLevel = 0 | 1 | 2 | 3;

/** Where the evidence for a skill came from. Paid work outranks a project,
 *  which outranks an unsupported line in a "Skills:" list. */
export type SkillSource = "experience" | "project" | "listed";

/** 0 intern · 1 entry · 2 junior · 3 mid · 4 senior · 5 lead+ */
export type Seniority = 0 | 1 | 2 | 3 | 4 | 5;

/** 0 none · 1 high school · 2 associate · 3 bachelor · 4 master · 5 doctorate */
export type DegreeLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type RemotePolicy = "onsite" | "hybrid" | "remote";

export type Band = "strong" | "good" | "stretch" | "reach" | "ineligible";

export type ComponentId =
  | "requiredSkills"
  | "preferredSkills"
  | "experience"
  | "domain"
  | "education"
  | "logistics";

export interface UserSkill {
  canonicalId: string;
  level: SkillLevel;
  months: number;
  source: SkillSource;
}

export interface UserTitle {
  normalizedTitle: string;
  months: number;
  seniority: Seniority;
}

export interface UserEducation {
  degreeLevel: DegreeLevel;
  fieldId: string | null;
  /** PRESENT BUT NEVER READ BY THE SCORING ENGINE. Graduation year is a
   *  protected characteristic (an age proxy), so score.ts must not branch on
   *  it. Kept on the type only because callers persist it for display. */
  graduationDate: string | null;
}

export interface UserLocation {
  city: string | null;
  country: string | null;
  willingRemote: boolean;
  willingRelocate: boolean;
}

export interface UserLanguage {
  lang: string;
  cefr: Cefr;
}

export interface UserProfile {
  skills: UserSkill[];
  titles: UserTitle[];
  totalMonthsExperience: number;
  education: UserEducation;
  location: UserLocation;
  /** ISO 3166-1 alpha-2 country codes the user may legally work in. */
  workAuth: string[];
  languages: UserLanguage[];
  credentials: string[];
  summaryEmbedding: number[] | null;
}

export interface WeightedSkill {
  canonicalId: string;
  /** Relative importance within its own list. Not normalised by the caller —
   *  the engine divides by the sum, so any positive scale works. */
  weight: number;
}

export interface JobLocation {
  city: string | null;
  country: string | null;
  remotePolicy: RemotePolicy;
}

export interface JobLanguageRequirement {
  lang: string;
  minCefr: string;
}

export interface JobPosting {
  requiredSkills: WeightedSkill[];
  preferredSkills: WeightedSkill[];
  minYears: number;
  maxYears: number;
  seniority: Seniority;
  degreeRequired: DegreeLevel;
  fieldPreferenceId: string | null;
  equivalentExperienceAccepted: boolean;
  location: JobLocation;
  workAuthRequired: string[];
  sponsorshipAvailable: boolean;
  requiredCredentials: string[];
  languagesRequired: JobLanguageRequirement[];
  expiresAt: string | null;
  descriptionEmbedding: number[] | null;
}

export interface GateFailure {
  gate: string;
  reason: string;
}

export interface ComponentResult {
  id: ComponentId;
  /** 0-1. */
  score: number;
  /** 0-1, from WEIGHTS. */
  weight: number;
  /** score * weight * 100 — points this component put on the board. */
  contribution: number;
  explanation: string;
}

export interface SkillGap {
  canonicalId: string;
  label: string;
  /** Exact points the calibrated score would rise by if this skill were held
   *  at full quality. Computed by counterfactual re-scoring, not estimated. */
  pointsLost: number;
  kind: "required" | "preferred";
}

export interface SkillStrength {
  canonicalId: string;
  label: string;
  /** Exact points the calibrated score would fall by without this skill. */
  pointsGained: number;
}

export interface MatchResult {
  /** 0-100, calibrated. The number the user sees. */
  score: number;
  /** 0-100, pre-calibration. Kept for debugging and recalibration. */
  rawScore: number;
  band: Band;
  /** 0-1 — how much the inputs can be trusted, not how good the match is. */
  confidence: number;
  /** Set only when confidence < CONFIDENCE_DISPLAY_THRESHOLD. */
  displayRange: [number, number] | null;
  gatesFailed: GateFailure[];
  components: ComponentResult[];
  topGaps: SkillGap[];
  topStrengths: SkillStrength[];
  scoreVersion: string;
}

/** Optional inputs that never change the math for a given profile+job pair —
 *  they only supply extraction telemetry the engine cannot infer itself. */
export interface MatchOptions {
  /** Fraction (0-1) of raw skill strings that resolved to a canonical id
   *  during extraction. Feeds confidence, never the score. */
  taxonomyHitRate?: number;
  /** Overrides the clock for the `expiresAt` gate. Injected by tests so the
   *  suite stays deterministic; production passes nothing. */
  now?: Date;
}
