// Orchestration: bytes in, HealthResult out.
//
// This is the only async surface of the engine. It runs the dual parse, asks
// the classifier for counts (cache first), and hands both to the pure
// `computeHealth`. All the judgement lives in that pure function.

import { classifyContent, type ClassifierCache, type AskJson } from "./classify";
import { compareParses, unreadableReport } from "./parse/diverge";
import { naiveParseFromPages } from "./parse/naive";
import { richParseFromPages } from "./parse/rich";
import { computeHealth, contentHashOf } from "./score";
import type { HealthInput, HealthResult, Locale } from "./types";
import type { LegacyProfile } from "../matching/adapt";

/** The one file type jobblast accepts today. Anything else takes the
 *  wrong-file-type deduction and a fix telling the user to export a PDF. */
export const SUPPORTED_FILE_TYPE = "application/pdf";

/** Where a photo is a filtering risk rather than a convention. */
export const DEFAULT_LOCALE: Locale = "NL";

export interface AnalyzeArgs {
  buffer: Buffer;
  /** MIME type as reported by the upload. */
  fileType: string;
  /** The profile Claude extracted at upload time; reused, never re-requested. */
  legacyProfile: LegacyProfile | null | undefined;
  locale?: Locale;
  ask: AskJson;
  cache?: ClassifierCache;
}

export interface AnalyzeDetailed {
  result: HealthResult;
  /** The exact input the score was computed from. Callers persist the derived
   *  profile and counts so a later re-score costs nothing — `computeHealth` is
   *  pure, so it can be re-run without the original PDF. */
  input: HealthInput;
}

/** Parse a resume and score its health. */
export async function analyzeResume(args: AnalyzeArgs): Promise<HealthResult> {
  return (await analyzeResumeDetailed(args)).result;
}

/** As `analyzeResume`, but also returns the input, for persistence. */
export async function analyzeResumeDetailed(args: AnalyzeArgs): Promise<AnalyzeDetailed> {
  const { buffer, fileType, legacyProfile, ask, cache } = args;
  const locale = args.locale ?? DEFAULT_LOCALE;

  if (fileType !== SUPPORTED_FILE_TYPE) {
    // Not a PDF: nothing to parse, but this is a deduction plus a fix, not a
    // crash. The corrupt gate fires because there are no pages.
    const fallback: HealthInput = {
      parseReport: unreadableReport(fileType),
      profile: emptyProfile(legacyProfile),
      contentStats: emptyStats(),
      rawText: "",
      locale,
    };
    return { result: computeHealth(fallback), input: fallback };
  }

  let input: HealthInput;
  try {
    const { loadPdfGeometry, detectPhoto } = await import("./pdf-entry");
    const geometry = await loadPdfGeometry(buffer);

    const naive = naiveParseFromPages(geometry.pages);
    const rich = richParseFromPages(geometry.pages, legacyProfile);

    const parseReport = compareParses({
      naive,
      rich,
      pages: geometry.pages,
      fonts: geometry.fonts,
      hasTextLayer: geometry.hasTextLayer,
      photoPresent: detectPhoto(geometry),
      fileType,
      pageCount: geometry.pageCount,
    });

    // The rich text is the true reading order, so it is what gets hashed and
    // what the classifier counts. Hashing the naive text would make the cache
    // key depend on a layout quirk.
    const rawText = rich.text;
    const contentHash = contentHashOf(rawText);

    const contentStats = geometry.hasTextLayer
      ? await classifyContent({ rawText, contentHash, ask, cache })
      : emptyStats();

    input = { parseReport, profile: rich.profile, contentStats, rawText, locale };
  } catch {
    // A PDF that will not open at all. The corrupt gate turns this into
    // score 0 / unreadable with a reason the user can act on.
    const fallback: HealthInput = {
      parseReport: unreadableReport(fileType),
      profile: emptyProfile(legacyProfile),
      contentStats: emptyStats(),
      rawText: "",
      locale,
    };
    return { result: computeHealth(fallback), input: fallback };
  }

  return { result: computeHealth(input), input };
}

function emptyStats(): HealthInput["contentStats"] {
  return {
    bulletsTotal: 0,
    bulletsWithMetric: 0,
    bulletsWithStrongVerb: 0,
    bulletsPassiveOrDuty: 0,
    bulletsOverTwoLines: 0,
    clichePhraseCount: 0,
    firstPersonPronounCount: 0,
    tenseInconsistencies: 0,
    spellingErrors: 0,
    skillsEvidencedInBullets: [],
  };
}

function emptyProfile(legacy: LegacyProfile | null | undefined): HealthInput["profile"] {
  // Deliberately synchronous and dependency-light: this path runs when the
  // document could not be read, so there is nothing to derive from.
  return {
    skills: [],
    titles: [],
    totalMonthsExperience: Math.max(0, Math.round((legacy?.years_of_experience ?? 0) * 12)),
    education: { degreeLevel: 0, fieldId: null, graduationDate: null },
    location: { city: null, country: null, willingRemote: true, willingRelocate: true },
    workAuth: [],
    languages: [],
    credentials: [],
    summaryEmbedding: null,
  };
}
