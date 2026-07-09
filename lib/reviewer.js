// Prompts + JSON schemas for the resume studio:
// 1. resume text → structured review (score, strengths, issues with fixes)
// 2. profile + transcript → next interview question ("grill me")
// 3. resume + transcript → rebuilt resume + enriched profile
// 4. hired application → transferable lessons (the success feedback loop:
//    every win is distilled and fed back into 1-3 and cover letters)

import { PROFILE_SCHEMA } from "./matcher.js";

// Bound what we send per call — resumes are small, but don't trust input.
const MAX_PROMPT_CHARS = 15000;
const clip = (text) => (text ?? "").slice(0, MAX_PROMPT_CHARS);

export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description: "0-100 overall resume quality (content, impact, clarity, structure)",
    },
    summary: { type: "string", description: "two-sentence overall verdict" },
    strengths: { type: "array", items: { type: "string" } },
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
  required: ["score", "summary", "strengths", "issues"],
  additionalProperties: false,
};

export const REVIEW_SYSTEM_PROMPT = `You are a blunt but constructive resume reviewer for tech roles.
Judge content over formatting: quantified impact, specific technologies, action verbs,
signal vs filler, and whether a recruiter skimming for 30 seconds finds the good parts.
Every issue must come with a concrete fix — a rewritten bullet or a specific action,
never generic advice like "add more detail".`;

export function buildReviewPrompt(resumeText, insights) {
  return `Review this resume:\n\n${clip(resumeText)}${formatInsights(insights)}`;
}

export const INTERVIEW_SCHEMA = {
  type: "object",
  properties: {
    done: {
      type: "boolean",
      description: "true when the transcript already covers enough for a strong resume",
    },
    focus: {
      type: "string",
      description: "short lowercase tag for what the question digs into, e.g. impact, projects, skills ('' when done)",
    },
    question: { type: "string", description: "the next question to ask ('' when done)" },
  },
  required: ["done", "focus", "question"],
  additionalProperties: false,
};

export const MAX_INTERVIEW_QUESTIONS = 10;

export const INTERVIEW_SYSTEM_PROMPT = `You are grilling a candidate to extract resume-worthy material they left out.
Ask ONE pointed question at a time. Hunt for what resumes usually miss:
numbers and outcomes behind vague bullets, projects and work they didn't list,
skills they use but never wrote down, scope (team size, users, scale), and
leadership or ownership moments. Cover breadth across experience, projects,
skills, and education instead of drilling one topic forever. Questions must be
short, specific to THIS candidate's resume and previous answers, and answerable
in a couple of sentences. If an answer was vague, one follow-up is fine — then
move on. Set done=true when the transcript covers enough ground to build a
noticeably better resume.`;

export function buildInterviewPrompt(profile, resumeText, interview, insights) {
  const answered = interview.questions.filter((q) => q.answer !== null);
  const transcript = answered
    .map((q, i) => `Q${i + 1} [${q.focus}]: ${q.question}\nA: ${q.answer}`)
    .join("\n\n");
  return `Candidate profile:\n${JSON.stringify(profile, null, 2)}

Resume text:\n${clip(resumeText)}

Interview so far:\n${transcript || "(not started)"}${formatInsights(insights)}

You have asked ${answered.length} of at most ${MAX_INTERVIEW_QUESTIONS} questions.
Ask the single most valuable next question, or set done=true if there is enough material.`;
}

export const BUILD_SCHEMA = {
  type: "object",
  properties: {
    profile: PROFILE_SCHEMA,
    resume_markdown: {
      type: "string",
      description: "the complete rebuilt resume as clean markdown, ready to use",
    },
  },
  required: ["profile", "resume_markdown"],
  additionalProperties: false,
};

export const BUILD_SYSTEM_PROMPT = `You rebuild resumes for tech roles from two sources: the candidate's
existing resume and their own interview answers. Use ONLY material from those
sources — never invent employers, dates, numbers, or skills. Fold the interview
material in where it makes bullets concrete: numbers, scale, outcomes, unlisted
skills and projects. Write tight bullets (action verb, specific tech, measurable
impact), cut filler, and keep it to one page of markdown with clear sections.
Also return the enriched candidate profile capturing everything now known —
this profile drives job matching, so include every real skill and project.`;

export function buildBuildPrompt(profile, resumeText, interview, insights) {
  const answered = (interview?.questions ?? []).filter((q) => q.answer !== null);
  const transcript = answered
    .map((q, i) => `Q${i + 1} [${q.focus}]: ${q.question}\nA: ${q.answer}`)
    .join("\n\n");
  return `Current profile:\n${JSON.stringify(profile, null, 2)}

Original resume:\n${clip(resumeText)}

Interview answers:\n${transcript || "(no interview — improve the resume from its own content)"}${formatInsights(insights)}

Rebuild the resume and return the enriched profile.`;
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
  },
  required: ["lessons"],
  additionalProperties: false,
};

export const INSIGHTS_SYSTEM_PROMPT = `A candidate just got HIRED. Study their winning application and extract
2-4 lessons that would transfer to other candidates and other applications:
what about the resume's content or framing likely worked, what the cover
letter did right, which skills or experiences carried the application, and
anything strategic about the fit. Lessons must be specific and actionable
("quantified infra cost savings in the first bullet"), never platitudes
("be confident"). Do not repeat lessons already in the list you are given —
return only genuinely new ones (an empty list is a valid answer).`;

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
