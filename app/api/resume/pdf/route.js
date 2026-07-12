import { NextResponse } from "next/server";
import { resumeMarkdownToPdf } from "@/lib/resume-pdf";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// GET /api/resume/pdf — the rebuilt resume typeset as a downloadable PDF.
// With ?jobId=…, serves the resume tailored to that job instead.
export async function GET(request) {
  const { db, data } = await getUserData();
  if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId");
  const source = jobId ? data.tailoredResumes?.[jobId] : data.builtResume;
  if (!source?.markdown) {
    return NextResponse.json(
      {
        error: jobId
          ? "No tailored resume for this job yet"
          : "No rebuilt resume yet — build one in the resume studio first",
      },
      { status: 404 }
    );
  }

  try {
    // Every PDF (rebuilt or tailored) uses the template chosen in the studio.
    const pdf = await resumeMarkdownToPdf(
      source.markdown,
      data.resumeTemplate?.selected
    );
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
