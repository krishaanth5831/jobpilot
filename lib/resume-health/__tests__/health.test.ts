import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  COMPONENT_ORDER,
  WEIGHTS,
  WEIGHT_SUM_TOLERANCE,
  HEALTH_VERSION,
  computeHealth,
  contentHashOf,
  deriveMetrics,
  scoreFromMetrics,
} from "../score";
import {
  BAND_THRESHOLDS,
  SEVERITY_CRITICAL_POINTS,
  SEVERITY_MAJOR_POINTS,
  calibrate,
} from "../calibrate";
import { ISSUES } from "../fixes";
import { analyzeResume } from "../analyze";
import { unreadableReport } from "../parse/diverge";
import { normaliseStats, classifyContent, EMPTY_STATS } from "../classify";
import {
  detectHeaderFooter,
  detectMultiColumn,
  detectTables,
  measureTextIntegrity,
} from "../parse/layout";
import type { PageGeometry, TextRun } from "../parse/layout";
import type { ContentStats, HealthInput, HealthResult, Locale, ParseReport } from "../types";
import type { UserProfile } from "../../matching/types";
import {
  ALL_HEALTH_FIXTURES,
  fixtureBuffer,
  stubAsk,
  canvaFixture,
  cleanFixture,
} from "./fixtures";

/* ---------------------------------------------------------------------- */
/* Builders                                                                */
/* ---------------------------------------------------------------------- */

function makeProfile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    skills: [],
    titles: [],
    totalMonthsExperience: 0,
    education: { degreeLevel: 0, fieldId: null, graduationDate: null },
    location: { city: null, country: null, willingRemote: true, willingRelocate: true },
    workAuth: [],
    languages: [],
    credentials: [],
    summaryEmbedding: null,
    ...over,
  };
}

function makeReport(over: Partial<ParseReport> = {}): ParseReport {
  const base = unreadableReport("application/pdf");
  return {
    ...base,
    hasTextLayer: true,
    fieldRecovery: 1,
    textIntegrity: 1,
    sectionDetection: 1,
    ...over,
    document: {
      ...base.document,
      pageCount: 1,
      contact: { email: true, phone: true, city: true, linkedin: true },
      sections: {
        experience: true,
        education: true,
        skills: true,
        projects: true,
        summary: true,
      },
      ...(over.document ?? {}),
    },
  };
}

function makeStats(over: Partial<ContentStats> = {}): ContentStats {
  return { ...EMPTY_STATS, bulletsTotal: 8, bulletsWithMetric: 4, bulletsWithStrongVerb: 8, ...over };
}

function makeInput(over: Partial<HealthInput> = {}): HealthInput {
  return {
    parseReport: makeReport(),
    profile: makeProfile(),
    contentStats: makeStats(),
    rawText: "Experience\nBuilt things.\n",
    locale: "NL",
    ...over,
  };
}

/* ---------------------------------------------------------------------- */
/* Fixture results, computed once                                          */
/* ---------------------------------------------------------------------- */

const results = new Map<string, HealthResult>();

before(async () => {
  for (const fixture of ALL_HEALTH_FIXTURES) {
    const result = await analyzeResume({
      buffer: fixtureBuffer(fixture),
      fileType: "application/pdf",
      legacyProfile: fixture.profile,
      locale: fixture.locale,
      ask: stubAsk(fixture.contentStats),
    });
    results.set(fixture.name, result);
  }
});

const resultFor = (name: string): HealthResult => {
  const result = results.get(name);
  assert.ok(result, `fixture ${name} was not analysed`);
  return result;
};

/* ---------------------------------------------------------------------- */

