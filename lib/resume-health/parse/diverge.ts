// Where the two parses disagree.
//
// The naive parse is what a dumb ATS sees; the rich parse is what the document
// actually says. Every field the rich parse recovered and the naive parse lost
// is a field a real applicant tracking system would probably lose too — and
// naming those specific fields produces the single most useful message this
// engine can show a user.

import { SECTION_NAMES } from "./naive";
import { detectFontEmbedding, detectHeaderFooter, detectMultiColumn, detectShapes, detectTables, measureTextIntegrity } from "./layout";
import type { FontDescriptor, PageGeometry } from "./layout";
import type { NaiveParse } from "./naive";
import type { RichParse } from "./rich";
import type { DocumentFacts, ParseReport } from "../types";

/** Human-readable names for the fields the comparison tracks. These strings
 *  are shown to the user, so they are written for a person, not a developer. */
export const FIELD_LABELS = {
  email: "email address",
  phone: "phone number",
  city: "location",
  linkedin: "LinkedIn URL",
  experience: "Experience section",
  education: "Education section",
  skills: "Skills section",
  projects: "Projects section",
  summary: "Summary section",
  roles: "job history",
  skillList: "skills list",
} as const;

/** A skills section that resolves to nothing textual, while the rich parse
 *  found skills, is the signature of skills drawn as rating bars. */
export const GRAPHIC_SKILLS_MIN_RICH = 3;

export interface CompareInput {
  naive: NaiveParse;
  rich: RichParse;
  pages: readonly PageGeometry[];
  fonts: readonly FontDescriptor[];
  hasTextLayer: boolean;
  photoPresent: boolean;
  fileType: string;
  pageCount: number;
}

/**
 * Compare the two parses into the report the scorer consumes.
 * Pure: every I/O-bound fact is supplied by the caller.
 */
export function compareParses(input: CompareInput): ParseReport {
  const { naive, rich, pages, fonts, hasTextLayer, photoPresent, fileType, pageCount } = input;

  const missingFields: string[] = [];
  let recovered = 0;
  let applicable = 0;

  /** Count one comparable field: was it present in rich, and did naive keep it? */
  const compare = (richHas: boolean, naiveHas: boolean, label: string): void => {
    if (!richHas) return;
    applicable++;
    if (naiveHas) recovered++;
    else missingFields.push(label);
  };

  compare(rich.contact.email, naive.contact.email, FIELD_LABELS.email);
  compare(rich.contact.phone, naive.contact.phone, FIELD_LABELS.phone);
  compare(rich.contact.city, naive.contact.city, FIELD_LABELS.city);
  compare(rich.contact.linkedin, naive.contact.linkedin, FIELD_LABELS.linkedin);

  for (const name of SECTION_NAMES) {
    compare(rich.sections[name], naive.sections[name], FIELD_LABELS[name]);
  }

  // Job history: the naive parse keeping fewer than half the roles the rich
  // parse found is a real loss, not rounding.
  if (rich.roles.length > 0) {
    applicable++;
    if (naive.roles.length >= Math.ceil(rich.roles.length / 2)) recovered++;
    else missingFields.push(FIELD_LABELS.roles);
  }

  // Skills: same idea, on the raw strings the naive parse could scrape.
  if (rich.skills.length > 0) {
    applicable++;
    if (naive.skills.length >= Math.ceil(rich.skills.length / 2)) recovered++;
    else missingFields.push(FIELD_LABELS.skillList);
  }

  const fieldRecovery = applicable === 0 ? 1 : recovered / applicable;

  const document: DocumentFacts = {
    pageCount,
    photoPresent,
    contact: naive.contact,
    sections: {
      experience: naive.sections.experience,
      education: naive.sections.education,
      skills: naive.sections.skills,
      projects: naive.sections.projects,
      summary: naive.sections.summary,
    },
    nonStandardHeadingCount: naive.nonStandardHeadingCount,
    roles: naive.roles.length > 0 ? naive.roles : rich.roles,
    dateFormatsSeen: naive.dateFormatsSeen,
    skillsOnlyInGraphics:
      naive.skills.length === 0 && rich.skills.length >= GRAPHIC_SKILLS_MIN_RICH,
  };

  const detectedSections = SECTION_NAMES.filter((name) => naive.sections[name]).length;

  return {
    hasTextLayer,
    fieldRecovery,
    textIntegrity: measureTextIntegrity(naive.text),
    sectionDetection: detectedSections / SECTION_NAMES.length,
    multiColumnDetected: pages.some(detectMultiColumn),
    contactInHeaderFooter: pages.some(detectHeaderFooter),
    textInTables: pages.some(detectTables),
    textInShapes: pages.some(detectShapes),
    nonEmbeddedFonts: detectFontEmbedding(fonts),
    fileType,
    missingFields,
    document,
  };
}

/** The report used when a file cannot be parsed at all. Every gate that can
 *  fire, fires — the caller turns that into score 0 / `unreadable`. */
export function unreadableReport(fileType: string): ParseReport {
  return {
    hasTextLayer: false,
    fieldRecovery: 0,
    textIntegrity: 0,
    sectionDetection: 0,
    multiColumnDetected: false,
    contactInHeaderFooter: false,
    textInTables: false,
    textInShapes: false,
    nonEmbeddedFonts: false,
    fileType,
    missingFields: [],
    document: {
      pageCount: 0,
      photoPresent: false,
      contact: { email: false, phone: false, city: false, linkedin: false },
      sections: {
        experience: false,
        education: false,
        skills: false,
        projects: false,
        summary: false,
      },
      nonStandardHeadingCount: 0,
      roles: [],
      dateFormatsSeen: [],
      skillsOnlyInGraphics: false,
    },
  };
}
