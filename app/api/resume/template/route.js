import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import {
  TEMPLATE_REC_SCHEMA,
  TEMPLATE_REC_SYSTEM_PROMPT,
  buildTemplateRecPrompt,
} from "@/lib/reviewer";
import { TEMPLATE_IDS } from "@/lib/resume-templates";
import { getDb } from "@/lib/db";

// POST /api/resume/template — body: { id } to select a template for every
// PDF download, or { recommend: true } to (re)generate the 3 recommended
// picks from the profile.
export async function POST(request) {
  const db = await getDb();
  const body = await request.json();

  if (body.id) {
    if (!TEMPLATE_IDS.includes(body.id)) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }
    db.data.resumeTemplate = { ...(db.data.resumeTemplate ?? { picks: null }), selected: body.id };
    await db.write();
    return NextResponse.json({ template: db.data.resumeTemplate });
  }

  if (body.recommend) {
    if (!db.data.profile) {
      return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
    }
    try {
      const { picks } = await askClaudeJSON({
        system: TEMPLATE_REC_SYSTEM_PROMPT,
        prompt: buildTemplateRecPrompt(db.data.profile),
        schema: TEMPLATE_REC_SCHEMA,
      });
      const top3 = picks.slice(0, 3);
      db.data.resumeTemplate = {
        selected: db.data.resumeTemplate?.selected ?? top3[0]?.id,
        picks: top3,
      };
      await db.write();
      return NextResponse.json({ template: db.data.resumeTemplate });
    } catch (err) {
      console.error("template recommendation failed:", err);
      const message =
        err instanceof ConfigError ? err.message : "Template recommendation failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Pass { id } or { recommend: true }" }, { status: 400 });
}