describe("determinism", () => {
  it("produces byte-identical output across 100 runs", () => {
    const input = makeInput();
    const first = JSON.stringify(computeHealth(input));
    for (let i = 0; i < 100; i++) {
      assert.equal(JSON.stringify(computeHealth(input)), first, `drifted on run ${i}`);
    }
  });

  it("is deterministic for every fixture's derived input", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      const result = resultFor(fixture.name);
      const input: HealthInput = {
        parseReport: result.parseReport,
        profile: makeProfile(),
        contentStats: fixture.contentStats,
        rawText: "",
        locale: fixture.locale,
      };
      const a = JSON.stringify(computeHealth(input));
      const b = JSON.stringify(computeHealth(input));
      assert.equal(a, b, fixture.name);
    }
  });

  it("does not mutate its input", () => {
    const input = makeInput();
    const snapshot = JSON.stringify(input);
    computeHealth(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it("hashes content stably", () => {
    assert.equal(contentHashOf("abc"), contentHashOf("abc"));
    assert.notEqual(contentHashOf("abc"), contentHashOf("abd"));
  });
});

/* ---------------------------------------------------------------------- */

describe("hard gates", () => {
  it("the baseline passes every gate and scores above zero", () => {
    const result = computeHealth(makeInput());
    assert.deepEqual(result.gatesFailed, []);
    assert.ok(result.score > 0);
    assert.notEqual(result.band, "unreadable");
  });

  it("no text layer independently forces 0 / unreadable", () => {
    const result = computeHealth(
      makeInput({ parseReport: makeReport({ hasTextLayer: false }) }),
    );
    assert.equal(result.score, 0);
    assert.equal(result.rawScore, 0);
    assert.equal(result.band, "unreadable");
    assert.ok(result.gatesFailed.some((g) => g.gate === "noTextLayer"));
  });

  it("no contact method independently forces 0 / unreadable", () => {
    const report = makeReport();
    const result = computeHealth(
      makeInput({
        parseReport: {
          ...report,
          document: {
            ...report.document,
            contact: { email: false, phone: false, city: true, linkedin: false },
          },
        },
      }),
    );
    assert.equal(result.score, 0);
    assert.equal(result.band, "unreadable");
    assert.ok(result.gatesFailed.some((g) => g.gate === "noContact"));
  });

  it("a corrupt file independently forces 0 / unreadable", () => {
    const report = makeReport();
    const result = computeHealth(
      makeInput({
        parseReport: { ...report, document: { ...report.document, pageCount: 0 } },
      }),
    );
    assert.equal(result.score, 0);
    assert.equal(result.band, "unreadable");
    assert.ok(result.gatesFailed.some((g) => g.gate === "corrupt"));
  });

  it("a city alone is not a contact method, but a LinkedIn URL is", () => {
    const report = makeReport();
    const withLinkedin = computeHealth(
      makeInput({
        parseReport: {
          ...report,
          document: {
            ...report.document,
            contact: { email: false, phone: false, city: false, linkedin: true },
          },
        },
      }),
    );
    assert.ok(!withLinkedin.gatesFailed.some((g) => g.gate === "noContact"));
  });

  it("every gate carries a human-readable reason", () => {
    const result = computeHealth(
      makeInput({ parseReport: makeReport({ hasTextLayer: false }) }),
    );
    for (const gate of result.gatesFailed) {
      assert.ok(gate.reason.length > 20, `${gate.gate} has no usable reason`);
    }
  });

  it("gated results carry no fixes — the gate is the one thing to do", () => {
    const result = computeHealth(
      makeInput({ parseReport: makeReport({ hasTextLayer: false }) }),
    );
    assert.deepEqual(result.fixes, []);
  });
});

/* ---------------------------------------------------------------------- */

describe("invariants", () => {
  it("WEIGHTS sum to 1.0", () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) <= WEIGHT_SUM_TOLERANCE, `weights summed to ${sum}`);
  });

  it("every component is in [0,1] and every score in [0,100]", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      const result = resultFor(fixture.name);
      assert.ok(result.score >= 0 && result.score <= 100, fixture.name);
      assert.ok(result.rawScore >= 0 && result.rawScore <= 100, fixture.name);
      assert.equal(result.components.length, COMPONENT_ORDER.length);
      for (const component of result.components) {
        assert.ok(
          component.score >= 0 && component.score <= 1,
          `${fixture.name}/${component.id} = ${component.score}`,
        );
        assert.equal(component.weight, WEIGHTS[component.id]);
        assert.ok(
          Math.abs(component.contribution - component.score * component.weight * 100) < 1e-6,
        );
        assert.ok(component.explanation.length > 0);
      }
      assert.equal(result.healthVersion, HEALTH_VERSION);
      assert.ok(result.taxonomyVersion.length > 0);
      assert.equal(result.contentHash.length, 64);
    }
  });

  it("calibrate is monotonic across the whole range", () => {
    let previous = -Infinity;
    for (let raw = 0; raw <= 100; raw += 0.5) {
      const value = calibrate(raw);
      assert.ok(value >= previous, `calibrate dipped at raw ${raw}`);
      assert.ok(value >= 0 && value <= 100);
      previous = value;
    }
  });

  it("calibration is harsh — it never flatters a raw score", () => {
    // The whole point of this curve. A raw 80 must not present as an 80.
    for (let raw = 5; raw < 100; raw += 5) {
      assert.ok(calibrate(raw) <= raw, `calibrate(${raw}) = ${calibrate(raw)} exceeds it`);
    }
  });

  it("bands line up with their thresholds", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      const result = resultFor(fixture.name);
      if (result.band === "unreadable") continue;
      const threshold = BAND_THRESHOLDS.find((b) => b.band === result.band);
      assert.ok(threshold, `${fixture.name} has band ${result.band}`);
      assert.ok(result.score >= threshold.min, fixture.name);
    }
  });

  it("holds for a degenerate but readable input", () => {
    const result = computeHealth(makeInput({ contentStats: EMPTY_STATS }));
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.equal(result.components.find((c) => c.id === "content")?.score, 0);
  });
});

