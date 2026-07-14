import { NextResponse } from "next/server";
import { resumeMarkdownToPdf } from "@/lib/resume-pdf";
import { profileToMarkdown } from "@/lib/resume-doc";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// GET /api/resume/pdf — the studio resume typeset as a downloadable PDF.
// With ?jobId=…, serves the resume tailored to that job instead. The plain
// download falls back to a markdown rendering of the profile, so it works
// even before the editor has been saved.
export async function GET(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  const markdown = jobId
    ? data.tailoredResumes?.[jobId]?.markdown
    : data.builtResume?.markdown ??
      (data.profile ? profileToMarkdown(data.profile) : null);
  if (!markdown) {
    return NextResponse.json(
      {
        error: jobId
          ? "No tailored resume for this job yet"
          : "Upload a resume first — the studio needs something to typeset",
      },
      { status: 404 }
    );
  }

  try {
    // Every PDF (studio or tailored) uses the template chosen in the studio.
    const pdf = await resumeMarkdownToPdf(markdown, data.resumeTemplate?.selected);
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
