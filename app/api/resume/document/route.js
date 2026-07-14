import { NextResponse } from "next/server";
import { profileToDoc, profileToMarkdown } from "@/lib/resume-doc";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// PUT /api/resume/document — save the resume the user edited in the studio.
// The editor sends a structured document (contact, experience, education,
// skills, projects). We store the structured form (so the editor reloads it),
// derive the markdown every PDF/template preview uses, and fold the edits back
// into the profile so job screening reflects what they actually wrote.
export async function PUT(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.doc !== "object" || body.doc === null) {
    return NextResponse.json({ error: "Pass { doc }" }, { status: 400 });
  }

  // Normalize through profileToDoc so only known fields are stored, shapes are
  // consistent, and a runaway payload can't bloat the document.
  const doc = profileToDoc(body.doc);
  const markdown = profileToMarkdown(doc);
  if (markdown.length > 60_000) {
    return NextResponse.json({ error: "That resume is too long to save" }, { status: 400 });
  }

  data.builtResume = { structured: doc, markdown, createdAt: new Date().toISOString() };
  // Keep the profile's non-resume fields (field, years_of_experience) but adopt
  // the edited resume content, so screening sees the current resume.
  data.profile = { ...(data.profile ?? {}), ...doc };
  await db.write();
  return NextResponse.json({ savedAt: data.builtResume.createdAt });
}