/* ---------------------------------------------------------------------- */

describe("fixes", () => {
  it("pointsRecoverable matches the recomputed delta for EVERY fix", () => {
    const inputs: HealthInput[] = [
      makeInput(),
      makeInput({ contentStats: makeStats({ bulletsTotal: 0 }) }),
      makeInput({
        parseReport: makeReport({ multiColumnDetected: true, textInTables: true, fieldRecovery: 0.4 }),
        contentStats: makeStats({ clichePhraseCount: 4, spellingErrors: 3, bulletsOverTwoLines: 5 }),
      }),
      ...ALL_HEALTH_FIXTURES.map((f) => {
        const result = resultFor(f.name);
        return {
          parseReport: result.parseReport,
          profile: makeProfile(),
          contentStats: f.contentStats,
          rawText: "",
          locale: f.locale,
        };
      }),
    ];

    for (const input of inputs) {
      const result = computeHealth(input);
      if (result.band === "unreadable") continue;

      const metrics = deriveMetrics(input);
      for (const fix of result.fixes) {
        const issue = ISSUES.find((i) => i.id === fix.id);
        assert.ok(issue, `unknown issue id ${fix.id}`);
        const resolved = scoreFromMetrics(issue.resolve(metrics));
        const delta = Math.round(resolved.calibrated) - result.score;
        assert.equal(
          fix.pointsRecoverable,
          delta,
          `${fix.id} claimed ${fix.pointsRecoverable} but recomputing gave ${delta}`,
        );
      }
    }
  });

  it("holds against an independent input-level recomputation", () => {
    // For issues that map onto a single input field, patch the INPUT rather
    // than the metrics and confirm the score moves by exactly the claimed
    // amount. This catches a resolve() that patches the wrong term.
    const input = makeInput({
      parseReport: makeReport({
        multiColumnDetected: true,
        contactInHeaderFooter: true,
        textInTables: true,
        nonEmbeddedFonts: true,
      }),
    });
    const base = computeHealth(input);

    const patches: [string, () => HealthInput][] = [
      ["parse.multi-column", () => makeInput({ parseReport: { ...input.parseReport, multiColumnDetected: false } })],
      ["parse.contact-header-footer", () => makeInput({ parseReport: { ...input.parseReport, contactInHeaderFooter: false } })],
      ["parse.tables", () => makeInput({ parseReport: { ...input.parseReport, textInTables: false } })],
      ["parse.non-embedded-fonts", () => makeInput({ parseReport: { ...input.parseReport, nonEmbeddedFonts: false } })],
    ];

    for (const [id, patch] of patches) {
      const fix = base.fixes.find((f) => f.id === id);
      assert.ok(fix, `expected a ${id} fix`);
      const patched = computeHealth(patch());
      assert.equal(
        fix.pointsRecoverable,
        patched.score - base.score,
        `${id}: claimed ${fix.pointsRecoverable}, input-level recomputation gave ${patched.score - base.score}`,
      );
    }
  });

  it("are sorted descending by pointsRecoverable", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      const { fixes } = resultFor(fixture.name);
      for (let i = 1; i < fixes.length; i++) {
        assert.ok(
          (fixes[i - 1]?.pointsRecoverable ?? 0) >= (fixes[i]?.pointsRecoverable ?? 0),
          `${fixture.name} fixes are not sorted`,
        );
      }
    }
  });

  it("assigns severity by the documented thresholds", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      for (const fix of resultFor(fixture.name).fixes) {
        const expected =
          fix.pointsRecoverable >= SEVERITY_CRITICAL_POINTS
            ? "critical"
            : fix.pointsRecoverable >= SEVERITY_MAJOR_POINTS
              ? "major"
              : "minor";
        assert.equal(fix.severity, expected, `${fix.id} at ${fix.pointsRecoverable} points`);
      }
    }
  });

  it("never reports a zero-point fix, and always explains itself", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      for (const fix of resultFor(fixture.name).fixes) {
        assert.ok(fix.pointsRecoverable > 0, `${fix.id} is worth nothing`);
        assert.ok(fix.message.length > 20, `${fix.id} has no message`);
        assert.ok(fix.howToFix.length > 20, `${fix.id} has no instruction`);
        assert.ok(COMPONENT_ORDER.includes(fix.component));
      }
    }
  });

  it("attaches evidence where the parser can locate it", () => {
    const result = resultFor("canva-two-column");
    const located = result.fixes.filter((f) => f.evidence !== null);
    for (const fix of located) {
      assert.ok(fix.evidence);
      assert.ok(fix.evidence.page >= 1);
      assert.ok(fix.evidence.snippet.length > 0);
    }
  });

  it("every registered issue has a unique id and can resolve itself", () => {
    const seen = new Set<string>();
    const metrics = deriveMetrics(makeInput());
    for (const issue of ISSUES) {
      assert.ok(!seen.has(issue.id), `duplicate id ${issue.id}`);
      seen.add(issue.id);
      const resolved = issue.resolve(metrics);
      assert.equal(issue.detect(resolved), false, `${issue.id} still detects after resolve`);
    }
  });
});

