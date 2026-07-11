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
    // Stated FIRST on purpose: committing to the field before writing
    // queries anchors every query to it.
    field: {
      type: "string",
      description: "the candidate's professional field that bounds all recommendations below",
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "short generic job-board search query, e.g. 'frontend developer intern' — never company-specific",
          },
          kind: { type: "string", enum: ["job", "internship", "program"] },
          reason: {
            type: "string",
            description: "one line grounding this in the candidate's actual resume",
          },
        },
        required: ["query", "kind", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["field", "recommendations"],
  additionalProperties: false,
};

export const RECOMMEND_SYSTEM_PROMPT = `You are a pragmatic career advisor. First identify the candidate's actual
field from their degree(s) and work history — that field bounds every
recommendation. Recommend 3-6 job-board search queries strictly within it:
an electrical engineering student gets electrical/embedded/hardware/power
queries, a nursing graduate gets nursing queries. NEVER default to software
engineering, sales, marketing, or other unrelated fields just because they
are common job categories. A query outside the core field is allowed only
when the resume shows substantial real work in that second field (e.g. an
EE with serious firmware projects may get ONE embedded-software query).
Calibrate seniority to their real level: students and early-career get
internships, new-grad roles, and exploratory programs (fellowships,
apprenticeships); experienced candidates get roles matching their years.
Prefer fewer, precise queries over padding — every query the user runs
triggers real searches and paid screening, so an off-field query wastes
money as well as time. Every reason must cite the degree or experience
that justifies the query.`;

export function buildRecommendPrompt(profile) {
  // Spotlight the field signals so recommendations anchor to them instead
  // of drifting toward common job categories.
  const degrees = (profile.education ?? [])
    .map((e) => `${e.degree} in ${e.field}`)
    .join("; ");
  const titles = (profile.experience ?? []).map((e) => e.title).join("; ");
  return `THE CANDIDATE'S FIELD IS: ${profile.field ?? degrees ?? "derive it from the profile"}
Degrees: ${degrees || "(none listed)"}
Past role titles: ${titles || "(none listed)"}

Full candidate profile (extracted from their resume):
${JSON.stringify(profile, null, 2)}

State the field, then recommend ONLY job-board searches inside it. Any query
you cannot justify from the degree or work history above must be left out —
returning 3 precise queries is better than 6 with drift.`;
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
