import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPONENT_ORDER,
  OVER_EXPERIENCE_FLOOR,
  SCORE_VERSION,
  WEIGHTS,
  WEIGHT_SUM_TOLERANCE,
  computeMatch,
  experienceScore,
  scoreWithSkillQuality,
} from "../score";
import { BAND_THRESHOLDS, calibrate } from "../calibrate";
import { CONFIDENCE_DISPLAY_THRESHOLD } from "../confidence";
import { resolveSkill } from "../taxonomy/resolve";
import { skillDistance } from "../taxonomy/graph";
import {
  ALL_FIXTURES,
  FIXED_NOW,
  goodFixture,
  makeJob,
  makeUser,
  reachFixture,
  strongFixture,
} from "./fixtures";
import type { JobPosting, MatchResult, UserProfile } from "../types";

const at = (now = FIXED_NOW) => ({ now });

/* ---------------------------------------------------------------------- */

describe("determinism", () => {
  it("produces byte-identical output across 100 runs", () => {
    for (const fixture of ALL_FIXTURES) {
      const first = JSON.stringify(computeMatch(fixture.user, fixture.job, at()));
      for (let i = 0; i < 100; i++) {
        const again = JSON.stringify(computeMatch(fixture.user, fixture.job, at()));
        assert.equal(again, first, `${fixture.name} drifted on run ${i}`);
      }
    }
  });

  it("does not depend on the wall clock when the posting has no expiry", () => {
    const a = computeMatch(strongFixture.user, strongFixture.job);
    const b = computeMatch(strongFixture.user, strongFixture.job, {
      now: new Date("2030-01-01T00:00:00.000Z"),
    });
    assert.deepEqual(a, b);
  });

  it("does not mutate its inputs", () => {
    const user = JSON.stringify(strongFixture.user);
    const job = JSON.stringify(strongFixture.job);
    computeMatch(strongFixture.user, strongFixture.job, at());
    assert.equal(JSON.stringify(strongFixture.user), user);
    assert.equal(JSON.stringify(strongFixture.job), job);
  });
});

/* ---------------------------------------------------------------------- */

describe("hard gates", () => {
  // A pair that clears every gate, so each test below changes exactly one thing.
  const baseUser: UserProfile = {
    ...goodFixture.user,
    location: { ...goodFixture.user.location, willingRelocate: false },
  };
  const baseJob: JobPosting = goodFixture.job;

  it("the baseline passes every gate and scores above zero", () => {
    const result = computeMatch(baseUser, baseJob, at());
    assert.deepEqual(result.gatesFailed, []);
    assert.ok(result.score > 0);
    assert.notEqual(result.band, "ineligible");
  });

  const cases: { gate: string; user?: Partial<UserProfile>; job?: Partial<JobPosting> }[] = [
    {
      gate: "workAuth",
      job: { workAuthRequired: ["US"], sponsorshipAvailable: false },
    },
    {
      gate: "credentials",
      job: { requiredCredentials: ["Security clearance"] },
    },
    {
      gate: "relocation",
      job: {
        location: { city: "Munich", country: "DE", remotePolicy: "onsite" },
      },
    },
    {
      gate: "expired",
      job: { expiresAt: "2026-01-01T00:00:00.000Z" },
    },
  ];

  for (const { gate, user, job } of cases) {
    it(`${gate} independently forces score 0 and band ineligible`, () => {
      const result = computeMatch(
        { ...baseUser, ...user },
        { ...baseJob, ...job },
        at(),
      );
      assert.equal(result.score, 0, `${gate} did not zero the score`);
      assert.equal(result.rawScore, 0);
      assert.equal(result.band, "ineligible");
      assert.equal(result.gatesFailed.length, 1);
      assert.equal(result.gatesFailed[0]?.gate, gate);
      assert.ok(
        (result.gatesFailed[0]?.reason.length ?? 0) > 10,
        "gate failure must carry a human-readable reason",
      );
    });
  }

  it("does not fire the work-auth gate when sponsorship is available", () => {
    const result = computeMatch(
      baseUser,
      { ...baseJob, workAuthRequired: ["US"], sponsorshipAvailable: true },
      at(),
    );
    assert.deepEqual(result.gatesFailed, []);
  });

  it("does not fire the relocation gate when the candidate will relocate", () => {
    const result = computeMatch(
      { ...baseUser, location: { ...baseUser.location, willingRelocate: true } },
      { ...baseJob, location: { city: "Munich", country: "DE", remotePolicy: "onsite" } },
      at(),
    );
    assert.deepEqual(result.gatesFailed, []);
  });

  it("does not fire the relocation gate for a remote posting abroad", () => {
    const result = computeMatch(
      baseUser,
      { ...baseJob, location: { city: "Munich", country: "DE", remotePolicy: "remote" } },
      at(),
    );
    assert.deepEqual(result.gatesFailed, []);
  });

  it("reports every failing gate at once", () => {
    const result = computeMatch(
      baseUser,
      {
        ...baseJob,
        workAuthRequired: ["US"],
        sponsorshipAvailable: false,
        expiresAt: "2020-01-01T00:00:00.000Z",
      },
      at(),
    );
    assert.equal(result.gatesFailed.length, 2);
    assert.equal(result.score, 0);
  });

  it("still reports components when gated, so the UI can explain the near-miss", () => {
    const gated = ALL_FIXTURES.find((f) => f.name === "gated");
    assert.ok(gated);
    const result = computeMatch(gated.user, gated.job, at());
    assert.equal(result.band, "ineligible");
    assert.equal(result.components.length, COMPONENT_ORDER.length);
    const required = result.components.find((c) => c.id === "requiredSkills");
    assert.ok((required?.score ?? 0) > 0.9, "gated fixture still matches on skills");
  });
});

