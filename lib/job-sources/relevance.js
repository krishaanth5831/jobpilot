// Title-relevance gate for sources without trustworthy server-side search.
// Generic words ("intern", "junior"…) match everything, so a title must hit
// at least one CORE term of the query — "Sales Intern" must not survive an
// "electrical engineering intern" search on the word "intern" alone. Every
// stored junk job costs a Claude screening call, so this gate is also the
// cost control.
//
// Role-suffix words (engineer, developer, specialist, analyst…) are generic
// too: they only mean something with their qualifier, otherwise every
// "Software Engineer" would match an electrical engineering search.

const GENERIC = new Set([
  "intern",
  "interns",
  "internship",
  "internships",
  "co-op",
  "coop",
  "junior",
  "senior",
  "entry",
  "entry-level",
  "new",
  "grad",
  "graduate",
  "level",
  "job",
  "jobs",
  "role",
  "roles",
  "position",
  "positions",
  "full-time",
  "part-time",
  "remote",
  "the",
  "and",
  "of",
  "in",
  "engineer",
  "engineers",
  "engineering",
  "developer",
  "developers",
  "development",
  "specialist",
  "specialists",
  "analyst",
  "analysts",
  "manager",
  "managers",
  "assistant",
  "associate",
  "consultant",
  "coordinator",
  "technician",
  "technicians",
  "scientist",
  "scientists",
]);

export function roleTerms(role) {
  return role.toLowerCase().split(/\s+/).filter(Boolean);
}

// Light stemming so "engineering" matches "Engineer" and "systems" matches
// "system": also try the term without a trailing "ing"/"s".
function termInTitle(title, term) {
  if (title.includes(term)) return true;
  const stems = [term.replace(/ing$/, ""), term.replace(/s$/, "")];
  return stems.some((s) => s !== term && s.length > 3 && title.includes(s));
}

/**
 * @returns {{ score: number, relevant: boolean }} score = matched terms
 * (for ranking); relevant = at least one core (non-generic) term matched.
 * A query made entirely of generic words falls back to any-term matching.
 */
export function titleRelevance(title, terms) {
  const t = title.toLowerCase();
  const matched = terms.filter((term) => termInTitle(t, term));
  const core = terms.filter((term) => !GENERIC.has(term));
  const relevant =
    core.length === 0
      ? matched.length > 0
      : core.some((term) => termInTitle(t, term));
  return { score: matched.length, relevant };
}
