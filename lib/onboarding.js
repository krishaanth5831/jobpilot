// The signup questionnaire, as data.
//
// Pure — no server imports — so the flow renders from this list and the API
// validates against the same list. A question that is not here cannot be
// stored, and an answer that is not one of a question's own choices is
// rejected, so nothing arbitrary reaches the database from a client.
//
// Ten questions is the ceiling. Every one of them either changes what the
// product does for this person, or answers a question worth asking once and
// never again. Anything that fails both tests does not belong here — an
// abandoned signup is worth less than any answer.

export const ONBOARDING_VERSION = 1;
export const MAX_QUESTIONS = 10;

/**
 * kind:
 *   "text"   - short free text
 *   "choice" - one of `choices`, optionally with a free-text "Other"
 * required: cannot be skipped. Kept to the two answers the app genuinely
 *   needs, because every required field is a place people leave.
 */
export const QUESTIONS = [
  {
    id: "fullName",
    kind: "text",
    question: "First, what should we call you?",
    hint: "Your full name — it goes on the resumes and cover letters jobblast writes for you.",
    placeholder: "Alex Doe",
    required: true,
    maxLength: 80,
  },
  {
    id: "location",
    kind: "text",
    question: "Where are you looking for work?",
    hint: "A city or a country. This is what jobblast searches — you can change it any time.",
    placeholder: "Amsterdam, Netherlands",
    required: true,
    maxLength: 80,
  },
  {
    id: "stage",
    kind: "choice",
    question: "Where are you in your career?",
    hint: "It changes which roles count as a realistic match for you.",
    choices: [
      "Still studying",
      "Final year or just graduated",
      "1–3 years in",
      "4–7 years in",
      "8+ years in",
      "Changing field entirely",
    ],
  },
  {
    id: "field",
    kind: "choice",
    question: "What field are you in?",
    choices: [
      "Software and IT",
      "Data and analytics",
      "Engineering (non-software)",
      "Business, finance and operations",
      "Design and product",
      "Marketing and sales",
      "Science and research",
      "Healthcare",
    ],
    other: "Something else",
  },
  {
    id: "role",
    kind: "text",
    question: "What role are you going for?",
    hint: "The job title you would type into a search box.",
    placeholder: "Junior data engineer",
    maxLength: 80,
  },
  {
    id: "university",
    kind: "text",
    question: "Where did you study?",
    hint: "University, college or programme. Skip it if it is not relevant to you.",
    placeholder: "University of Amsterdam",
    maxLength: 120,
  },
  {
    id: "workMode",
    kind: "choice",
    question: "How do you want to work?",
    choices: ["Remote only", "Hybrid", "On-site", "No preference"],
  },
  {
    id: "urgency",
    kind: "choice",
    question: "How soon do you need this?",
    hint: "An honest answer here is more useful than an ambitious one.",
    choices: [
      "I am applying right now",
      "Within the next three months",
      "Later this year",
      "Just looking around",
    ],
  },
  {
    id: "obstacle",
    kind: "choice",
    question: "What has been hardest so far?",
    choices: [
      "I apply and never hear back",
      "I cannot tell which jobs I actually qualify for",
      "I do not know where to look",
      "My resume is not landing",
      "Interviews",
      "Nothing yet — I am just starting",
    ],
  },
  {
    id: "source",
    kind: "choice",
    question: "Last one: how did you find jobblast?",
    choices: [
      "A friend or colleague",
      "Reddit",
      "LinkedIn",
      "TikTok or Instagram",
      "YouTube",
      "Google search",
      "A newsletter or creator",
    ],
    other: "Somewhere else",
  },
];

if (QUESTIONS.length > MAX_QUESTIONS) {
  throw new Error(`Onboarding is capped at ${MAX_QUESTIONS} questions`);
}

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
export const questionById = (id) => QUESTIONS.find((q) => q.id === id) ?? null;

const clean = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : null;

/**
 * Reduce whatever the client posted to answers this questionnaire recognises.
 *
 * Unknown ids are dropped. A choice must be one of that question's own
 * choices, unless the question offers "Other", in which case free text is
 * allowed — that is the only path by which a user-authored string becomes a
 * choice answer, and it is length-capped like any other text.
 *
 * @returns {{ answers: object, missing: string[] }} `missing` lists required
 * questions with no usable answer, so the API can refuse rather than store a
 * half-filled profile.
 */
export function sanitizeAnswers(input) {
  const source = input && typeof input === "object" ? input : {};
  const answers = {};
  const missing = [];

  for (const q of QUESTIONS) {
    const raw = source[q.id];
    let value = null;

    if (q.kind === "text") {
      value = clean(raw, q.maxLength ?? 120) || null;
    } else if (q.kind === "choice") {
      const picked = clean(raw, 120);
      if (picked && q.choices.includes(picked)) value = picked;
      else if (picked && q.other) value = picked; // free text behind "Other"
    }

    if (value === null && q.required) missing.push(q.id);
    answers[q.id] = value;
  }

  return { answers, missing };
}
