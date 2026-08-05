// The issue registry. One entry per deduction in score.ts.
//
// Each issue knows how to detect itself and how to RESOLVE itself — resolve
// returns a metric set with that one term set to its ideal value and nothing
// else touched. score.ts re-scores the resolved metrics and takes the delta,
// which is what makes `Fix.pointsRecoverable` exactly true.
//
// This module imports types only. It must never import score.ts, or the
// re-scoring loop would be circular.

import type { ComponentId, Evidence, HealthInput, Metrics } from "./types";

export interface IssueDefinition {
  id: string;
  component: ComponentId;
  /** True when jobblast's own resume editor could make the change itself. */
  autoFixable: boolean;
  detect: (m: Metrics) => boolean;
  resolve: (m: Metrics) => Metrics;
  message: (m: Metrics, input: HealthInput) => string;
  howToFix: (m: Metrics, input: HealthInput) => string;
  evidence: (input: HealthInput) => Evidence | null;
}

const noEvidence = (): Evidence | null => null;

/** Locate the first line matching `pattern` for a page/line/snippet citation. */
function findLine(input: HealthInput, pattern: RegExp): Evidence | null {
  const lines = input.rawText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && pattern.test(line)) {
      return { page: 1, line: i + 1, snippet: line.trim().slice(0, 160) };
    }
  }
  return null;
}

/** First role whose parse went wrong, with the evidence the parser recorded. */
function roleEvidence(input: HealthInput, predicate: (r: { title: string | null; company: string | null; datesParseable: boolean }) => boolean): Evidence | null {
  const role = input.parseReport.document.roles.find(predicate);
  return role?.evidence ?? null;
}

const list = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/* -------------------------------------------------------------------------
 * Parseability
 * ---------------------------------------------------------------------- */

