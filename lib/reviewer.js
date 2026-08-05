// Prompts + JSON schemas for the resume studio:
// 1. (removed — the ATS score now lives in lib/resume-health/)
// 2. profile → the 3 best-suited resume templates
// 3. resume + job → resume tailored to that one posting
// 4. profile + job → likely interview questions with sample answers
// 5. hired application → transferable lessons (the success feedback loop:
//    every win is distilled and fed back into 1-4 and cover letters)

import { TEMPLATES, TEMPLATE_IDS } from "./resume-templates.js";
import { LEARNING_CATEGORIES, formatLearnings } from "./learnings.js";

// Bound what we send per call — resumes are small, but don't trust input.
const MAX_PROMPT_CHARS = 15000;
const clip = (text) => (text ?? "").slice(0, MAX_PROMPT_CHARS);

// The ATS score and critique used to be produced HERE, by asking Claude to
// score the resume directly. That path is gone: lib/resume-health/ now runs a
// dual-parse harness over the PDF, has one classifier COUNT content signals,
// and computes the score deterministically in lib/resume-health/score.ts.
// Do not reintroduce a model-authored resume score.

/* ---------- Template recommendation ---------- */

export const TEMPLATE_REC_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      // Structured outputs don't support minItems > 1, so "exactly 3" is
      // enforced by the prompt and trimmed by the callers.
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: TEMPLATE_IDS },
          reason: {
            type: "string",
            description: "one line: why this template suits THIS candidate",
          },
        },
        required: ["id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks"],
  additionalProperties: false,
};

export const TEMPLATE_REC_SYSTEM_PROMPT = `You match candidates to resume templates. From the candidate's field,
seniority, and how dense their material is, pick the 3 best-suited templates
from the catalog — exactly 3, distinct, best first. Reasons must reference
the candidate's actual situation (their field, level, or content density),
not restate the template description.`;

export function buildTemplateRecPrompt(profile) {
  const catalog = TEMPLATES.map(
    (t) => `- ${t.id}: ${t.blurb} Best for: ${t.bestFor}.`
  ).join("\n");
  return `Candidate profile:\n${JSON.stringify(profile, null, 2)}

Template catalog:\n${catalog}

Pick the 3 best templates for this candidate.`;
}

/* ---------- Per-job tailoring ---------- */

export const TAILOR_SCHEMA = {
  type: "object",
  properties: {
    resume_markdown: {
      type: "string",
      description: "the complete tailored resume as clean markdown, ready to send",
    },
  },
  required: ["resume_markdown"],
  additionalProperties: false,
};

export const TAILOR_SYSTEM_PROMPT = `You tailor an existing resume to ONE specific job posting. Reorder and
re-emphasize the candidate's REAL material so whatever is most relevant to
this job leads every section, and mirror the posting's terminology only
where the candidate genuinely has that skill. HARD RULE: use only material
from the candidate's sources — never invent, and a requirement the
candidate lacks simply stays absent; tailoring means selection and
emphasis, not addition. Tight bullets, one page of clean markdown.`;

export function buildTailorPrompt(resumeText, insights, job, learnings) {
  return `Candidate's resume:\n${clip(resumeText)}${formatInsights(insights)}${formatLearnings(learnings)}

Target job:
Title: ${job.title}
Company: ${job.company}
Description:\n${clip(job.description)}

Tailor the resume to this job.`;
}

/* ---------- Interview prep ---------- */

