// Prompts + JSON schemas for the resume studio:
// 1. resume text → structured review (score, strengths, issues with fixes)
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

export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description:
        "0-100 ATS-friendliness score: how cleanly an Applicant Tracking System can parse this resume and how well it would rank for a matching job. Higher = more ATS-friendly.",
    },
    summary: { type: "string", description: "two-sentence verdict on ATS-friendliness" },
    strengths: {
      type: "array",
      description: "what this resume already does well for ATS parsing/ranking",
      items: { type: "string" },
    },
    checks: {
      type: "array",
      description:
        "the specific ATS checks that were evaluated, each with a pass/warn/fail status",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description:
              "the ATS factor, e.g. 'Standard section headings', 'Parseable contact info', 'No tables/columns/graphics', 'Consistent date format', 'Keyword match to target roles', 'Standard fonts & bullets', 'Reverse-chronological order', 'Spelled-out acronyms', 'File length'",
          },
          status: { type: "string", enum: ["pass", "warn", "fail"] },
          detail: { type: "string", description: "one line: why this status, and what to change if not pass" },
        },
        required: ["label", "status", "detail"],
        additionalProperties: false,
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string", description: "which part of the resume, e.g. Experience" },
          severity: { type: "string", enum: ["critical", "important", "polish"] },
          problem: { type: "string" },
          fix: { type: "string", description: "concrete rewrite or action, not generic advice" },
        },
        required: ["section", "severity", "problem", "fix"],
        additionalProperties: false,
      },
    },
  },
  required: ["score", "summary", "strengths", "checks", "issues"],
  additionalProperties: false,
};

export const REVIEW_SYSTEM_PROMPT = `You are an ATS (Applicant Tracking System) resume auditor. Score and critique
the resume PRIMARILY on how ATS-friendly it is — whether automated parsers used
by Workday, Greenhouse, Taleo, Lever, etc. can read it cleanly, and whether it
would rank well when keyword-matched to a job in the candidate's field.

Judge these ATS factors and reflect them in the score and the checks list:
- PARSEABILITY: standard section headings (Experience, Education, Skills,
  Projects); a single-column, top-to-bottom reading order; NO tables, text
  boxes, multi-column layouts, images, icons, logos, or content in headers/
  footers that scramble parsers; standard fonts and simple bullet characters.
- CONTACT: name, email, phone, and location parseable as plain text (not in an
  image or header).
- STRUCTURE: reverse-chronological experience; consistent, machine-readable
  date formats (e.g. "Jan 2023 – Present"); clear job titles and employers.
- KEYWORDS: the hard skills, tools, and role titles a recruiter would search
  for actually appear, spelled out in full at least once (e.g. "Search Engine
  Optimization (SEO)"), not hidden behind acronyms or vague phrasing.
- CONTENT SIGNAL: quantified impact and action verbs (these help human readers
  after the ATS pass), plus reasonable length (1 page early-career, 1-2 pages
  otherwise).

We only receive the resume's extracted TEXT, so infer formatting problems from
what the text reveals (garbled columns, missing sections, odd characters,
run-together words, missing dates). Every issue and every non-passing check
must include a concrete fix — a rewritten line or a specific action — never
generic advice like "make it more ATS-friendly".`;

export function buildReviewPrompt(resumeText, insights, learnings) {
  // Anchor the model to the real current date — otherwise it judges resume
  // dates against its training cutoff and wrongly flags recent months as
  // "in the future".
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Audit this resume for ATS-friendliness. Score it, list the ATS checks with pass/warn/fail, note strengths, and give concrete fixes for every problem.\n\nToday's date is ${today}. Compare the resume's dates against it: a date only counts as "in the future" if it falls after today. Dates up to and including today are past or current — never flag them as future — and end dates slightly after today are normal too (expected graduation, a role's planned end).\n\nRESUME TEXT (extracted from the uploaded file):\n\n${clip(resumeText)}${formatInsights(insights)}${formatLearnings(learnings)}`;
}

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