const parseabilityIssues: IssueDefinition[] = [
  {
    id: "parse.field-recovery",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.fieldRecoveryPenalty > 0,
    resolve: (m) => ({ ...m, fieldRecoveryPenalty: 0 }),
    message: (_m, input) => {
      const lost = input.parseReport.missingFields;
      return lost.length > 0
        ? `A basic ATS parser lost your ${list(lost)}. What you can see on the page is not what it reads.`
        : "A basic ATS parser recovered noticeably less from this file than a layout-aware one did.";
    },
    howToFix: (_m, input) => {
      const lost = input.parseReport.missingFields;
      return lost.length > 0
        ? `Move your ${list(lost)} into the normal body of the document, as plain text in a single column, and re-export the PDF.`
        : "Rebuild the resume as a single-column document with plain text headings, then re-export it as a PDF.";
    },
    evidence: noEvidence,
  },
  {
    id: "parse.multi-column",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.multiColumn,
    resolve: (m) => ({ ...m, multiColumn: false }),
    message: () =>
      "This resume is laid out in two or more columns. Parsers read straight across, so your columns get shuffled into each other.",
    howToFix: () =>
      "Rebuild it as one single column, top to bottom. If you want a sidebar look, keep the content in one column and use spacing rather than a second text frame.",
    evidence: noEvidence,
  },
  {
    id: "parse.contact-header-footer",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.contactInHeaderFooter,
    resolve: (m) => ({ ...m, contactInHeaderFooter: false }),
    message: () =>
      "Your contact details sit in the page header or footer. Many parsers skip those regions entirely, so your email can vanish.",
    howToFix: () =>
      "Move your name, email and phone into the first lines of the page body, not the header/footer area.",
    evidence: (input) => findLine(input, /[\w.+-]+@[\w-]+\.[\w.]{2,}/),
  },
  {
    id: "parse.tables",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.textInTables,
    resolve: (m) => ({ ...m, textInTables: false }),
    message: () =>
      "Content appears to be inside a table. Table cells are frequently flattened into a single run-on line or dropped.",
    howToFix: () =>
      "Replace tables with plain paragraphs and bullet lists. Use tabs or spacing for alignment instead of cells.",
    evidence: noEvidence,
  },
  {
    id: "parse.shapes",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.textInShapes,
    resolve: (m) => ({ ...m, textInShapes: false }),
    message: () =>
      "Some text is inside a shape or text box. Text boxes are not part of the main content stream and are often skipped.",
    howToFix: () =>
      "Delete the shapes and text boxes and put their content directly into the document body.",
    evidence: noEvidence,
  },
  {
    id: "parse.graphic-skills",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.skillsOnlyInGraphics,
    resolve: (m) => ({ ...m, skillsOnlyInGraphics: false }),
    message: () =>
      "Your skills appear to be drawn as rating bars or graphics rather than written out. A keyword search finds nothing in a picture.",
    howToFix: () =>
      "Write the skills out as plain comma-separated text under a 'Skills' heading. Drop the five-star and progress-bar graphics — they tell a recruiter nothing anyway.",
    evidence: noEvidence,
  },
  {
    id: "parse.nonstandard-headings",
    component: "parseability",
    autoFixable: true,
    detect: (m) => m.nonStandardHeadings > 0,
    resolve: (m) => ({ ...m, nonStandardHeadings: 0 }),
    message: (m) =>
      `${m.nonStandardHeadings} heading${m.nonStandardHeadings === 1 ? "" : "s"} do not use standard names, so a parser cannot tell which section it is reading.`,
    howToFix: () =>
      "Rename them to the names parsers look for: Experience, Education, Skills, Projects, Summary. Save the creative titles for the cover letter.",
    evidence: noEvidence,
  },
  {
    id: "parse.non-embedded-fonts",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.nonEmbeddedFonts,
    resolve: (m) => ({ ...m, nonEmbeddedFonts: false }),
    message: () =>
      "At least one font is not embedded in the PDF. The reader substitutes another, which is where letters run together.",
    howToFix: () =>
      "Re-export with 'embed fonts' enabled, or switch to a standard face like Arial, Calibri or Times New Roman.",
    evidence: noEvidence,
  },
  {
    id: "parse.wrong-file-type",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.wrongFileType,
    resolve: (m) => ({ ...m, wrongFileType: false }),
    message: (_m, input) =>
      `This is a ${input.parseReport.fileType || "unrecognised"} file. Most application forms expect a PDF and will mangle anything else.`,
    howToFix: () => "Export the document as a PDF and upload that instead.",
    evidence: noEvidence,
  },
  {
    id: "parse.text-integrity",
    component: "parseability",
    autoFixable: false,
    detect: (m) => m.textIntegrity < 0.9,
    resolve: (m) => ({ ...m, textIntegrity: 1 }),
    message: () =>
      "The extracted text is damaged — words are running together or characters are coming out garbled.",
    howToFix: () =>
      "Re-export the PDF from the original document rather than printing or scanning it, and embed the fonts.",
    evidence: (input) => findLine(input, /[a-z]{2}[A-Z][a-z]{2}|�/),
  },
];

/* -------------------------------------------------------------------------
 * Structure
 * ---------------------------------------------------------------------- */

const CONTACT_COPY: Record<string, { label: string; how: string }> = {
  email: {
    label: "email address",
    how: "Add a professional email address to the top of the first page.",
  },
  phone: {
    label: "phone number",
    how: "Add a phone number with its international dialling code, e.g. +31 6 12345678.",
  },
  city: {
    label: "location",
    how: "Add your city and country, e.g. 'Eindhoven, Netherlands'. Recruiters filter on location constantly.",
  },
  linkedin: {
    label: "LinkedIn URL",
    how: "Add your full LinkedIn URL as text, e.g. linkedin.com/in/yourname.",
  },
};

const contactIssues: IssueDefinition[] = (
  ["email", "phone", "city", "linkedin"] as const
).map((field) => ({
  id: `structure.missing-${field}`,
  component: "structure" as const,
  autoFixable: false,
  detect: (m: Metrics) => m.missingContact[field],
  resolve: (m: Metrics) => ({ ...m, missingContact: { ...m.missingContact, [field]: false } }),
  message: () => `No ${CONTACT_COPY[field]?.label ?? field} was found on this resume.`,
  howToFix: () => CONTACT_COPY[field]?.how ?? "Add it to the top of the first page.",
  evidence: noEvidence,
}));

const SECTION_COPY: Record<string, string> = {
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};