/* ---------------------------------------------------------------------- */

describe("locale", () => {
  const withPhoto = (locale: Locale): HealthResult => {
    const report = makeReport();
    return computeHealth(
      makeInput({
        locale,
        parseReport: {
          ...report,
          document: { ...report.document, photoPresent: true },
        },
      }),
    );
  };

  it("penalises a photo in the US but not in the Netherlands", () => {
    const us = withPhoto("US");
    const nl = withPhoto("NL");
    assert.ok(us.score < nl.score, `US ${us.score} should be below NL ${nl.score}`);
    assert.ok(us.fixes.some((f) => f.id === "hygiene.photo"));
    assert.ok(!nl.fixes.some((f) => f.id === "hygiene.photo"));
  });

  it("penalises the photo in exactly the four anglophone markets", () => {
    const penalised: Locale[] = ["US", "UK", "CA", "AU"];
    const not: Locale[] = ["NL", "DE", "FR", "BE", "ES", "IT", "PT", "PL", "SE", "OTHER"];
    for (const locale of penalised) {
      assert.ok(withPhoto(locale).fixes.some((f) => f.id === "hygiene.photo"), locale);
    }
    for (const locale of not) {
      assert.ok(!withPhoto(locale).fixes.some((f) => f.id === "hygiene.photo"), locale);
    }
  });

  it("changes nothing when there is no photo", () => {
    const us = computeHealth(makeInput({ locale: "US" }));
    const nl = computeHealth(makeInput({ locale: "NL" }));
    assert.equal(us.score, nl.score);
  });
});

/* ---------------------------------------------------------------------- */