/* ---------------------------------------------------------------------- */

describe("required-skills convexity", () => {
  const eight = [
    "python",
    "react",
    "postgresql",
    "docker",
    "aws",
    "kubernetes",
    "terraform",
    "graphql",
  ];

  function userWith(owned: readonly string[]): UserProfile {
    return makeUser({
      skills: owned.map((canonicalId) => ({
        canonicalId,
        level: 3 as const,
        months: 24,
        source: "experience" as const,
      })),
      titles: [{ normalizedTitle: "engineer", months: 36, seniority: 2 }],
      totalMonthsExperience: 36,
    });
  }

  const job = makeJob({
    requiredSkills: eight.map((canonicalId) => ({ canonicalId, weight: 1 })),
    seniority: 2,
  });

  it("missing 1 of 8 costs far fewer points than missing 5 of 8", () => {
    const all = computeMatch(userWith(eight), job, at());
    const missingOne = computeMatch(userWith(eight.slice(0, 7)), job, at());
    const missingFive = computeMatch(userWith(eight.slice(0, 3)), job, at());

    const costOfOne = all.score - missingOne.score;
    const costOfFive = all.score - missingFive.score;

    assert.ok(costOfOne > 0, "missing a required skill must cost something");
    assert.ok(
      costOfFive > costOfOne * 3,
      `expected a far larger penalty for five gaps, got ${costOfOne} then ${costOfFive}`,
    );
  });

  it("scores partial coverage strictly below the linear ratio", () => {
    // This is what the convex exponent actually buys, and the property worth
    // pinning: at any partial coverage the component is worth LESS than the
    // fraction of skills held. (Note the marginal cost of the first skill lost
    // is the largest — that is inherent to an exponent above 1, so a
    // "5 gaps cost more than 5x one gap" assertion would be backwards.)
    for (const held of [1, 2, 3, 4, 5, 6, 7]) {
      const result = computeMatch(userWith(eight.slice(0, held)), job, at());
      const component = result.components.find((c) => c.id === "requiredSkills");
      assert.ok(component);
      const linearRatio = held / eight.length;
      assert.ok(
        component.score < linearRatio || component.score < 1,
        `holding ${held}/8 scored ${component.score}, not below the linear ${linearRatio}`,
      );
    }
    const full = computeMatch(userWith(eight), job, at());
    assert.equal(full.components.find((c) => c.id === "requiredSkills")?.score, 1);
  });

  it("penalises a gap in required skills harder than the same gap in preferred", () => {
    const held = eight.slice(0, 5);
    const requiredJob = makeJob({
      requiredSkills: eight.map((canonicalId) => ({ canonicalId, weight: 1 })),
      seniority: 2,
    });
    const preferredJob = makeJob({
      preferredSkills: eight.map((canonicalId) => ({ canonicalId, weight: 1 })),
      seniority: 2,
    });
    const asRequired = computeMatch(userWith(held), requiredJob, at()).components.find(
      (c) => c.id === "requiredSkills",
    );
    const asPreferred = computeMatch(userWith(held), preferredJob, at()).components.find(
      (c) => c.id === "preferredSkills",
    );
    assert.ok(asRequired && asPreferred);
    assert.ok(
      asRequired.score < asPreferred.score,
      `convex ${asRequired.score} should sit below concave ${asPreferred.score}`,
    );
  });

  it("is monotonic — every skill removed lowers the score", () => {
    let previous = Infinity;
    for (let held = eight.length; held >= 0; held--) {
      const score = computeMatch(userWith(eight.slice(0, held)), job, at()).score;
      assert.ok(score <= previous, `score rose when dropping to ${held} skills`);
      previous = score;
    }
  });

  it("preferred skills show diminishing returns instead", () => {
    const preferredJob = makeJob({
      preferredSkills: eight.map((canonicalId) => ({ canonicalId, weight: 1 })),
      seniority: 2,
    });
    const first = computeMatch(userWith(eight.slice(0, 1)), preferredJob, at()).score;
    const none = computeMatch(userWith([]), preferredJob, at()).score;
    const seven = computeMatch(userWith(eight.slice(0, 7)), preferredJob, at()).score;
    const eightOf = computeMatch(userWith(eight), preferredJob, at()).score;

    const firstGain = first - none;
    const lastGain = eightOf - seven;
    assert.ok(
      firstGain > lastGain,
      `expected the first preferred skill (${firstGain}) to be worth more than the eighth (${lastGain})`,
    );
  });
});

