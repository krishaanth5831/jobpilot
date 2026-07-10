// Prompts + JSON schemas for the two core Claude calls:
// 1. resume → structured profile
// 2. profile + job description → match verdict

export const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    location: { type: "string" },
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
  required: ["recommendations"],
  additionalProperties: false,
};

export const RECOMMEND_SYSTEM_PROMPT = `You are a pragmatic career advisor. From the candidate's structured
profile, recommend 4-6 job-board search queries for roles they are ACTUALLY
qualified for today — calibrate to their real level. Students and early-career
candidates get internships, new-grad roles, and exploratory programs
(fellowships, open-source programs, apprenticeships); experienced candidates
get roles matching their years and stack. Mix kinds where it makes sense.
Every reason must cite something concrete from their resume. Queries must be
short generic search terms job boards understand.`;

export function buildRecommendPrompt(profile) {
  return `Candidate profile (extracted from their resume):
${JSON.stringify(profile, null, 2)}

Recommend the job-board searches this candidate should run.`;
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