const sectionIssues: IssueDefinition[] = (["experience", "education", "skills"] as const).map(
  (section) => ({
    id: `structure.missing-${section}`,
    component: "structure" as const,
    autoFixable: true,
    detect: (m: Metrics) => m.missingSections[section],
    resolve: (m: Metrics) => ({
      ...m,
      missingSections: { ...m.missingSections, [section]: false },
    }),
    message: () =>
      `No ${SECTION_COPY[section]} section could be identified. Parsers route content by heading, so this content is going nowhere.`,
    howToFix: () =>
      `Add a heading that reads exactly "${SECTION_COPY[section]}" above that content.`,
    evidence: noEvidence,
  }),
);

const structureIssues: IssueDefinition[] = [
  ...contactIssues,
  ...sectionIssues,
  {
    id: "structure.role-identity",
    component: "structure",
    autoFixable: false,
    detect: (m) => m.rolesMissingIdentity > 0,
    resolve: (m) => ({ ...m, rolesMissingIdentity: 0 }),
    message: (m) =>
      `${m.rolesMissingIdentity} role${m.rolesMissingIdentity === 1 ? " is" : "s are"} missing a clear job title or employer name.`,
    howToFix: () =>
      "Give every role its own line in the form 'Job Title — Employer', with the dates on the same line or the one below.",
    evidence: (input) => roleEvidence(input, (r) => r.title === null || r.company === null),
  },
  {
    id: "structure.role-dates",
    component: "structure",
    autoFixable: false,
    detect: (m) => m.rolesUnparseableDates > 0,
    resolve: (m) => ({ ...m, rolesUnparseableDates: 0 }),
    message: (m) =>
      `${m.rolesUnparseableDates} role${m.rolesUnparseableDates === 1 ? " has" : "s have"} dates a parser cannot read, so the length of that experience is lost.`,
    howToFix: () =>
      "Write every date range as 'Mon YYYY – Mon YYYY', e.g. 'Jan 2023 – Aug 2024'. Use 'Present' for a current role.",
    evidence: (input) => roleEvidence(input, (r) => !r.datesParseable),
  },
  {
    id: "structure.reverse-chronological",
    component: "structure",
    autoFixable: true,
    detect: (m) => m.notReverseChronological,
    resolve: (m) => ({ ...m, notReverseChronological: false }),
    message: () =>
      "Your roles are not in reverse-chronological order. Recruiters read the first entry and assume it is your most recent.",
    howToFix: () => "Reorder Experience so the newest role is first and the oldest last.",
    evidence: noEvidence,
  },
  {
    id: "structure.employment-gaps",
    component: "structure",
    autoFixable: false,
    detect: (m) => m.employmentGaps > 0,
    resolve: (m) => ({ ...m, employmentGaps: 0 }),
    message: (m) =>
      `${m.employmentGaps} gap${m.employmentGaps === 1 ? "" : "s"} of more than six months between roles.`,
    howToFix: () =>
      "If the gap was study, travel, caring or a project, add a one-line entry saying so. A named gap stops being a question.",
    evidence: noEvidence,
  },
];

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */

