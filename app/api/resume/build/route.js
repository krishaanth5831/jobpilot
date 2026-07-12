import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import {
  BUILD_SCHEMA,
  BUILD_SYSTEM_PROMPT,
  buildBuildPrompt,
  TEMPLATE_REC_SCHEMA,
  TEMPLATE_REC_SYSTEM_PROMPT,
  buildTemplateRecPrompt,
} from "@/lib/reviewer";
import { getDb } from "@/lib/db";

// POST /api/resume/build — rebuild the resume from the original text plus
// the grill-me interview answers. Also replaces the stored profile with the
// enriched one, so job matching sees everything the interview surfaced.
export async function POST() {
  const db = await getDb();
  if (!db.data.profile || !db.data.resumeText) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
  }

  try {
    const result = await askClaudeJSON({
      system: BUILD_SYSTEM_PROMPT,
      prompt: buildBuildPrompt(
        db.data.resumeText,
        db.data.interview,
        db.data.insights,
        db.data.resumeReview
      ),
      schema: BUILD_SCHEMA,
    });

    db.data.profile = result.profile;
    db.data.builtResume = {
      markdown: result.resume_markdown,
      createdAt: new Date().toISOString(),
    };

    // Recommend 3 templates for the fresh profile. Non-fatal: a failure
    // here must not lose the rebuilt resume.
    try {
      const { picks } = await askClaudeJSON({
        system: TEMPLATE_REC_SYSTEM_PROMPT,
        prompt: buildTemplateRecPrompt(result.profile),
        schema: TEMPLATE_REC_SCHEMA,
      });
      const top3 = picks.slice(0, 3);
      db.data.resumeTemplate = {
        selected: db.data.resumeTemplate?.selected ?? top3[0]?.id,
        picks: top3,
      };
    } catch (err) {
      console.warn("template recommendation failed:", err?.message);
    }
    await db.write();

    return NextResponse.json({
      profile: result.profile,
      builtResume: db.data.builtResume,
      template: db.data.resumeTemplate ?? null,
    });
  } catch (err) {
    console.error("resume build failed:", err);
    const message = err instanceof ConfigError ? err.message : "Resume build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
