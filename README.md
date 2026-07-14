# jobpilot ✈️

**Your AI copilot for job applications.** Upload your resume, and jobpilot finds jobs worldwide that you actually qualify for, scores your resume for ATS-friendliness, drafts tailored applications for your review, and — for the jobs you *want* but don't qualify for yet — builds a concrete roadmap to get you there. Free to run on your own machine.

> jobpilot **prepares** applications for human review. It never bot-submits to job boards — you always click the final "apply" yourself.

## What it does

- **Searches job boards worldwide — a dozen sources — and screens every result.** Type a role however you phrase it; jobpilot rewrites it into the title recruiters actually post, fans out across many boards, and gives each posting an honest **0–100 fit score** against your resume (what matched, what's missing, why).
- **Filter the worldwide pool** by country, job type (internship / full-time / part-time / contract), and experience level — no re-searching.
- **Companies to target** — one click gives you 30+ real companies that hire in your field (region-biased but worldwide); click any to see their openings.
- **Auto-apply** — any job scoring above 35 automatically gets a cover letter drafted into your review queue (you still send it yourself).
- **Resume studio** — an **ATS-friendliness score** with a pass/warn/fail checklist and a concrete fix for every issue; a **visual, field-by-field editor** with a live preview; and **13 templates** (Harvard, reverse-chronological, two-column, and more) that typeset whatever you write into a downloadable PDF.
- **Tailored resumes** — one click re-emphasizes your real material for a specific job, as a ready-to-send PDF.
- **Roadmap** — for jobs you don't qualify for yet, the missing requirements become an ordered plan: skills to learn, projects to build, time estimates, free resources.
- **What's worked** — every application you mark *hired* is distilled into lessons that sharpen future reviews and cover letters.
- **Accounts** — email/password sign-in; each account keeps its own data and its own API keys.

## How it works

1. **Upload** (`/upload`) — drop in your resume PDF. Claude extracts a structured profile (skills, experience, education, projects). Nothing is invented — only what's on the resume.
2. **Studio** (`/resume`) — get an ATS score + fixes, edit your resume right on the page, and pick a template.
3. **Search** (`/jobs`) — pull live postings worldwide, filter them, and let jobpilot screen each against your resume. Qualifying jobs (score > 35) auto-draft into your queue.
4. **Review** (`/queue`) — read and tweak each drafted cover letter, apply on the company's page, mark it done.
5. **Roadmap** (`/roadmap`) — for jobs you're not qualified for yet, get an ordered get-qualified plan.

## Job sources

All fetched live and screened against your resume:

- **JSearch** (via RapidAPI) — Google's worldwide job index: LinkedIn, Indeed, Glassdoor, ZipRecruiter…
- **Adzuna** — per-country boards across ~19 countries
- **Greenhouse** & **Lever** — public company career boards
- **Remotive · RemoteOK · Jobicy · Himalayas · The Muse · Arbeitnow** — remote and worldwide boards (Arbeitnow is Europe-heavy)
- **Community GitHub lists** — Simplify, Speedyapply, and others (internships / new-grad)

The keyless sources run on every search and don't touch the rate-limited JSearch/Adzuna quotas, so a location-free search fans out across the globe for free.

## Setup

```bash
npm install
npm run dev
```

Then open the app, **create an account**, and paste your keys on the **Settings** page (each account uses its own keys and credits):

- an **Anthropic API key** — https://platform.claude.com
- **Adzuna app id + key** (free) — https://developer.adzuna.com
- a **RapidAPI key** subscribed to the free **JSearch** API — https://rapidapi.com

Only the Anthropic key is strictly required (the keyless boards still work without Adzuna/JSearch). Keys live in the per-account store, never in the browser. `data/db.json` and `.env.local` are gitignored — no secrets are committed.

### Cost

Claude calls run on **Claude Haiku 4.5** — the cheapest Claude model — using structured outputs (JSON schema) so verdicts and roadmaps are machine-readable, not prose. Screening and cover-letter drafting are short, schema-constrained calls; Haiku keeps spend low. To trade cost for quality, switch `MODEL` in `lib/claude.js` to `claude-sonnet-5` or `claude-opus-4-8`.

## Architecture

```
app/
├── page.js                    # Landing / dashboard
├── signin/ upload/ jobs/      # Auth, resume upload, worldwide job search
├── resume/ queue/ roadmap/    # Resume studio, review queue, skill-gap roadmap
├── stats/ settings/           # Pipeline stats, per-account API keys
└── api/
    ├── auth/ register/        # Auth.js (JWT) + email/password sign-up
    ├── resume/                # upload · ATS review · document (editor) · pdf · tailor · template
    ├── jobs/ jobs/search/     # worldwide multi-source search
    ├── match/                 # Claude scores profile vs job; auto-applies > 35
    ├── applications/          # cover-letter drafts + review-queue CRUD + follow-up
    ├── recommend/ roadmap/    # companies to target · get-qualified plan
    └── insights/ stats/ settings/

lib/
├── claude.js                  # Anthropic client + JSON/text helpers (Haiku)
├── matcher.js reviewer.js     # prompts + JSON schemas (profile, match, ATS, recommend…)
├── resume-*.js                # parser · structured doc · markdown · pdfkit renderer · templates
├── applications.js            # shared cover-letter drafting + auto-apply
├── db.js user-data.js         # lowdb JSON storage, partitioned per user
├── accounts.js auth.js api-keys.js password.js   # email/password auth + per-user keys
└── job-sources/               # one adapter per board, normalized to one job shape
    ├── index.js location.js classify.js relevance.js
    ├── jsearch.js adzuna.js greenhouse.js lever.js github-repos.js
    └── remotive.js remoteok.js jobicy.js himalayas.js themuse.js arbeitnow.js
```

All Claude calls run server-side in API routes; the API key never reaches the browser.

## Tech

Next.js (App Router) · React · Tailwind CSS v4 · Auth.js · Claude API (`@anthropic-ai/sdk`, Haiku 4.5) · pdfkit · pdf-parse · lowdb

## Workflow

Work happens on the `dev` branch; `main` is protected and only changes via pull requests with passing CI. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full flow.

## Design

Strictly **black & white — color only in animations and 3D renders**. Built with motion-primitives.