const contentIssues: IssueDefinition[] = [
  {
    id: "content.no-bullets",
    component: "content",
    autoFixable: false,
    detect: (m) => m.bulletsTotal === 0,
    // Resolving means the resume HAS bullets, at the same quality as an
    // average decent resume — otherwise the counterfactual would credit a
    // perfect rewrite rather than the act of adding bullets at all.
    resolve: (m) => ({
      ...m,
      bulletsTotal: 8,
      quantification: 0.5,
      actionVerbs: 0.5,
      concision: 1,
      cliches: 1,
    }),
    message: () =>
      "No bullet points were found. Solid paragraphs do not get read — a recruiter spends seconds per resume.",
    howToFix: () =>
      "Break each role into 3-5 bullets. Start each with what you did and end with what changed as a result.",
    evidence: noEvidence,
  },
  {
    id: "content.quantification",
    component: "content",
    autoFixable: false,
    detect: (m) => m.bulletsTotal > 0 && m.quantification < 1,
    resolve: (m) => ({ ...m, quantification: 1 }),
    message: (m, input) =>
      `Only ${input.contentStats.bulletsWithMetric} of your ${m.bulletsTotal} bullets contain a number. Unquantified claims read as opinion.`,
    howToFix: () =>
      "Add a figure to about half your bullets — how many, how much faster, how much cheaper, over what period. 'Cut build time from 12 to 4 minutes' beats 'improved build performance'.",
    evidence: noEvidence,
  },
  {
    id: "content.action-verbs",
    component: "content",
    autoFixable: false,
    detect: (m) => m.bulletsTotal > 0 && m.actionVerbs < 1,
    resolve: (m) => ({ ...m, actionVerbs: 1 }),
    message: (m, input) =>
      `${m.bulletsTotal - input.contentStats.bulletsWithStrongVerb} bullets do not start with a strong action verb, and ${input.contentStats.bulletsPassiveOrDuty} read as a duty rather than an achievement.`,
    howToFix: () =>
      "Open each bullet with a verb: built, shipped, measured, reduced, designed. Cut 'responsible for' and 'tasked with' entirely.",
    evidence: noEvidence,
  },
  {
    id: "content.concision",
    component: "content",
    autoFixable: false,
    detect: (m) => m.bulletsTotal > 0 && m.concision < 1,
    resolve: (m) => ({ ...m, concision: 1 }),
    message: (_m, input) =>
      `${input.contentStats.bulletsOverTwoLines} bullets run past two lines. Long bullets get skimmed and the point is lost.`,
    howToFix: () =>
      "Cut every bullet to two lines or fewer. If one contains two achievements, split it into two bullets.",
    evidence: noEvidence,
  },
  {
    id: "content.cliches",
    component: "content",
    autoFixable: false,
    detect: (m) => m.bulletsTotal > 0 && m.cliches < 1,
    resolve: (m) => ({ ...m, cliches: 1 }),
    message: (_m, input) =>
      `${input.contentStats.clichePhraseCount} cliché phrases such as 'team player' or 'results-driven'. They occupy space and prove nothing.`,
    howToFix: () =>
      "Delete them. Replace each with the specific thing you did that would make someone conclude it themselves.",
    evidence: (input) =>
      findLine(input, /team player|results[- ]driven|go[- ]getter|think outside the box|hard[- ]working|detail[- ]oriented|self[- ]starter|synergy/i),
  },
];

/* -------------------------------------------------------------------------
 * Skill surface
 * ---------------------------------------------------------------------- */

const skillIssues: IssueDefinition[] = [
  {
    id: "skills.count",
    component: "skillSurface",
    autoFixable: false,
    detect: (m) => m.skillCountScore < 1,
    resolve: (m) => ({ ...m, skillCountScore: 1 }),
    message: (m) =>
      m.resolvedSkillCount < 12
        ? `Only ${m.resolvedSkillCount} recognisable skills were found. Keyword searches have very little to match on.`
        : `${m.resolvedSkillCount} skills is enough to read as a keyword dump rather than a focused profile.`,
    howToFix: (m) =>
      m.resolvedSkillCount < 12
        ? "Aim for 12-20 named tools, languages and methods. Name the specific thing — 'PostgreSQL', not 'databases'."
        : "Trim to the 12-20 you would actually be happy to be interviewed on. Cut anything you last touched years ago.",
    evidence: noEvidence,
  },
  {
    id: "skills.not-evidenced",
    component: "skillSurface",
    autoFixable: false,
    detect: (m) => m.evidenced < 1,
    resolve: (m) => ({ ...m, evidenced: 1 }),
    message: (m) =>
      `Only ${Math.round(m.evidenced * 100)}% of your listed skills appear in an actual bullet. A skills list on its own is a claim with no evidence.`,
    howToFix: () =>
      "For each important skill, make sure at least one bullet shows you using it to do something. Drop any skill you cannot back up.",
    evidence: noEvidence,
  },
  {
    id: "skills.acronyms",
    component: "skillSurface",
    autoFixable: true,
    detect: (m) => m.acronymCoverage < 1,
    resolve: (m) => ({ ...m, acronymCoverage: 1 }),
    message: () =>
      "Some skills appear only as an acronym or only spelled out. A recruiter searching the other form will not find you.",
    howToFix: () =>
      "Write both, once: 'Computational Fluid Dynamics (CFD)'. After that first mention the acronym alone is fine.",
    evidence: noEvidence,
  },
  {
    id: "skills.hard-soft-ratio",
    component: "skillSurface",
    autoFixable: false,
    detect: (m) => m.hardSoftRatio < 1,
    resolve: (m) => ({ ...m, hardSoftRatio: 1 }),
    message: () =>
      "Your skills list leans heavily on soft skills. Automated filters match on tools and technologies, not on 'communication'.",
    howToFix: () =>
      "Make at least seven in ten listed skills concrete and technical. Soft skills belong in your bullets, demonstrated rather than asserted.",
    evidence: noEvidence,
  },
];

