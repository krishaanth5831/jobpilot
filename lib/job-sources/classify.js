// Derives an employment type and experience level for every job so the UI
// can filter by "internship vs full-time", "part-time", and seniority. Sources
// are wildly inconsistent — some expose a structured type/level, most don't —
// so each adapter passes whatever hint it has (employmentHint / levelHint) and
// we fall back to reading the title. Pure JS, keyword-based, free.

const has = (s, re) => re.test(s);

/** internship | fulltime | parttime | contract */
export function classifyEmployment(hint, title = "") {
  const s = `${hint ?? ""} ${title}`.toLowerCase();
  if (has(s, /\b(intern|interns|internship|co-?op|trainee|apprentice|apprenticeship|working student|werkstudent|placement|praktikum|stage)\b/))
    return "internship";
  if (has(s, /\bpart[\s_-]?time\b/)) return "parttime";
  if (has(s, /\b(contract|contractor|freelance|freelancer|temporary|temp|fixed[\s_-]?term|seasonal)\b/))
    return "contract";
  return "fulltime";
}

/** intern | entry | mid | senior */
export function classifyLevel(hint, title = "", employmentType) {
  if (employmentType === "internship") return "intern";
  const s = `${hint ?? ""} ${title}`.toLowerCase();
  if (has(s, /\b(senior|sr\.?|lead|principal|staff|manager|head|director|vp|vice president|chief|expert|architect)\b/))
    return "senior";
  if (has(s, /\b(junior|jr\.?|entry|entry[\s-]?level|graduate|new[\s-]?grad|associate|trainee|apprentice)\b/))
    return "entry";
  if (has(s, /\b(mid|mid[\s-]?level|intermediate)\b/)) return "mid";
  return "mid";
}

/**
 * @param {{title?: string, employmentHint?: string, levelHint?: string}} job
 * @returns {{ employmentType: string, level: string }}
 */
export function classifyJob(job) {
  const employmentType = classifyEmployment(job.employmentHint, job.title ?? "");
  const level = classifyLevel(job.levelHint, job.title ?? "", employmentType);
  return { employmentType, level };
}

// Display labels for the UI dropdowns.
export const EMPLOYMENT_LABELS = {
  internship: "Internship",
  fulltime: "Full-time",
  parttime: "Part-time",
  contract: "Contract",
};
export const LEVEL_LABELS = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
};
