import { NextResponse } from "next/server";
import { resumeMarkdownToPdf } from "@/lib/resume-pdf";
import { getDb } from "@/lib/db";

// GET /api/resume/pdf — the rebuilt resume typeset as a downloadable PDF.
export async function GET() {
  const db = await getDb();
  if (!db.data.builtResume?.markdown) {
    return NextResponse.json(
      { error: "No rebuilt resume yet — build one in the resume studio first" },
      { status: 404 }
    );
  }

  try {
    const pdf = await resumeMarkdownToPdf(db.data.builtResume.markdown);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });
  } catch (err) {
    console.error("resume pdf failed:", err);
    return NextResponse.json({ error: "Couldn't generate the PDF" }, { status: 500 });
  }
}