/* -------------------------------------------------------------------------
 * Hygiene
 * ---------------------------------------------------------------------- */

const hygieneIssues: IssueDefinition[] = [
  {
    id: "hygiene.length",
    component: "hygiene",
    autoFixable: false,
    detect: (m) => m.lengthWrong,
    resolve: (m) => ({ ...m, lengthWrong: false }),
    message: (_m, input) =>
      `This resume is ${input.parseReport.document.pageCount} pages, which is longer than your experience warrants.`,
    howToFix: (_m, input) =>
      input.profile.totalMonthsExperience / 12 < 3
        ? "Cut it to one page. Under three years of experience, a second page reads as padding."
        : "Cut it to two pages at most. Drop the oldest roles down to a single line each.",
    evidence: noEvidence,
  },
  {
    id: "hygiene.photo",
    component: "hygiene",
    autoFixable: false,
    detect: (m) => m.photoPenalised,
    resolve: (m) => ({ ...m, photoPenalised: false }),
    message: (_m, input) =>
      `This resume includes a photo, which is not the convention in ${input.locale} and can get an application set aside on anti-bias grounds.`,
    howToFix: () =>
      "Remove the photo for applications in this market. Keep a version with the photo for markets where it is expected.",
    evidence: noEvidence,
  },
  {
    id: "hygiene.pronouns",
    component: "hygiene",
    autoFixable: true,
    detect: (m) => m.pronouns,
    resolve: (m) => ({ ...m, pronouns: false }),
    message: (_m, input) =>
      `${input.contentStats.firstPersonPronounCount} first-person pronouns. Resume convention drops them and the bullets get shorter for free.`,
    howToFix: () =>
      "Delete 'I', 'my' and 'we'. 'I built the pipeline' becomes 'Built the pipeline'.",
    evidence: (input) => findLine(input, /\b(I|my|we|our)\b/),
  },
  {
    id: "hygiene.tense",
    component: "hygiene",
    autoFixable: true,
    detect: (m) => m.tenseInconsistent,
    resolve: (m) => ({ ...m, tenseInconsistent: false }),
    message: (_m, input) =>
      `${input.contentStats.tenseInconsistencies} tense inconsistencies — past and present mixed within the same role.`,
    howToFix: () =>
      "Use present tense for your current role and past tense for everything else, consistently within each role.",
    evidence: noEvidence,
  },
  {
    id: "hygiene.spelling",
    component: "hygiene",
    autoFixable: true,
    detect: (m) => m.spellingErrors > 0,
    resolve: (m) => ({ ...m, spellingErrors: 0 }),
    message: (m) =>
      `${m.spellingErrors} likely spelling error${m.spellingErrors === 1 ? "" : "s"}. This is the cheapest possible thing to lose an application over.`,
    howToFix: () =>
      "Run a spell check, then read it aloud once. Pay particular attention to product and company names, which spell checkers skip.",
    evidence: noEvidence,
  },
  {
    id: "hygiene.date-format",
    component: "hygiene",
    autoFixable: true,
    detect: (m) => m.inconsistentDates,
    resolve: (m) => ({ ...m, inconsistentDates: false }),
    message: (_m, input) =>
      `Dates are written in ${input.parseReport.document.dateFormatsSeen.length} different formats (${input.parseReport.document.dateFormatsSeen.join(", ")}).`,
    howToFix: () => "Pick one format — 'Mon YYYY' is the safest — and use it everywhere.",
    evidence: noEvidence,
  },
];

/** Every issue the engine can report, in a stable order. */
export const ISSUES: readonly IssueDefinition[] = [
  ...parseabilityIssues,
  ...structureIssues,
  ...contentIssues,
  ...skillIssues,
  ...hygieneIssues,
];

/** Guard against a duplicated id silently shadowing a fix. */
(function assertUniqueIds(): void {
  const seen = new Set<string>();
  for (const issue of ISSUES) {
    if (seen.has(issue.id)) throw new Error(`duplicate issue id: ${issue.id}`);
    seen.add(issue.id);
  }
})();
