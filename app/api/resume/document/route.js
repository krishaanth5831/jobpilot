import { NextResponse } from "next/server";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// A resume is a page or two of text — cap it so a runaway paste can't bloat
// the stored document.
const MAX_LEN = 60_000;

// PUT /api/resume/document — save the resume the user edited in the studio.
// This markdown is the single source every PDF download and template preview
// uses, so saving here is all it takes to change what downloads.
export async function PUT(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });

  const body = await request.json().catch(() => null);
  const markdown = typeof body?.markdown === "string" ? body.markdown : null;
  if (markdown === null) {
    return NextResponse.json({ error: "Pass { markdown }" }, { status: 400 });
  }
  if (markdown.length > MAX_LEN) {
    return NextResponse.json({ error: "That resume is too long to save" }, { status: 400 });
  }

  data.builtResume = { markdown, createdAt: new Date().toISOString() };
  await db.write();
  return NextResponse.json({ savedAt: data.builtResume.createdAt });
}