describe("layout detection", () => {
  const run = (text: string, x: number, y: number): TextRun => ({
    text,
    x,
    y,
    width: text.length * 5,
    height: 10,
    fontName: "F1",
  });

  const page = (runs: TextRun[]): PageGeometry => ({
    pageNumber: 1,
    width: 595,
    height: 842,
    runs,
    rects: [],
  });

  it("does not call a single-column page multi-column", () => {
    const runs: TextRun[] = [];
    for (let i = 0; i < 40; i++) runs.push(run(`Line number ${i} of body text`, 50, 780 - i * 18));
    assert.equal(detectMultiColumn(page(runs)), false);
  });

  it("does not mistake indented bullets for a second column", () => {
    const runs: TextRun[] = [];
    for (let i = 0; i < 30; i++) {
      runs.push(run("Heading", 50, 780 - i * 24));
      // Bullets indented by 20pt — a real layout, and a classic false positive.
      runs.push(run("- a bullet under it", 70, 770 - i * 24));
    }
    assert.equal(detectMultiColumn(page(runs)), false);
  });

  it("detects a genuine two-column layout", () => {
    const runs: TextRun[] = [];
    for (let i = 0; i < 25; i++) {
      runs.push(run("sidebar item", 50, 780 - i * 28));
      runs.push(run("main column body text", 300, 780 - i * 28));
    }
    assert.equal(detectMultiColumn(page(runs)), true);
  });

  it("ignores a short second cluster that does not run down the page", () => {
    const runs: TextRun[] = [];
    for (let i = 0; i < 30; i++) runs.push(run("body text line", 50, 780 - i * 24));
    // A date column beside only the first three lines.
    for (let i = 0; i < 3; i++) runs.push(run("2024", 400, 780 - i * 24));
    assert.equal(detectMultiColumn(page(runs)), false);
  });

  it("detects contact details in the header band", () => {
    const top = page([run("someone@example.com", 50, 810), run("Body", 50, 400)]);
    assert.equal(detectHeaderFooter(top), true);

    const bottom = page([run("+31 6 12345678", 50, 20), run("Body", 50, 400)]);
    assert.equal(detectHeaderFooter(bottom), true);
  });

  it("does not flag ordinary body contact details", () => {
    const body = page([run("someone@example.com", 50, 700), run("Body", 50, 400)]);
    assert.equal(detectHeaderFooter(body), false);
  });

  it("does not flag non-contact text in the header band", () => {
    const header = page([run("Page 1 of 2", 50, 815), run("Body", 50, 400)]);
    assert.equal(detectHeaderFooter(header), false);
  });

  it("detects a grid of aligned cells as a table", () => {
    const runs: TextRun[] = [];
    for (let r = 0; r < 5; r++) {
      const y = 700 - r * 30;
      runs.push(run("Role", 50, y), run("Company", 220, y), run("2021", 400, y));
    }
    assert.equal(detectTables(page(runs)), true);
  });

  it("does not call ordinary prose a table", () => {
    const runs: TextRun[] = [];
    for (let i = 0; i < 20; i++) runs.push(run("A sentence of ordinary prose here", 50, 780 - i * 20));
    assert.equal(detectTables(page(runs)), false);
  });

  it("measures text integrity", () => {
    assert.equal(measureTextIntegrity("Clean readable resume text with normal spacing"), 1);
    assert.ok(measureTextIntegrity("") === 0);
    assert.ok(
      measureTextIntegrity("Bui�lt th�e pi�peline") < 0.9,
      "replacement characters must reduce integrity",
    );
  });
});

/* ---------------------------------------------------------------------- */

describe("classifier", () => {
  it("clamps sub-counts to the bullet total", () => {
    const stats = normaliseStats({
      bulletsTotal: 8,
      bulletsWithMetric: 99,
      bulletsWithStrongVerb: -4,
      bulletsPassiveOrDuty: 3,
      bulletsOverTwoLines: 2,
      clichePhraseCount: 1,
      firstPersonPronounCount: 0,
      tenseInconsistencies: 0,
      spellingErrors: 0,
      skillsEvidencedInBullets: [],
    });
    assert.equal(stats.bulletsWithMetric, 8);
    assert.equal(stats.bulletsWithStrongVerb, 0);
  });

  it("resolves skill phrases to canonical ids and drops the unknown", () => {
    const stats = normaliseStats({
      ...EMPTY_STATS,
      bulletsTotal: 1,
      skillsEvidencedInBullets: ["React.js", "PostgreSQL", "synergy", "Solid Works"],
    });
    assert.deepEqual(stats.skillsEvidencedInBullets, ["postgresql", "react", "solidworks"]);
  });

  it("never calls the model twice for identical content", async () => {
    let calls = 0;
    const store = new Map<string, ContentStats>();
    const cache = {
      get: (hash: string) => store.get(hash) ?? null,
      set: (hash: string, stats: ContentStats) => void store.set(hash, stats),
    };
    const ask = async (): Promise<unknown> => {
      calls++;
      return { ...EMPTY_STATS, bulletsTotal: 5 };
    };

    const args = { rawText: "some resume text", contentHash: contentHashOf("some resume text"), ask, cache };
    const first = await classifyContent(args);
    const second = await classifyContent(args);

    assert.equal(calls, 1, "the classifier was called twice for identical content");
    assert.deepEqual(first, second);
    assert.equal(first.bulletsTotal, 5);
  });

  it("returns empty counts for empty text without calling the model", async () => {
    let calls = 0;
    const stats = await classifyContent({
      rawText: "   ",
      contentHash: contentHashOf("   "),
      ask: async () => {
        calls++;
        return EMPTY_STATS;
      },
    });
    assert.equal(calls, 0);
    assert.deepEqual(stats, EMPTY_STATS);
  });
});