export const INTERVIEW_PREP_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: {
            type: "string",
            description:
              "a strong first-person sample answer grounded ONLY in the candidate's real experience",
          },
          tip: {
            type: "string",
            description:
              "one-line coaching note: what the interviewer is probing and how to land the answer",
          },
        },
        required: ["question", "answer", "tip"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export const INTERVIEW_PREP_SYSTEM_PROMPT = `You are an interview coach preparing a candidate for one specific job.
Generate the 8 questions this interviewer is most likely to ask: a mix of
role-specific technical questions drawn from the job description, behavioral
questions, and one motivation/company-fit question. For each, write a strong
first-person sample answer grounded STRICTLY in the candidate's actual
resume — never invent experience. Where the job asks for something the
candidate lacks, the answer should honestly bridge from what they do have
(adjacent skills, fast learning, projects) instead of pretending. Answers are
concrete and specific — they name real projects, numbers, and technologies
from the resume. Each question also gets a one-line tip on what the
interviewer is really probing.`;

export function buildInterviewPrepPrompt({ profile, resumeText, job, coverLetter }) {
  return `Target job:
Title: ${job.title}
Company: ${job.company}
Description:\n${clip(job.description)}

Candidate profile:\n${JSON.stringify(profile, null, 2)}

Candidate's resume:\n${clip(resumeText)}${
    coverLetter ? `\n\nCover letter they applied with:\n${clip(coverLetter)}` : ""
  }

Generate the interview prep for this candidate and this job.`;
}

/* ---------- Success feedback loop ---------- */

export const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    lessons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["resume", "cover_letter", "skills", "strategy"],
          },
          insight: {
            type: "string",
            description:
              "one specific, transferable lesson from this winning application",
          },
        },
        required: ["category", "insight"],
        additionalProperties: false,
      },
    },
    // Fully anonymized lessons for the cross-account knowledge base
    // (lib/learnings.js). Distilled on the same call that extracts the
    // user's own lessons, so the global store costs no extra requests.
    globalLessons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: LEARNING_CATEGORIES },
          pattern: {
            type: "string",
            description:
              "one generalized lesson, max 25 words, that would hold for a stranger with a similar profile — no names, employers, locations, or contact details",
          },
        },
        required: ["category", "pattern"],
        additionalProperties: false,
      },
    },
  },
  required: ["lessons", "globalLessons"],
  additionalProperties: false,
};

export const INSIGHTS_SYSTEM_PROMPT = `A candidate just got HIRED. Study their winning application and extract
2-4 lessons that would transfer to other candidates and other applications:
what about the resume's content or framing likely worked, what the cover
letter did right, which skills or experiences carried the application, and
anything strategic about the fit. Lessons must be specific and actionable
("quantified infra cost savings in the first bullet"), never platitudes
("be confident"). Do not repeat lessons already in the list you are given —
return only genuinely new ones (an empty list is a valid answer).

Separately, produce 0-3 globalLessons for an anonymous knowledge base shared
across ALL candidates on the platform. Each must be fully generalized: true
for a stranger with a similar profile, phrased without the candidate's name,
employers, schools, locations, links, or any other identifying detail, and
without naming the hiring company. If a lesson is too specific to this person
to generalize honestly, leave it out — an empty list is a valid answer.`;

export function buildInsightsPrompt({ profile, resumeText, coverLetter, job, existing }) {
  return `Winning application for: ${job.title} at ${job.company}

Job description:\n${clip(job.description)}

Candidate profile:\n${JSON.stringify(profile, null, 2)}

Resume text:\n${clip(resumeText)}

Cover letter:\n${clip(coverLetter)}

Lessons already recorded (do not repeat):\n${
    existing.length ? existing.map((l) => `- ${l.insight}`).join("\n") : "(none yet)"
  }

Extract the new transferable lessons from this win.`;
}

// Flatten stored insight records into a prompt block, newest first.
// Returns "" when there is nothing to say, so callers can always append it.
export function formatInsights(insights, max = 20) {
  const lessons = (insights ?? [])
    .toReversed()
    .flatMap((record) => record.lessons.map((l) => `- [${l.category}] ${l.insight}`))
    .slice(0, max);
  if (lessons.length === 0) return "";
  return `\n\nLessons distilled from this platform's applications that led to actual hires — weigh this proven advice heavily:\n${lessons.join("\n")}`;
}
