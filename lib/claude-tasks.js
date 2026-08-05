// Which model and how hard it thinks, decided per TASK rather than per account.
//
// This used to be two dropdowns on the Settings page. Nobody knows whether
// their resume review wants Sonnet at high effort — and the wrong answer is
// either a worse product or a bill several times larger than it needed to be.
// The call site knows what it is asking for, so the call site says so, and the
// policy below turns that into parameters.
//
// THE RULES, and they are enforced by assertions at the bottom of this file
// rather than left as prose:
//
//   1. Haiku is the default and carries almost everything.
//   2. Sonnet is only for the few tasks where judgment is the product, and
//      always at LOW effort — the model is the upgrade, not the thinking
//      budget. Sonnet at high effort costs more than it is worth here.
//   3. Opus is never used. Not for any task, at any effort.
//
// Effort is where the tuning happens. It scales with how much reasoning the
// task genuinely needs, from `low` on a 300-token query rewrite to `high` on
// analysing why an application succeeded.

export const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-5";

/** Every Claude call in the app, and what it costs to do well. */
const TASKS = {
  // --- Cheap and mechanical: shape data, pick from a list -----------------
  // A 300-token rewrite of a search query. There is no reasoning to buy here,
  // and the call is too small to fit a thinking budget at all.
  query_rewrite: { model: HAIKU, effort: "low" },
  // Suggest searches from a profile. Recall, not judgment.
  recommend: { model: HAIKU, effort: "low" },
  // Pick resume templates from a fixed list.
  template_pick: { model: HAIKU, effort: "low" },
  // A short, formulaic nudge after silence.
  follow_up_email: { model: HAIKU, effort: "low" },

  // Counting bullets, metrics and cliches in a resume. Pure extraction with a
  // strict schema and no judgment to buy — the resume-health score is computed
  // from these counts by lib/resume-health/score.ts, not by the model. Cached
  // by content hash, so identical text is never counted twice.
  resume_classify: { model: HAIKU, effort: "low" },

  // --- The middle: structured work with real judgment in it ---------------
  // Resume text to a structured profile. Extraction, but the whole app reads
  // the result, so it is worth some thinking.
  profile_extract: { model: HAIKU, effort: "medium" },
  // The match verdict. Genuinely hard — and by far the highest volume call in
  // the app, one per job per search. Sonnet here would multiply the bill by
  // the size of every result page, so it buys thinking instead of a model.
  job_match: { model: HAIKU, effort: "medium" },
  interview_prep: { model: HAIKU, effort: "medium" },

  // --- Expensive thinking, rare calls -------------------------------------
  // Reads a hired application and works out what actually made it land. Runs
  // a handful of times ever, and the conclusions feed every future prompt.
  insights: { model: HAIKU, effort: "high" },
  // The letter a person actually sends to an employer. Volume is moderate
  // (auto-apply drafts these), so it gets the thinking budget rather than the
  // bigger model — flip it to Sonnet here if drafts read as generic.
  cover_letter: { model: HAIKU, effort: "high" },

  // --- Sonnet, low effort, and only these ---------------------------------
  // The ATS score and critique. Free on every plan forever, and the thing
  // that has to be good before anyone believes the rest of it.
  resume_review: { model: SONNET, effort: "low" },
  // Turning a rejection into a specific, ordered plan. Pure reasoning, and
  // rare enough that the better model is affordable.
  skill_roadmap: { model: SONNET, effort: "low" },
  // Rewriting a real resume against one posting. Selection, never invention —
  // and the failure mode of a weaker model here is quiet fabrication.
  tailored_resume: { model: SONNET, effort: "low" },
};

/**
 * The policy for a task. Unknown names fall back to the cheapest sensible
 * setting rather than throwing: a mislabelled call should cost less than it
 * should, not take a route down with it.
 */
export function policyFor(task) {
  return TASKS[task] ?? { model: HAIKU, effort: "low" };
}

// --- Invariants ------------------------------------------------------------
// Checked once at module load, so a policy that breaks a rule fails the build
// and the test suite rather than quietly running up a bill in production.

for (const [name, { model, effort }] of Object.entries(TASKS)) {
  if (model !== HAIKU && model !== SONNET) {
    throw new Error(`${name}: only Haiku and Sonnet may be used, got ${model}`);
  }
  if (model === SONNET && effort !== "low") {
    throw new Error(`${name}: Sonnet must always run at low effort, got ${effort}`);
  }
  if (!["low", "medium", "high"].includes(effort)) {
    throw new Error(`${name}: unknown effort ${effort}`);
  }
}