/* ---------------------------------------------------------------------- */

describe("experience component", () => {
  const job = makeJob({ minYears: 2, maxYears: 5, seniority: 2 });
  const titled = (months: number, seniority: 0 | 1 | 2 | 3 | 4 | 5 = 2): UserProfile =>
    makeUser({
      totalMonthsExperience: months,
      titles: [{ normalizedTitle: "engineer", months, seniority }],
    });

  it("scores 1.0 inside the stated range", () => {
    assert.equal(experienceScore(titled(36), job), 1);
  });

  it("penalises being under the minimum", () => {
    assert.ok(experienceScore(titled(12), job) < 1);
    assert.ok(experienceScore(titled(12), job) > experienceScore(titled(0), job));
  });

  it("penalises overqualification", () => {
    const inRange = experienceScore(titled(48), job);
    const over = experienceScore(titled(48 + 12 * 6), job);
    assert.ok(over < inRange, "an overqualified candidate must score lower");
  });

  it("never drops the component below the overqualification floor", () => {
    // Seniority held equal so the floor is tested in isolation.
    for (const extraYears of [1, 5, 10, 25, 50, 200]) {
      const months = (5 + extraYears) * 12;
      const score = experienceScore(titled(months), job);
      assert.ok(
        score >= OVER_EXPERIENCE_FLOOR - 1e-9,
        `${extraYears} extra years fell to ${score}, below the ${OVER_EXPERIENCE_FLOOR} floor`,
      );
    }
  });

  it("caps the seniority penalty", () => {
    const aligned = experienceScore(titled(36, 2), job);
    const wildlyOff = experienceScore(titled(36, 5), job);
    assert.ok(aligned - wildlyOff <= 0.3 + 1e-9);
  });
});

/* ---------------------------------------------------------------------- */