/* ---------------------------------------------------------------------- */

describe("dual-parse harness on real PDFs", () => {
  it("reads a text layer from every fixture except the scan", () => {
    for (const fixture of ALL_HEALTH_FIXTURES) {
      const expected = fixture.name !== "scanned-image";
      assert.equal(resultFor(fixture.name).parseReport.hasTextLayer, expected, fixture.name);
    }
  });

  it("finds the two-column layout, header contact and photo in the Canva CV", () => {
    const report = resultFor("canva-two-column").parseReport;
    assert.equal(report.multiColumnDetected, true);
    assert.equal(report.contactInHeaderFooter, true);
    assert.equal(report.document.photoPresent, true);
  });

  it("finds the table layout and mixed date formats in the Word export", () => {
    const report = resultFor("word-with-tables").parseReport;
    assert.equal(report.textInTables, true);
    assert.ok(report.document.dateFormatsSeen.length > 1, "expected mixed date formats");
    assert.equal(report.document.roles.length, 4);
  });

  it("finds no layout traps in the clean single-column resume", () => {
    const report = resultFor("clean-single-column").parseReport;
    assert.equal(report.multiColumnDetected, false);
    assert.equal(report.contactInHeaderFooter, false);
    assert.equal(report.textInTables, false);
    assert.equal(report.fieldRecovery, 1);
    assert.deepEqual(report.missingFields, []);
  });

  it("names the specific fields a dumb parser loses on the Canva CV", () => {
    const report = resultFor("canva-two-column").parseReport;
    assert.ok(report.fieldRecovery < 1, "expected divergence between the two parses");
    assert.ok(report.missingFields.length > 0);
    assert.ok(
      report.missingFields.includes("Experience section"),
      `missing fields were ${JSON.stringify(report.missingFields)}`,
    );
  });

  it("rejects a non-PDF cleanly rather than throwing", async () => {
    const result = await analyzeResume({
      buffer: Buffer.from("Sincerely, a .docx"),
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      legacyProfile: null,
      ask: stubAsk(EMPTY_STATS),
    });
    assert.equal(result.band, "unreadable");
    assert.equal(result.score, 0);
  });

  it("survives a corrupt PDF rather than throwing", async () => {
    const result = await analyzeResume({
      buffer: Buffer.from("%PDF-1.4 this is not really a pdf"),
      fileType: "application/pdf",
      legacyProfile: null,
      ask: stubAsk(EMPTY_STATS),
    });
    assert.equal(result.band, "unreadable");
    assert.equal(result.score, 0);
  });
});

/* ---------------------------------------------------------------------- */

describe("snapshot fixtures", () => {
  // Exact expected values. A diff means the algorithm moved — allowed, but it
  // needs a HEALTH_VERSION bump and a deliberate review of these five numbers.
  const expected: Record<string, { score: number; rawScore: number; band: string }> = {
    "clean-single-column": { score: 89, rawScore: 95, band: "ats-ready" },
    "canva-two-column": { score: 11, rawScore: 22, band: "will-be-filtered" },
    "word-with-tables": { score: 38, rawScore: 53, band: "will-be-filtered" },
    "scanned-image": { score: 0, rawScore: 0, band: "unreadable" },
    "sparse-student": { score: 40, rawScore: 55, band: "will-be-filtered" },
  };

  for (const fixture of ALL_HEALTH_FIXTURES) {
    it(`${fixture.name}: ${fixture.description}`, () => {
      const result = resultFor(fixture.name);
      const want = expected[fixture.name];
      assert.ok(want, `no expectation recorded for ${fixture.name}`);
      assert.equal(result.score, want.score, `${fixture.name} score`);
      assert.equal(result.rawScore, want.rawScore, `${fixture.name} rawScore`);
      assert.equal(result.band, want.band, `${fixture.name} band`);
    });
  }

  it("the clean resume beats every other fixture", () => {
    const clean = resultFor("clean-single-column").score;
    for (const fixture of ALL_HEALTH_FIXTURES) {
      if (fixture.name === "clean-single-column") continue;
      assert.ok(clean > resultFor(fixture.name).score, `clean did not beat ${fixture.name}`);
    }
  });
});

