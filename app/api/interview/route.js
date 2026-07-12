import { NextResponse } from "next/server";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import {
  INTERVIEW_SCHEMA,
  INTERVIEW_SYSTEM_PROMPT,
  MAX_INTERVIEW_QUESTIONS,
  buildInterviewPrompt,
} from "@/lib/reviewer";
import { getDb } from "@/lib/db";

// The grill-me interview: Claude asks one pointed question at a time to
// extract resume-worthy material the resume leaves out. State lives in the
// db as { questions: [{ question, focus, answer }], done }.

// POST /api/interview — body: {} to start / get the next question,
// { answer } to answer the pending question, { finish: true } to stop early,
// { restart: true } to throw the transcript away and start over.
export async function POST(request) {
  const db = await getDb();
  if (!db.data.profile || !db.data.resumeText) {
    return NextResponse.json({ error: "Upload a resume first" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  let interview =
    body.restart || !db.data.interview
      ? { questions: [], done: false }
      : db.data.interview;

  const pending = interview.questions.find((q) => q.answer === null);
  if (typeof body.answer === "string" && pending) {
    pending.answer = body.answer.trim();
  }

  const answered = interview.questions.filter((q) => q.answer !== null).length;
  if (body.finish || answered >= MAX_INTERVIEW_QUESTIONS) {
    interview.done = true;
  }

  try {
    // Ask for the next question unless finished or one is still pending.
    if (!interview.done && !interview.questions.some((q) => q.answer === null)) {
      const next = await askClaudeJSON({
        system: INTERVIEW_SYSTEM_PROMPT,
        prompt: buildInterviewPrompt(
          db.data.profile,
          db.data.resumeText,
          interview,
          db.data.insights,
          db.data.resumeReview
        ),
        schema: INTERVIEW_SCHEMA,
      });
      if (next.done) interview.done = true;
      else interview.questions.push({ question: next.question, focus: next.focus, answer: null });
    }

    db.data.interview = interview;
    await db.write();
    return NextResponse.json({ interview });
  } catch (err) {
    console.error("interview step failed:", err);
    const message = err instanceof ConfigError ? err.message : "Interview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