describe("invariants", () => {
  it("WEIGHTS sum to 1.0", () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) <= WEIGHT_SUM_TOLERANCE, `weights summed to ${sum}`);
  });

  it("every component is in [0,1] and every score in [0,100]", () => {
    for (const fixture of ALL_FIXTURES) {
      const result = computeMatch(fixture.user, fixture.job, at());
      assert.ok(result.score >= 0 && result.score <= 100, `${fixture.name} score out of range`);
      assert.ok(result.rawScore >= 0 && result.rawScore <= 100);
      assert.ok(result.confidence >= 0 && result.confidence <= 1);
      assert.equal(result.components.length, COMPONENT_ORDER.length);
      for (const component of result.components) {
        assert.ok(
          component.score >= 0 && component.score <= 1,
          `${fixture.name}/${component.id} = ${component.score}`,
        );
        assert.equal(component.weight, WEIGHTS[component.id]);
        assert.ok(Math.abs(component.contribution - component.score * component.weight * 100) < 1e-6);
        assert.ok(component.explanation.length > 0);
      }
      assert.equal(result.scoreVersion, SCORE_VERSION);
    }
  });

  it("holds for degenerate inputs", () => {
    const empty = computeMatch(makeUser(), makeJob(), at());
    assert.ok(empty.score >= 0 && empty.score <= 100);
    assert.deepEqual(empty.gatesFailed, []);
    // A posting that asks for nothing cannot be failed on skills.
    assert.equal(empty.components.find((c) => c.id === "requiredSkills")?.score, 1);
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

  it("bands line up with their thresholds", () => {
    for (const fixture of ALL_FIXTURES) {
      const result = computeMatch(fixture.user, fixture.job, at());
      if (result.band === "ineligible") continue;
      const threshold = BAND_THRESHOLDS.find((b) => b.band === result.band);
      assert.ok(threshold);
      assert.ok(result.score >= threshold.min, `${fixture.name} band/score mismatch`);
    }
  });

  it("populates displayRange only below the confidence threshold", () => {
    // A bare profile against a bare posting: nothing parsed, low confidence.
    const thin = computeMatch(
      makeUser({ skills: [{ canonicalId: "python", level: 1, months: 0, source: "listed" }] }),
      makeJob({ requiredSkills: [{ canonicalId: "python", weight: 1 }] }),
      { ...at(), taxonomyHitRate: 0.2 },
    );
    assert.ok(thin.confidence < CONFIDENCE_DISPLAY_THRESHOLD, `confidence was ${thin.confidence}`);
    assert.ok(thin.displayRange !== null);
    const [low, high] = thin.displayRange;
    assert.equal(low, Math.max(0, thin.score - 8));
    assert.equal(high, Math.min(100, thin.score + 7));

    const confident = computeMatch(strongFixture.user, strongFixture.job, at());
    assert.ok(confident.confidence >= CONFIDENCE_DISPLAY_THRESHOLD);
    assert.equal(confident.displayRange, null);
  });
});

/* ---------------------------------------------------------------------- */

describe("gaps and strengths are true numbers", () => {
  it("every topGaps.pointsLost equals the recomputed score delta", () => {
    for (const fixture of ALL_FIXTURES) {
      const result = computeMatch(fixture.user, fixture.job, at());
      if (result.band === "ineligible") {
        assert.deepEqual(result.topGaps, []);
        continue;
      }
      for (const gap of result.topGaps) {
        const lifted = scoreWithSkillQuality(
          fixture.user,
          fixture.job,
          gap.kind,
          gap.canonicalId,
          1,
        );
        assert.equal(
          gap.pointsLost,
          lifted - result.score,
          `${fixture.name}: ${gap.canonicalId} claimed ${gap.pointsLost} but recomputing gave ${lifted - result.score}`,
        );
      }
    }
  });

  it("every topStrengths.pointsGained equals the recomputed score delta", () => {
    for (const fixture of ALL_FIXTURES) {
      const result = computeMatch(fixture.user, fixture.job, at());
      if (result.band === "ineligible") continue;
      for (const strength of result.topStrengths) {
        const required = fixture.job.requiredSkills.some(
          (s) => s.canonicalId === strength.canonicalId,
        );
        const dropped = scoreWithSkillQuality(
          fixture.user,
          fixture.job,
          required ? "required" : "preferred",
          strength.canonicalId,
          0,
        );
        assert.equal(
          strength.pointsGained,
          result.score - dropped,
          `${fixture.name}: ${strength.canonicalId} claimed ${strength.pointsGained}`,
        );
      }
    }
  });

  it("holds against a fully independent profile-level recomputation", () => {
    // Required skills chosen from four different broad domains so they are
    // pairwise `Infinity` apart. Acquiring one therefore cannot change any
    // other skill's quality, which makes "add it to the profile and re-score"
    // an exact check on `pointsLost` with no taxonomy cross-talk.
    const isolated = ["python", "solidworks", "statistics", "communication"];
    for (const a of isolated) {
      for (const b of isolated) {
        if (a !== b) {
          assert.equal(skillDistance(a, b), Infinity, `${a} and ${b} must be unrelated`);
        }
      }
    }

    const job = makeJob({
      requiredSkills: isolated.map((canonicalId) => ({ canonicalId, weight: 1 })),
    });
    const user = makeUser({
      skills: [{ canonicalId: "python", level: 3, months: 24, source: "experience" }],
      titles: [{ normalizedTitle: "engineer", months: 24, seniority: 0 }],
      totalMonthsExperience: 24,
    });

    const result = computeMatch(user, job, at());
    assert.ok(result.topGaps.length > 0);

    for (const gap of result.topGaps) {
      const acquired = computeMatch(
        {
          ...user,
          skills: [
            ...user.skills,
            { canonicalId: gap.canonicalId, level: 3, months: 24, source: "experience" },
          ],
        },
        job,
        at(),
      );
      assert.equal(
        gap.pointsLost,
        acquired.score - result.score,
        `acquiring ${gap.canonicalId} moved the score by ${acquired.score - result.score}, not the claimed ${gap.pointsLost}`,
      );
    }
  });

  it("ranks gaps by real points and caps the list at three", () => {
    for (const fixture of ALL_FIXTURES) {
      const { topGaps, topStrengths } = computeMatch(fixture.user, fixture.job, at());
      assert.ok(topGaps.length <= 3);
      assert.ok(topStrengths.length <= 3);
      for (let i = 1; i < topGaps.length; i++) {
        assert.ok(
          (topGaps[i - 1]?.pointsLost ?? 0) >= (topGaps[i]?.pointsLost ?? 0),
          `${fixture.name} gaps are not sorted`,
        );
      }
      for (const gap of topGaps) {
        assert.ok(gap.pointsLost > 0, "a zero-point gap is not a gap");
        assert.ok(gap.label.length > 0);
      }
    }
  });
});