/* ---------------------------------------------------------------------- */

describe("fairness", () => {
  // None of these have a field on any input type — the strongest guarantee
  // available. The test injects them anyway and asserts they are ignored.
  function withExtra(input: HealthInput, extra: Record<string, unknown>): HealthInput {
    return {
      ...input,
      profile: { ...input.profile, ...extra } as HealthInput["profile"],
    };
  }

  const perturbations: Record<string, unknown>[] = [
    { name: "Alex Mercer" },
    { name: "Wei Zhang" },
    { name: "Aisha Okonkwo" },
    { age: 21 },
    { age: 59 },
    { gender: "female" },
    { gender: "male" },
    { gender: "non-binary" },
    { nationality: "Nigerian" },
    { nationality: "German" },
    { ethnicity: "Asian" },
    { university: "Cambridge" },
    { university: "Unranked Polytechnic" },
  ];

  it("ignores injected protected characteristics", () => {
    const input = makeInput();
    const baseline = JSON.stringify(computeHealth(input));
    for (const extra of perturbations) {
      assert.equal(
        JSON.stringify(computeHealth(withExtra(input, extra))),
        baseline,
        `score changed when ${JSON.stringify(extra)} was added`,
      );
    }
  });

  it("ignores graduation year", () => {
    const input = makeInput();
    const baseline = JSON.stringify(computeHealth(input));
    for (const graduationDate of [null, "1972-06-30", "2001-01-15", "2027-07-01"]) {
      const perturbed = computeHealth({
        ...input,
        profile: { ...input.profile, education: { ...input.profile.education, graduationDate } },
      });
      assert.equal(JSON.stringify(perturbed), baseline, `changed for ${String(graduationDate)}`);
    }
  });

  it("reacts to photo PRESENCE only, never to anything about the image", () => {
    // The engine receives a boolean. There is no code path that can see pixels,
    // and this asserts the input surface stays that way.
    const report = makeReport();
    const keys = Object.keys(report.document);
    assert.ok(keys.includes("photoPresent"));
    for (const forbidden of ["photoData", "photoUrl", "faceCount", "photoDescription"]) {
      assert.ok(!keys.includes(forbidden), `DocumentFacts must not carry '${forbidden}'`);
    }
  });

  it("scores two identical documents identically whoever they belong to", () => {
    const a = withExtra(makeInput(), { name: "Jordan Ellis", age: 23, university: "MIT" });
    const b = withExtra(makeInput(), { name: "Priya Raman", age: 46, university: "Open University" });
    assert.deepEqual(computeHealth(a), computeHealth(b));
  });

  it("is job-agnostic: no input field references a job posting", () => {
    const keys = [
      ...Object.keys(makeInput()),
      ...Object.keys(makeReport()),
      ...Object.keys(makeStats()),
    ].map((k) => k.toLowerCase());
    for (const key of keys) {
      assert.ok(!key.includes("job"), `resume health must not take '${key}'`);
      assert.ok(!key.includes("posting"), `resume health must not take '${key}'`);
    }
  });
});

/* ---------------------------------------------------------------------- */

describe("cross-engine boundary", () => {
  it("the clean fixture's canva counterpart shares no score with the match engine", () => {
    // Guards the architectural rule that these are two independent engines:
    // resume health must never import the match score, and vice versa.
    assert.notEqual(resultFor(cleanFixture.name).score, undefined);
    assert.notEqual(resultFor(canvaFixture.name).score, undefined);
    assert.ok(!Object.keys(resultFor(cleanFixture.name)).includes("qualified"));
    assert.ok(!Object.keys(resultFor(cleanFixture.name)).includes("matchScore"));
  });
});
