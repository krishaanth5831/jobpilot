// Prompts + JSON schemas for the two core Claude calls:
// 1. resume → structured profile
// 2. profile + job description → match verdict

export const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    location: { type: "string" },
    field: {
      type: "string",
      description:
        "the candidate's professional field, derived from their degree(s) and work history, e.g. 'electrical engineering', 'nursing', 'software engineering'",
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          field: { type: "string" },
          graduation_year: { type: "string" },
        },
        required: ["institution", "degree", "field", "graduation_year"],
        additionalProperties: false,
      },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          duration: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
        },
        required: ["title", "company", "duration", "highlights"],
        additionalProperties: false,
      },
    },
    skills: { type: "array", items: { type: "string" } },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "technologies"],
        additionalProperties: false,
      },
    },
    years_of_experience: { type: "number" },
  },
  required: [
    "name",
    "email",
    "location",
    "field",
    "education",
    "experience",
    "skills",
    "projects",
    "years_of_experience",
  ],
  additionalProperties: false,
};

export const MATCH_SCHEMA = {
  type: "object",
  properties: {
    qualified: {
      type: "boolean",
      description:
        "true only if the candidate meets the hard requirements stated in the job posting",
    },
    score: {
      type: "integer",
      description: "0-100 fit score based on requirements met and relevance",
    },
    matched_requirements: { type: "array", items: { type: "string" } },
    missing_requirements: { type: "array", items: { type: "string" } },
    reasoning: {
      type: "string",
      description: "one short paragraph explaining the verdict",
    },
  },
  required: [
    "qualified",
    "score",
    "matched_requirements",
    "missing_requirements",
    "reasoning",
  ],
  additionalProperties: false,
};

// Turn a user's free-text search into the concise job-board title that
// actually matches listings. Keyword APIs (JSearch/Adzuna) return nothing for
// "electrical engineering undergraduate internship program" but plenty for
// "Electrical Engineer Intern" — this bridges that gap.
export const QUERY_SCHEMA = {
  type: "object",
  properties: {
    titles: {
      type: "array",
      description:
        "2-3 job-board title variants for this search, best first. Title Case, 2-4 words each.",
      items: { type: "string" },
    },
  },
  required: ["titles"],
  additionalProperties: false,
};

export const QUERY_SYSTEM_PROMPT = `Rewrite a job search into the concise job TITLES recruiters post on LinkedIn
and Indeed, so a keyword job board actually matches it. Return 2-3 variants,
best first — job boards are picky about exact wording, so multiple phrasings
maximize hits. Rules:
- Job titles name the ROLE a person holds. Prefer the role noun over the
  discipline: "Electrical Engineer Intern" over "Electrical Engineering
  Intern", "Data Scientist" over "Data Science". When a field could go either
  way, include BOTH forms as variants (e.g. "Electrical Engineer Intern" and
  "Electrical Engineering Intern") plus a close cousin ("Hardware Engineer
  Intern").
- Keep the seniority signal: intern/internship → "Intern"; new grad → "New
  Grad" or "Graduate"; senior/lead/principal → keep it. No signal → omit it.
- Drop filler ("undergraduate", "program", "opportunity", "position",
  "looking for") and any location (handled separately).
- If the input is already a company name or a single clean title, return just
  that one item.
- Every item is 2-4 words, Title Case.`;

export function buildQueryPrompt(role) {
  return `User's search: "${role}"\nReturn 2-3 common job-board title variants for it, best first.`;
}

export const ROADMAP_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: {
            type: "string",
            enum: ["skill", "project", "certification", "experience", "education"],
          },
          estimated_time: { type: "string" },
          resources: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "category", "estimated_time", "resources"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "steps"],
  additionalProperties: false,
};

export const RECOMMEND_SCHEMA = {
  type: "object",
  properties: {
    // Stated FIRST on purpose: committing to the field before writing the
    // rest anchors every recommendation to it.
    field: {
      type: "string",
      description: "the candidate's professional field that bounds all recommendations below",
    },
    companies: {
      type: "array",
      description:
        "at least 30 real, well-known companies that hire in this field, best fits first",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "a real, well-known company that hires in this field (bias to the candidate's region if known), e.g. 'ASML', 'NXP', 'Infineon'",
          },
          reason: {
            type: "string",
            description: "one short line on why this company fits the candidate's field/level/location",
          },
        },
        required: ["name", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["field", "companies"],
  additionalProperties: false,
};

export const RECOMMEND_SYSTEM_PROMPT = `You are a pragmatic career advisor. First identify the candidate's actual
field from their degree(s) and work history — that field bounds everything.

Then produce ONE list:
COMPANIES — AT LEAST 30 real, well-known employers that genuinely hire in the
candidate's field, ordered best-fit first. Include a mix: the marquee names in
the field, strong mid-size employers, and notable up-and-comers. Bias heavily
to the candidate's country/region if their resume shows one (an EE student in
the Netherlands → ASML, NXP, Philips, Signify, TomTom, Thales, Airbus…), but
also include the global leaders in the field so the list is worldwide. Use
real company names only — never invent one, never pad the list with companies
that don't hire in this field just to reach 30.

Stay strictly in-field: an electrical engineering candidate gets electrical /
embedded / hardware / power / semiconductor employers — NEVER default to
generic software, sales, or consulting firms just because they are common,
unless the resume shows substantial real work in that second field. Every
reason must cite the field, the candidate's level, or their location.`;

export function buildRecommendPrompt(profile) {
  // Spotlight the field + location signals so recommendations anchor to them
  // instead of drifting toward common job categories.
  const degrees = (profile.education ?? [])
    .map((e) => `${e.degree} in ${e.field}`)
    .join("; ");
  const titles = (profile.experience ?? []).map((e) => e.title).join("; ");
  return `THE CANDIDATE'S FIELD IS: ${profile.field ?? degrees ?? "derive it from the profile"}
Degrees: ${degrees || "(none listed)"}
Past role titles: ${titles || "(none listed)"}
Location: ${profile.location || "(unknown — recommend widely-hiring global companies)"}

Full candidate profile (extracted from their resume):
${JSON.stringify(profile, null, 2)}

State the field, then list at least 30 real target companies inside it,
best-fit first. Bias to the candidate's region but keep the list worldwide.
Leave out any company that does not genuinely hire in this field.`;
}

export const MATCH_SYSTEM_PROMPT = `You are a strict but fair recruiter screening a candidate against a job posting.
Judge only from what is actually on the resume — do not assume unlisted skills.
Distinguish hard requirements (must-have) from nice-to-haves; a candidate is
"qualified" when they meet the hard requirements, even if some nice-to-haves are missing.`;

export function buildMatchPrompt(profile, job) {
  return `Candidate profile (extracted from their resume):
${JSON.stringify(profile, null, 2)}

Job posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description}

Evaluate whether this candidate qualifies for this job.`;
}