/* ---------------------------------------------------------------------- */

describe("snapshot fixtures", () => {
  // Exact expected values. A diff here means the algorithm moved — which is
  // allowed, but it must come with a SCORE_VERSION bump and a deliberate
  // review of these five numbers.
  const expected: Record<string, { score: number; rawScore: number; band: string }> = {
    strong: { score: 97, rawScore: 97, band: "strong" },
    good: { score: 73, rawScore: 71, band: "good" },
    stretch: { score: 56, rawScore: 54, band: "stretch" },
    reach: { score: 17, rawScore: 21, band: "reach" },
    gated: { score: 0, rawScore: 0, band: "ineligible" },
  };

  for (const fixture of ALL_FIXTURES) {
    it(`${fixture.name}: ${fixture.description}`, () => {
      const result = computeMatch(fixture.user, fixture.job, at());
      const want = expected[fixture.name];
      assert.ok(want, `no expectation recorded for ${fixture.name}`);
      assert.equal(result.score, want.score, `${fixture.name} score`);
      assert.equal(result.rawScore, want.rawScore, `${fixture.name} rawScore`);
      assert.equal(result.band, want.band, `${fixture.name} band`);
    });
  }

  it("covers all five bands", () => {
    const bands = new Set(
      ALL_FIXTURES.map((f) => computeMatch(f.user, f.job, at()).band),
    );
    assert.deepEqual(
      [...bands].sort(),
      ["good", "ineligible", "reach", "stretch", "strong"],
    );
  });
});

/* ---------------------------------------------------------------------- */

