import { NextResponse } from "next/server";
import { askFreeJSON, freeModelAvailable } from "@/lib/free-model";
import { withinRateLimit, clientIp } from "@/lib/rate-limit";

// POST /api/public/ats-check — the no-account teaser behind /check.
// Anyone can paste resume text and get a score plus the top two issues;
// the full list is the sign-up hook. Runs on the free built-in model
// (server-wide Groq key) with a per-IP daily cap so it can't be farmed.

const CHECKS_PER_DAY = 3;

const TEASER_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", description: "ATS-friendliness 0-100" },
    summary: { type: "string", description: "two sentences: overall verdict and the one thing to fix first" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "important", "polish"] },
          problem: { type: "string", description: "one concrete issue, most damaging first" },
        },
        required: ["severity", "problem"],
        additionalProperties: false,
      },
    },
  },
  required: ["score", "summary", "issues"],
  additionalProperties: false,
};

const SYSTEM = `You are an ATS (applicant tracking system) resume auditor. Score the resume's
ATS-friendliness 0-100 and list every concrete issue you find, most damaging
first: parsing hazards (tables, columns, odd characters), missing or
non-standard sections, inconsistent dates, weak keyword coverage, unquantified
bullets. Issues must be specific to THIS resume, never generic advice.`;

export async function POST(request) {
  if (!freeModelAvailable()) {
    return NextResponse.json(
      { error: "The free checker is temporarily unavailable — try again later." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const resumeText = String(body.resumeText ?? "").trim();
  if (resumeText.length < 200) {
    return NextResponse.json(
      { error: "Paste your full resume text — that's too short to review." },
      { status: 400 }
    );
  }
  if (resumeText.length > 20000) {
    return NextResponse.json(
      { error: "That's too long for the free check — paste just the resume." },
      { status: 400 }
    );
  }

  const ok = await withinRateLimit(`ats:${clientIp(request)}`, {
    limit: CHECKS_PER_DAY,
    windowSeconds: 86400,
  });
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "That's the free checks for today. Create a free account for unlimited reviews with full fixes.",
      },
      { status: 429 }
    );
  }

  try {
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const { score, summary, issues } = await askFreeJSON({
      system: SYSTEM,
      prompt: `Today's date is ${today} — only dates after today are "in the future".\n\nRESUME TEXT:\n\n${resumeText}`,
      schema: TEASER_SCHEMA,
      maxTokens: 2000,
    });

    // The teaser shows two issues; the rest are the reason to sign up.
    return NextResponse.json({
      score: Math.max(0, Math.min(100, Math.round(score))),
      summary,
      topIssues: (issues ?? []).slice(0, 2),
      totalIssues: (issues ?? []).length,
    });
  } catch (err) {
    console.error("public ats check failed:", err);
    return NextResponse.json(
      { error: "The check didn't go through — try again in a minute." },
      { status: 500 }
    );
  }
}
