# jobblast ✈️

**Your AI copilot for job applications.** Upload your resume, and jobblast finds jobs worldwide that you actually qualify for, scores your resume for ATS-friendliness, drafts tailored applications for your review, and — for the jobs you *want* but don't qualify for yet — builds a concrete roadmap to get you there.

**Use it now: [jobblast.nl](https://www.jobblast.nl)** — make an account like on any other website, no installation needed.

> jobblast **prepares** applications for human review. It never bot-submits to job boards — you always click the final "apply" yourself.

## What it does

- **Searches job boards worldwide — a dozen sources — and screens every result.** Type a role however you phrase it; jobblast rewrites it into the title recruiters actually post, fans out across many boards, and gives each posting an honest **0–100 fit score** against your resume (what matched, what's missing, why).
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
3. **Search** (`/jobs`) — pull live postings worldwide, filter them, and let jobblast screen each against your resume. Qualifying jobs (score > 35) auto-draft into your queue.
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

## Getting started

There's nothing to install — jobblast runs in your browser:

1. Go to **[jobblast.nl](https://www.jobblast.nl)**.
2. **Create an account** — email and password, like any other website.
3. Add your API keys on the **Settings** page (step-by-step guides below).
4. **Upload your resume** and start searching.

### Getting your API keys

jobblast works on a bring-your-own-keys model: your account uses *your* keys and *your* credits, so nobody else can spend them and you're never billed for anyone else. You paste each key once on the Settings page; after that jobblast only ever shows the last 4 characters.

**Only the Claude key is required.** The Adzuna and JSearch keys are optional extras — without them the keyless job boards (Greenhouse, Lever, Remotive, and the rest) still work.

#### Claude API key (required — powers all the AI)

1. Go to [platform.claude.com](https://platform.claude.com) and sign up (or sign in).
2. Add credits: open **Billing** and buy a small amount — **$5 is plenty to start**. jobblast uses Claude Haiku, the cheapest model, so a typical screening or cover letter costs a fraction of a cent.
3. Open **API keys** → **Create key**, name it anything (e.g. `jobblast`), and click create.
4. **Copy the key immediately** (it starts with `sk-ant-` and is only shown once).
5. In jobblast, go to **Settings → Claude → API key**, paste it, and hit **Save changes**.

#### Adzuna keys (optional, free — adds ~19 countries of job boards)

1. Go to [developer.adzuna.com](https://developer.adzuna.com) and click **Register** — the free plan is fine.
2. Confirm your email and log in to the developer dashboard.
3. Your **Application ID** and **Application Key** are shown on the **API access details** page.
4. In jobblast, paste both under **Settings → Adzuna** and hit **Save changes**.

#### JSearch key (optional, free — adds LinkedIn / Indeed / Glassdoor results)

1. Go to [rapidapi.com](https://rapidapi.com) and create a free account.
2. Search the site for **“JSearch”** and open the JSearch API page.
3. On its **Pricing** tab, subscribe to the free **Basic** plan.
4. Your key is shown on the API page as the **`X-RapidAPI-Key`** value (also under your app's **Authorization** settings).
5. In jobblast, paste it under **Settings → JSearch (RapidAPI)** and hit **Save changes**.

### Cost

By default Claude calls run on **Claude Haiku 4.5** — the cheapest Claude model — using structured outputs (JSON schema) so verdicts and roadmaps are machine-readable, not prose. Screening and cover-letter drafting are short, schema-constrained calls; Haiku keeps spend low. To trade cost for quality, pick **Sonnet 5** or **Opus 4.8** — and how much thinking effort to use — in the **AI model** section of the Settings page. The choice is saved to your account and only spends your own credits.

## Tech

Next.js (App Router) · React · Tailwind CSS v4 · Auth.js · Claude API (`@anthropic-ai/sdk`, Haiku 4.5) · pdfkit · pdf-parse · lowdb

## Workflow

Work happens on the `dev` branch; `main` is protected and only changes via pull requests with passing CI. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full flow.
