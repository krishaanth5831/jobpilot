# jobpilot ✈️

**Your AI copilot for job applications.** Upload your resume, and jobpilot uses the Claude API to find jobs you actually qualify for, draft tailored applications for your review, and — for the jobs you *want* but don't qualify for yet — build a concrete roadmap to get you there.

> jobpilot **prepares** applications for human review. It never bot-submits to job boards — you always click the final "apply" yourself.

## How it works

1. **Upload** (`/upload`) — drop in your resume PDF. Claude extracts a structured profile: skills, experience, education, projects. Nothing is invented — only what's actually on the resume.
2. **Match** (`/jobs`) — search real job postings (Adzuna API). Claude compares each posting's hard requirements against your profile and returns a verdict: qualified or not, a 0–100 fit score, and exactly which requirements you're missing.
3. **Apply** (`/queue`) — for qualified jobs, Claude drafts a tailored cover letter grounded in your real experience. Review it, tweak it, apply on the company's page, mark it done.
4. **Roadmap** (`/roadmap`) — for jobs you don't qualify for yet, Claude turns the missing requirements into an ordered action plan: skills to learn, projects to build, time estimates, and free resources.

## Architecture

```
app/
├── page.js                  # Landing / dashboard
├── upload/page.js           # Resume upload UI
├── jobs/page.js             # Job search + qualified/not-yet badges
├── queue/page.js            # Application review queue
├── roadmap/page.js          # Skill-gap roadmap
└── api/
    ├── resume/route.js      # PDF → text → Claude → structured profile
    ├── jobs/search/route.js # Job board search (Adzuna adapter)
    ├── match/route.js       # Claude scores profile vs job requirements
    ├── applications/route.js# Claude drafts cover letters (review queue CRUD)
    └── roadmap/route.js     # Claude builds the get-qualified plan

lib/
├── claude.js                # Anthropic client + JSON/text call helpers
├── resume-parser.js         # pdf-parse wrapper
├── matcher.js               # prompts + JSON schemas (profile, match, roadmap)
├── db.js                    # lowdb JSON storage (data/db.json, gitignored)
└── job-sources/             # job board adapters, normalized to one job shape
    ├── index.js
    └── adzuna.js
```

All Claude calls run server-side in API routes using structured outputs (JSON schema), so match verdicts and roadmaps are machine-readable, not prose. The API key never reaches the browser.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

You'll need:
- an **Anthropic API key** — https://platform.claude.com
- **Adzuna app id + key** (free) — https://developer.adzuna.com

## Roadmap

- [ ] Editable profile cards after upload (instead of raw JSON)
- [ ] Job picker on the roadmap page (instead of pasting a job id)
- [ ] More job sources (JSearch, USAJobs, Greenhouse/Lever boards)
- [ ] Real database (SQLite/Postgres via Prisma) + auth for multi-user
- [ ] One-click submit for boards with real application APIs (Greenhouse/Lever)

## Design & build plan

The site is strictly **black & white — color only in animations and 3D renders**. The full design system, tool stack (motion-primitives, Haikei, Spline, Lenis), page-by-page specs, and phased build plan live in [docs/website-plan.md](docs/website-plan.md).

## Workflow

Work happens on the `dev` branch; `main` is protected and only changes via pull requests with passing CI. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full flow.

## Tech

Next.js (App Router) · React · Tailwind CSS · Claude API (`@anthropic-ai/sdk`) · pdf-parse · lowdb
