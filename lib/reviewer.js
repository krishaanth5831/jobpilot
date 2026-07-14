// Prompts + JSON schemas for the resume studio:
// 1. resume text → structured review (score, strengths, issues with fixes)
// 2. profile + transcript → next interview question ("grill me")
// 3. resume + transcript → rebuilt resume + enriched profile
// 4. hired application → transferable lessons (the success feedback loop:
//    every win is distilled and fed back into 1-3 and cover letters)

import { PROFILE_SCHEMA } from "./matcher.js";
import { TEMPLATES, TEMPLATE_IDS } from "./resume-templates.js";

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

export function buildReviewPrompt(resumeText, insights) {
  return `Audit this resume for ATS-friendliness. Score it, list the ATS checks with pass/warn/fail, note strengths, and give concrete fixes for every problem.\n\nRESUME TEXT (extracted from the uploaded file):\n\n${clip(resumeText)}${formatInsights(insights)}`;
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

export const INTERVIEW_SYSTEM_PROMPT = `You are interviewing a candidate to collect exactly what is needed to fix
the known gaps in their resume. You are given a numbered gap list — work
through it in order, ONE pointed question at a time, each question targeting
ONE specific gap and phrased so the answer supplies the missing material:
numbers, outcomes, scope, dates, technologies, names. Set focus to a short
label naming the gap the question targets (e.g. "no metrics on Acme role").
If an answer was vague, ask one follow-up for the concrete detail, then move
to the next gap. Do not wander: no gap may be skipped in favor of a generic
question. Only once every gap that a candidate's answer could fix has been
covered, spend remaining questions on material that would strengthen the
resume beyond the gaps: quantified wins, unlisted projects or skills, and
leadership or ownership moments. Questions must be short, specific to THIS
resume and the previous answers, and answerable in a couple of sentences.
Set done=true when the gaps are covered and the transcript holds enough to
rebuild a clearly better resume.`;

// The gap list the interview works through. Prefer the review's findings;
// without a review, tell Claude to derive the gaps itself.
function formatGaps(review) {
  if (!review?.issues?.length) {
    return `(no review available — derive the gap list yourself from the resume:
vague bullets without numbers, missing scope, absent sections, skills with no
evidence, unexplained time gaps)`;
  }
  return review.issues
    .map((i, n) => `${n + 1}. [${i.severity}] ${i.section}: ${i.problem} (suggested fix: ${i.fix})`)
    .join("\n");
}

export function buildInterviewPrompt(profile, resumeText, interview, insights, review) {
  const answered = interview.questions.filter((q) => q.answer !== null);
  const transcript = answered
    .map((q, i) => `Q${i + 1} [${q.focus}]: ${q.question}\nA: ${q.answer}`)
    .join("\n\n");
  return `Candidate profile:\n${JSON.stringify(profile, null, 2)}

Resume text:\n${clip(resumeText)}

Gaps in this resume, in priority order:\n${formatGaps(review)}

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

export const BUILD_SYSTEM_PROMPT = `You rebuild resumes for tech roles from exactly two sources: the
candidate's existing resume and their own interview answers. HARD RULE:
every number, technology, feature, employer, date, and outcome in your
output must be traceable to one of those two sources. You are given the
resume's known gap list — resolve each gap by folding in the interview
answer that targets it. A gap with NO supporting material in the sources
stays unfixed: leave that part of the resume as it was. Filling a gap with
plausible-sounding specifics the candidate never stated is the worst
possible failure — a resume with an honest hole beats one with an invented
detail. Each answer belongs to the job or project its question was about
(read the question to see which) — place the material in that entry and
never move it to a different job or project. Write tight bullets (action verb, specific tech, measurable
impact), cut filler, and keep it to one page of markdown with clear
sections. Also return the enriched candidate profile capturing everything
now known — it drives job matching, so include every skill and project
from the sources, and nothing else.`;

// Deliberately does NOT include the stored profile: a previous rebuild
// writes its enriched profile back to the db, so passing it here would let
// any past hallucination re-enter as trusted source material. The original
// resume + the candidate's own answers are the only ground truth.
export function buildBuildPrompt(resumeText, interview, insights, review) {
  const answered = (interview?.questions ?? []).filter((q) => q.answer !== null);
  const transcript = answered
    .map((q, i) => `Q${i + 1} [${q.focus}]: ${q.question}\nA: ${q.answer}`)
    .join("\n\n");
  return `Original resume:\n${clip(resumeText)}

Gaps to resolve, in priority order:\n${formatGaps(review)}

Interview answers (each targets one of the gaps above):\n${transcript || "(no interview — improve the resume from its own content)"}${formatInsights(insights)}

Rebuild the resume and return the enriched profile.`;
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

export function buildTailorPrompt(resumeText, interview, insights, job) {
  const answered = (interview?.questions ?? []).filter((q) => q.answer !== null);
  const transcript = answered
    .map((q, i) => `Q${i + 1} [${q.focus}]: ${q.question}\nA: ${q.answer}`)
    .join("\n\n");
  return `Candidate's resume:\n${clip(resumeText)}

Extra material from the candidate's interview answers:\n${transcript || "(none)"}${formatInsights(insights)}

Target job:
Title: ${job.title}
Company: ${job.company}
Description:\n${clip(job.description)}

Tailor the resume to this job.`;
}

// A self-contained prompt the user can paste into claude.ai to run the
// rebuild there with a stronger model. Same sources and same honesty rules
// as the in-app rebuild — just packaged for a chat window.
export function buildClaudePastePrompt(resumeText, interview, insights, review) {
  const answered = (interview?.questions ?? []).filter((q) => q.answer !== null);
  const transcript = answered
    .map((q, i) => `Q${i + 1} [${q.focus}]: ${q.question}\nA: ${q.answer}`)
    .join("\n\n");
  return `Rebuild my resume. Rules:
- Use ONLY the material in this message — never invent employers, dates, numbers, technologies, features, or skills.
- Work through the gap list below and resolve each gap using my interview answers or the resume itself. A gap with no supporting material stays unfixed: an honest hole beats an invented detail.
- Each interview answer belongs to the job or project its question was about — put the material there, never move it elsewhere.
- Tight bullets: action verb, specific tech, measurable impact. Cut filler. One page, clean markdown with clear sections.

=== MY CURRENT RESUME ===
${clip(resumeText)}

=== GAPS FOUND BY A PROFESSIONAL REVIEW (priority order) ===
${formatGaps(review)}

=== MY INTERVIEW ANSWERS (extra material, each tied to the question's subject) ===
${transcript || "(none — improve the resume from its own content)"}${formatInsights(insights)}

Return the complete rebuilt resume as clean markdown, followed by a short list of what you changed and why.`;
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
