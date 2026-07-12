import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import {
  RECOMMEND_SCHEMA,
  RECOMMEND_SYSTEM_PROMPT,
  buildRecommendPrompt,
} from "@/lib/matcher";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// POST /api/recommend — Claude reads the stored profile and suggests
// job-board searches the candidate actually qualifies for (jobs,
// internships, exploratory programs). Persisted so revisits are free.
export async function POST() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  if (!data.profile) {
    return NextResponse.json(
      { error: "Upload a resume first — recommendations come from your profile" },
      { status: 400 }
    );
  }

  try {
    const { recommendations } = await askClaudeJSON({
      system: RECOMMEND_SYSTEM_PROMPT,
      prompt: buildRecommendPrompt(data.profile),
      schema: RECOMMEND_SCHEMA,
    });

    data.recommendations = {
      items: recommendations,
      createdAt: new Date().toISOString(),
    };
    await db.write();
    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error("recommendation failed:", err);
    const message = err instanceof ConfigError ? err.message : "Recommendation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/recommend — the stored recommendations, if any.
export async function GET() {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  return NextResponse.json({
    recommendations: data.recommendations?.items ?? null,
  });
}
