// The LLM's ONLY job in the matching pipeline: read a job description and
// report the facts it states. It never sees the candidate, never compares
// anything, and never emits a score — `computeMatch` does all of that.
//
// This replaces the old MATCH_SCHEMA call, which asked Claude to produce the
// score directly. Same number of Claude calls per job as before; the model has
// simply been demoted from judge to extractor.

/** Free-text facts as the model reports them, before taxonomy resolution. */
export interface RawJobFacts {
  requiredSkills: { skill: string; weight: number }[];
  preferredSkills: { skill: string; weight: number }[];
  minYears: number;
  maxYears: number;
  seniority: number;
  degreeRequired: number;
  fieldPreference: string;
  equivalentExperienceAccepted: boolean;
  city: string;
  country: string;
  remotePolicy: string;
  workAuthRequired: string[];
  sponsorshipAvailable: boolean;
  requiredCredentials: string[];
  languagesRequired: { lang: string; minCefr: string }[];
}

/** JSON Schema for `askClaudeJSON`. Every property is required and
 *  `additionalProperties` is false, matching the house style in lib/matcher.js
 *  — absent facts are reported as "" or [], never omitted. */
export const JOB_FACTS_SCHEMA = {
  type: "object",
  properties: {
    requiredSkills: {
      type: "array",
      description:
        "hard requirements only — skills the posting states as must-have. weight 1-5 by how central the posting makes it.",
      items: {
        type: "object",
        properties: {
          skill: { type: "string", description: "the skill as a short noun phrase, e.g. 'React', 'PCB design'" },
          weight: { type: "number", description: "1-5, higher = more central to the role" },
        },
        required: ["skill", "weight"],
        additionalProperties: false,
      },
    },
    preferredSkills: {
      type: "array",
      description: "nice-to-haves, bonus points, 'a plus' items. Same weighting scale.",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          weight: { type: "number" },
        },
        required: ["skill", "weight"],
        additionalProperties: false,
      },
    },
    minYears: {
      type: "number",
      description: "minimum years of experience stated. 0 if none stated or if it is an internship.",
    },
    maxYears: {
      type: "number",
      description:
        "upper end of the stated range. If only a minimum is given, use minYears + 4. If nothing is stated, use 40.",
    },
    seniority: {
      type: "integer",
      description: "0 intern, 1 entry, 2 junior, 3 mid, 4 senior, 5 lead/principal+",
    },
    degreeRequired: {
      type: "integer",
      description:
        "0 none stated, 1 high school, 2 associate, 3 bachelor, 4 master, 5 doctorate. Use the minimum the posting actually requires.",
    },
    fieldPreference: {
      type: "string",
      description:
        "preferred field of study as plain text, e.g. 'electrical engineering'. Empty string if the posting does not name one.",
    },
    equivalentExperienceAccepted: {
      type: "boolean",
      description: "true if the posting says equivalent practical experience can substitute for the degree",
    },
    city: { type: "string", description: "office city, or empty string" },
    country: {
      type: "string",
      description: "ISO 3166-1 alpha-2 country code of the role, e.g. 'NL'. Empty string if not stated.",
    },
    remotePolicy: { type: "string", enum: ["onsite", "hybrid", "remote"] },
    workAuthRequired: {
      type: "array",
      description:
        "ISO 3166-1 alpha-2 codes the posting requires existing work authorisation for. Empty unless the posting explicitly demands it.",
      items: { type: "string" },
    },
    sponsorshipAvailable: {
      type: "boolean",
      description:
        "true unless the posting explicitly says it cannot sponsor. Default to true when the posting is silent.",
    },
    requiredCredentials: {
      type: "array",
      description:
        "licences/clearances that are hard requirements, e.g. 'Security clearance', 'PE licence', 'driving licence'. Not skills, not degrees.",
      items: { type: "string" },
    },
    languagesRequired: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lang: { type: "string", description: "language name in English, e.g. 'Dutch'" },
          minCefr: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
        },
        required: ["lang", "minCefr"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "requiredSkills",
    "preferredSkills",
    "minYears",
    "maxYears",
    "seniority",
    "degreeRequired",
    "fieldPreference",
    "equivalentExperienceAccepted",
    "city",
    "country",
    "remotePolicy",
    "workAuthRequired",
    "sponsorshipAvailable",
    "requiredCredentials",
    "languagesRequired",
  ],
  additionalProperties: false,
} as const;

export const JOB_FACTS_SYSTEM_PROMPT = `You read a job posting and report ONLY the facts it states. You are an
extractor, not a judge: you never rate a candidate, never score anything, and
never infer what kind of person would fit. A separate deterministic system does
the scoring from your output.

Rules:
- Report only what the posting says. If it does not state something, use the
  documented default (empty string, empty list, or the value described in the
  field). Never invent a requirement.
- Separate HARD requirements from nice-to-haves carefully. "Must have",
  "required", "you have" are hard. "Bonus", "a plus", "nice to have",
  "preferred", "ideally" are preferred. When a posting is vague, prefer
  classifying as preferred — over-stating hard requirements wrongly penalises
  candidates.
- Split compound requirements into separate skills: "React and TypeScript" is
  two entries, not one.
- Weight by how central the posting makes each skill: something in the title or
  first bullet is a 5, something mentioned once in passing is a 1.
- Work authorisation and sponsorship are consequential. Only list
  workAuthRequired when the posting explicitly demands existing authorisation,
  and only set sponsorshipAvailable to false when it explicitly rules
  sponsorship out.`;

export function buildJobFactsPrompt(job: {
  title: string;
  company: string;
  location: string;
  description: string;
}): string {
  return `Job posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

Description:
${job.description}

Report the facts this posting states.`;
}
