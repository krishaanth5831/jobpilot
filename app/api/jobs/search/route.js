import { NextResponse } from "next/server";
import { searchJobs } from "@/lib/job-sources";
import { fuzzyJobKey } from "@/lib/job-sources/dedupe";
import { askClaudeJSON, ConfigError } from "@/lib/claude";
import { QUERY_SCHEMA, QUERY_SYSTEM_PROMPT, buildQueryPrompt } from "@/lib/matcher";
import { getUserData, SIGN_IN_ERROR } from "@/lib/user-data";

// Keyword boards match job TITLES (role nouns), not fields — "Electrical
// Engineer Intern" returns results where "Electrical Engineering Intern"
// returns zero. Claude tends to write the field form, so we also generate the
// role-noun form deterministically and search it first.
const ROLE_NOUN = {
  engineering: "Engineer",
  internship: "Intern",
  development: "Developer",
  programming: "Programmer",
  analytics: "Analyst",
  accounting: "Accountant",
  consulting: "Consultant",
  administration: "Administrator",
};
function expandTitles(titles) {
  const out = [];
  const add = (t) => {
    const v = t.trim();
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  };
  for (const t of titles) {
    const roleForm = t.replace(
      /\b(Engineering|Internship|Development|Programming|Analytics|Accounting|Consulting|Administration)\b/gi,
      (m) => ROLE_NOUN[m.toLowerCase()]
    );
    if (roleForm !== t) add(roleForm); // role-noun form first — it matches boards
    add(t);
  }
  return out.slice(0, 3);
}

// Rewrite a messy search into common job-board title variants (see QUERY_* in
// matcher.js). Best-effort: if Claude is unavailable, search the raw text.
async function optimizeRole(role) {
  try {
    const { titles } = await askClaudeJSON({
      system: QUERY_SYSTEM_PROMPT,
      prompt: buildQueryPrompt(role),
      schema: QUERY_SCHEMA,
      maxTokens: 300,
    });
    const clean = (titles ?? []).map((t) => t?.trim()).filter(Boolean);
    return clean.length ? expandTitles(clean) : [role];
  } catch {
    return [role];
  }
}

// GET /api/jobs/search?role=software+engineer+intern&location=remote
// Fetches jobs from the configured job boards and stores them (unmatched).
// `raw=1` skips the title rewrite (used when searching a specific company).
// `merge=1` adds the results to the current pool instead of replacing it
// (used when drilling into a country from the filter).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const location = searchParams.get("location") ?? "";
  const raw = searchParams.get("raw") === "1";
  const merge = searchParams.get("merge") === "1";
  if (!role) {
    return NextResponse.json({ error: "role query param is required" }, { status: 400 });
  }

  try {
    const roles = raw ? [role] : await optimizeRole(role);
    const searchedAs = roles[0];
    let jobs = await searchJobs({ roles, location });

    const { db, data } = await getUserData();
    if (!data) return NextResponse.json(SIGN_IN_ERROR, { status: 401 });
    // A job already screened under another board's id (fuzzy company+title
    // match) reuses that verdict instead of paying to screen a duplicate —
    // but we keep THIS result's own location, so a job surfaced in an
    // earlier search for a different place doesn't relabel it.
    const storedByKey = new Map();
    for (const j of data.jobs) {
      const key = fuzzyJobKey(j);
      if (key && !storedByKey.has(key)) storedByKey.set(key, j);
    }
    jobs = jobs.map((job) => {
      const key = fuzzyJobKey(job);
      const stored = key && storedByKey.get(key);
      if (!stored) return job;
      // Same posting, seen before: keep its verdict, but refresh the location
      // and link to this search's result so it's labeled for where we looked.
      stored.location = job.location;
      stored.url = job.url;
      return stored;
    });
    // Two incoming jobs can collapse onto one stored job — dedupe by id.
    jobs = [...new Map(jobs.map((j) => [j.id, j])).values()];

    const known = new Set(data.jobs.map((j) => j.id));
    for (const job of jobs) {
      if (!known.has(job.id)) data.jobs.push({ ...job, match: null });
    }
    // Remember which jobs this search returned — the jobs and roadmap pages
    // show only the latest search instead of the whole stored backlog.
    // Merge mode keeps the existing pool and adds these ids (drilling into a
    // country enriches the current results); otherwise this search replaces it.
    const prevIds = merge ? data.lastSearch?.jobIds ?? [] : [];
    data.lastSearch = {
      role: merge ? data.lastSearch?.role ?? searchedAs : searchedAs,
      location: merge ? data.lastSearch?.location ?? "" : location,
      at: new Date().toISOString(),
      jobIds: [...new Set([...prevIds, ...jobs.map((j) => j.id)])],
    };
    await db.write();

    // Return the stored versions so already-screened jobs keep their match.
    const stored = new Map(data.jobs.map((j) => [j.id, j]));
    return NextResponse.json({
      jobs: jobs.map((j) => stored.get(j.id) ?? j),
      searchedAs,
    });
  } catch (err) {
    console.error("job search failed:", err);
    const message = err instanceof ConfigError ? err.message : "Job search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
