import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import {
  RECOMMEND_SCHEMA,
  RECOMMEND_SYSTEM_PROMPT,
  buildRecommendPrompt,
} from "@/lib/matcher";
import { getDb } from "@/lib/db";

// POST /api/recommend — Claude reads the stored profile and suggests
// job-board searches the candidate actually qualifies for (jobs,
// internships, exploratory programs). Persisted so revisits are free.
export async function POST() {
  const db = await getDb();
  if (!db.data.profile) {
    return NextResponse.json(
      { error: "Upload a resume first — recommendations come from your profile" },
      { status: 400 }
    );
  }

  try {
    const { recommendations } = await askClaudeJSON({
      system: RECOMMEND_SYSTEM_PROMPT,
      prompt: buildRecommendPrompt(db.data.profile),
      schema: RECOMMEND_SCHEMA,
    });

    db.data.recommendations = {
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
  const db = await getDb();
  return NextResponse.json({
    recommendations: db.data.recommendations?.items ?? null,
  });
}