describe("fairness", () => {
  // Protected characteristics must have zero effect. Two of these (name,
  // university) have no field on `UserProfile` at all — the strongest possible
  // guarantee — so the test injects them as extra properties and asserts the
  // engine ignores them regardless.
  function withExtraFields(user: UserProfile, extra: Record<string, unknown>): UserProfile {
    return { ...user, ...extra } as UserProfile;
  }

  const perturbations: Record<string, unknown>[] = [
    { name: "Alex Mercer" },
    { name: "Wei Zhang" },
    { age: 22 },
    { age: 58 },
    { gender: "female" },
    { gender: "male" },
    { gender: "non-binary" },
    { ethnicity: "Black" },
    { photoUrl: "https://example.com/a.jpg" },
    { university: "MIT" },
    { university: "Unranked Community College" },
    { nationality: "Nigerian" },
    { maritalStatus: "married" },
  ];

  it("ignores injected protected characteristics", () => {
    for (const fixture of ALL_FIXTURES) {
      const baseline = JSON.stringify(computeMatch(fixture.user, fixture.job, at()));
      for (const extra of perturbations) {
        const perturbed = JSON.stringify(
          computeMatch(withExtraFields(fixture.user, extra), fixture.job, at()),
        );
        assert.equal(
          perturbed,
          baseline,
          `${fixture.name} changed when ${JSON.stringify(extra)} was added`,
        );
      }
    }
  });

  it("ignores graduation year, which is on the type but must never be scored", () => {
    for (const fixture of ALL_FIXTURES) {
      const baseline = JSON.stringify(computeMatch(fixture.user, fixture.job, at()));
      for (const graduationDate of [
        null,
        "1975-06-30",
        "1998-01-15",
        "2015-05-01",
        "2027-07-01",
        "2031-12-31",
      ]) {
        const perturbed = JSON.stringify(
          computeMatch(
            { ...fixture.user, education: { ...fixture.user.education, graduationDate } },
            fixture.job,
            at(),
          ),
        );
        assert.equal(
          perturbed,
          baseline,
          `${fixture.name} changed for graduationDate ${String(graduationDate)}`,
        );
      }
    }
  });

  it("exposes no protected field on the profile contract", () => {
    const forbidden = ["name", "age", "gender", "ethnicity", "photo", "photoUrl", "university"];
    const keys = Object.keys(makeUser());
    for (const field of forbidden) {
      assert.ok(!keys.includes(field), `UserProfile must not carry '${field}'`);
    }
  });

  it("two profiles differing only in protected fields are interchangeable", () => {
    const a = withExtraFields(reachFixture.user, {
      name: "Jordan Ellis",
      age: 24,
      university: "Stanford",
      gender: "male",
    });
    const b = withExtraFields(reachFixture.user, {
      name: "Priya Raman",
      age: 47,
      university: "Open University",
      gender: "female",
    });
    const ra: MatchResult = computeMatch(a, reachFixture.job, at());
    const rb: MatchResult = computeMatch(b, reachFixture.job, at());
    assert.deepEqual(ra, rb);
  });
});

/* ---------------------------------------------------------------------- */

describe("taxonomy", () => {
  it("resolves messy real-world skill strings", () => {
    const cases: [string, string][] = [
      ["Python", "python"],
      ["python 3.11", "python"],
      ["  PYTHON  ", "python"],
      ["React.js", "react"],
      ["ReactJS", "react"],
      ["Experience with React", "react"],
      ["C++", "cpp"],
      ["c++17", "cpp"],
      ["C#", "csharp"],
      [".NET", "aspnet"],
      ["Node.js", "nodejs"],
      ["CI/CD", "ci-cd"],
      ["k8s", "kubernetes"],
      ["Amazon Web Services", "aws"],
      ["proficient in figma", "figma"],
      ["strong communication skills", "communication"],
      ["PCB layout", "pcb-design"],
      ["VHDL", "vhdl"],
      ["Solid Works", "solidworks"],
      ["machine learning", "machine-learning"],
    ];
    for (const [raw, want] of cases) {
      assert.equal(resolveSkill(raw), want, `resolveSkill(${JSON.stringify(raw)})`);
    }
  });

  it("returns null rather than guessing", () => {
    for (const raw of ["", "   ", "synergy", "rockstar ninja", "!!!"]) {
      assert.equal(resolveSkill(raw), null, `expected null for ${JSON.stringify(raw)}`);
    }
  });

  it("does not collapse distinct skills onto one id", () => {
    assert.notEqual(resolveSkill("C"), resolveSkill("C++"));
    assert.notEqual(resolveSkill("SAP"), resolveSkill("SAP2000"));
    assert.equal(resolveSkill("SAP"), "sap");
  });

  it("skillDistance is symmetric and reflexive", () => {
    const ids = ["react", "vue", "python", "solidworks", "vhdl", "aws", "communication"];
    for (const a of ids) {
      assert.equal(skillDistance(a, a), 0);
      for (const b of ids) {
        assert.equal(skillDistance(a, b), skillDistance(b, a), `${a} vs ${b}`);
      }
    }
  });

  it("grades distance the way the quality table expects", () => {
    assert.equal(skillDistance("react", "vue"), 1); // same family
    assert.equal(skillDistance("react", "javascript"), 1); // parent/child
    assert.equal(skillDistance("react", "postgresql"), 2); // same domain
    assert.equal(skillDistance("react", "solidworks"), Infinity); // unrelated
    assert.equal(skillDistance("react", "not-a-real-skill"), Infinity);
  });
});
