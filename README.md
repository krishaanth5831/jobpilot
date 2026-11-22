# jobblast ✈️

**Your AI copilot for job applications.** Upload your resume, and jobblast finds jobs worldwide that you actually qualify for, scores your resume for ATS-friendliness, drafts tailored applications for your review, and — for the jobs you *want* but don't qualify for yet — builds a concrete roadmap to get you there.

**Use it now: [jobblast.nl](https://www.jobblast.nl)** — make an account like on any other website, no installation needed. Or [run your own copy](#run-it-yourself): the code is open source (this repo is `jobpilot`, the product is called jobblast).

> jobblast **prepares** applications for human review. It never bot-submits to job boards — you always click the final "apply" yourself.

## What it does

- **Searches job boards worldwide — a dozen sources — and screens every result.** Type a role however you phrase it; jobblast rewrites it into the title recruiters actually post, fans out across many boards, and gives each posting an honest **0–100 match score** against your resume (what matched, what's missing, why). The AI only reads facts out of the resume and the posting; the score itself is plain, deterministic arithmetic in `lib/matching/` — the same resume and posting always get the same number, and name, age, gender, university and graduation year are never read.
- **Filter the worldwide pool** by country, job type (internship / full-time / part-time / contract), and experience level — no re-searching.
- **Companies to target** — one click gives you 30+ real companies that hire in your field (region-biased but worldwide); click any to see their openings.
- **Auto-apply** — any job scoring above 35 automatically gets a cover letter drafted into your review queue (you still send it yourself).
- **Free ATS check** (`/check`) — paste a resume and get an ATS-friendliness score with no account.
- **Resume studio** — an **ATS-friendliness score** (also computed by code, in `lib/resume-health/`, from counts the AI extracts) with a pass/warn/fail checklist and a concrete fix for every issue; a **visual, field-by-field editor** with a live preview; and **13 templates** (Harvard, reverse-chronological, two-column, and more) that typeset whatever you write into a downloadable PDF.
- **Tailored resumes** — one click re-emphasizes your real material for a specific job, as a ready-to-send PDF.
- **Roadmap** — for jobs you don't qualify for yet, the missing requirements become an ordered plan: skills to learn, projects to build, time estimates, free resources.
- **What's worked** — every application you mark *hired* is distilled into lessons that sharpen future reviews and cover letters.
- **Stats** (`/stats`) — your funnel: qualification rate, response rate, and how your scores move.
- **Accounts** — email/password sign-in (plus optional Google / GitHub / Microsoft sign-in when configured); each account keeps its own data and its own API keys.

## How it works

1. **Upload** (`/upload`) — drop in your resume PDF. Claude extracts a structured profile (skills, experience, education, projects). Nothing is invented — only what's on the resume.
2. **Studio** (`/resume`) — get an ATS score + fixes, edit your resume right on the page, and pick a template.
3. **Search** (`/jobs`) — pull live postings worldwide, filter them, and let jobblast screen each against your resume. Any job scoring above 35 auto-drafts a cover letter into your queue (a job counts as "qualified" from 70 up).
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

Keys you add are your own: they are stored on your account only, spend *your* credits, and nobody else can use them. You paste each key once on the Settings page; after that jobblast only ever shows the last 4 characters.

**No key is strictly required to try it.** A new account first runs real Claude on the site's own key, up to a small one-off allowance, and after that on a free built-in model (Llama 3.3 70B on Groq) where the site offers one. Adding your own Claude key switches you to Claude for good, on your own credits. Adzuna and JSearch are optional extras — without them the keyless job boards (Greenhouse, Lever, Remotive, and the rest) still work.

#### Claude API key (recommended — powers all the AI)

1. Go to [platform.claude.com](https://platform.claude.com) and sign up (or sign in).
2. Add credits: open **Billing** and buy a small amount — **$5 is plenty to start**. Most calls run on Claude Haiku, so a typical screening or cover letter costs a fraction of a cent.
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

You don't pick a model: each task in the app has a fixed model and thinking effort, set in one place (`lib/claude-tasks.js`). **Claude Haiku 4.5** does almost everything: rewriting search queries, reading your resume into a profile, the counts behind the ATS score, cover letters. **Claude Sonnet 5**, at low effort, is used only where judgment is the product: the skill roadmap and tailored resumes. Opus is never used. The match score and the ATS score themselves are computed by code, not by a model. Calls use structured outputs (JSON schema), so results come back machine-readable, not as prose. With your own key, everything spends only your own credits.

## Run it yourself

jobblast is open source (MIT), so you can run your own copy on your computer or a server. Everything below is for that; you don't need any of it to use [jobblast.nl](https://www.jobblast.nl).

### Prerequisites

- [Node.js](https://nodejs.org) 22 (what CI uses; Next.js needs at least 20.9) and npm
- Git
- No database server: locally all data is one JSON file, `data/db.json`, created on first run
- At least one AI key to get AI features: an Anthropic (Claude) key, or a free [Groq](https://console.groq.com) key for the built-in model. Without either, the app runs but AI features say what to set.

### Steps

1. Clone and install:

   ```bash
   git clone https://github.com/krishaanth5831/jobpilot.git
   cd jobpilot
   npm install
   ```

2. Create your local settings file from the template:

   ```bash
   cp .env.example .env.local
   ```

   Then open `.env.local` and set at least:

   - `OWNER_EMAIL` — **the email you will sign up with.** This account becomes the owner of your copy (owner-only Settings panels, unmetered use of the server keys). It defaults to the maintainer's address, so without it you are not the owner of your own instance.
   - `ANTHROPIC_API_KEY` and/or `GROQ_API_KEY` — so the AI works.

   Everything else is optional (see the table below). `AUTH_SECRET` can stay blank: on first run the app generates one and writes it into `.env.local` for you.

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open **http://localhost:3000**, go to sign in, create an account with the email you put in `OWNER_EMAIL`, then upload a resume. Password-reset links are printed in the terminal unless you set up Resend.

Once you are signed in as the owner, the Settings page can also edit the server keys (Claude, Adzuna, JSearch, Groq, Resend and the sign-in providers) in `.env.local` for you. That works on your own machine or server, not on Vercel. Sign-in provider changes need a restart of `npm run dev`.

### Environment variables

All are read from `.env.local` locally, or from the host's environment settings in production. Every one is optional; the app turns the matching feature off instead of crashing. Full comments are in [`.env.example`](.env.example).

| Variable | What it's for |
| --- | --- |
| `OWNER_EMAIL`, `OWNER_NAME` | Which account owns the instance. **Set `OWNER_EMAIL` when self-hosting.** `OWNER_NAME` is an optional fallback match on the display name. |
| `ANTHROPIC_API_KEY` | Server Claude key. The owner uses it unmetered; other accounts without their own key get a small one-off allowance on it. |
| `GROQ_API_KEY`, `GROQ_BASE_URL` | Free built-in model for accounts with no Claude key (and after their allowance). `GROQ_BASE_URL` only for pointing at a compatible proxy. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY` | Adzuna job search (free tier). Used for accounts that haven't set their own. `ADZUNA_COUNTRY` defaults to `us`. |
| `RAPIDAPI_KEY` | JSearch via RapidAPI (LinkedIn / Indeed / Glassdoor results). Used for accounts that haven't set their own. |
| `AUTH_SECRET` | Signs login sessions. Generated automatically if blank (written to `.env.local` locally, stored in Redis on serverless). Make your own with `npx auth secret`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Optional "Continue with Google". Each provider turns on only when both its variables are set. |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Optional "Continue with GitHub". |
| `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Optional Microsoft (Outlook / work account) sign-in. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Storage on serverless hosts (see Deploy). `KV_REST_API_URL` / `KV_REST_API_TOKEN` work too. Not needed locally. |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_BASE_URL` | Password-reset email. Without a key the reset link is logged to the server console. Set `RESEND_FROM` to an address on a domain you verified with Resend. |
| `PAYWALL_ENABLED` | `true` or `1` turns on the Free / Pro / Unlimited usage limits. **Off by default**: everyone gets everything, usage is only counted. The ATS score is never limited. |
| `STRIPE_SECRET_KEY` | Checkout on the pricing page. Stays disabled without it, even with the paywall on. |
| `AUTO_APPLY_DISABLED` | `true` stops auto-apply drafting for everyone (spend protection). |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for share images and absolute links. Only needed on a custom domain. |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Serves the production build (after `npm run build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc -p tsconfig.json`) |
| `npm test` | Compiles the TypeScript engines into `.test-build/` and runs the match-score and resume-health tests with `node --test` |

CI runs `npm ci`, `npm run lint` and `npm run build` on every push to `dev` and every pull request into `main`.

### Deploy

The app is a normal Next.js server app; [jobblast.nl](https://www.jobblast.nl) runs on Vercel. On a serverless host the filesystem is read-only and instances don't share memory, so:

1. Import the repo into Vercel (or another Next.js host).
2. Add a Redis store: Upstash, or a Redis store from the Vercel Marketplace. It sets `UPSTASH_REDIS_REST_*` or `KV_REST_API_*`, and the whole database then lives in one Redis key instead of `data/db.json`.
3. Set `OWNER_EMAIL`, `AUTH_SECRET` and your AI key(s) in the project's environment variables. (Without Redis and without `AUTH_SECRET`, each instance makes up its own secret and logins break.)
4. Add the sign-in providers' callback URLs (`<your-url>/api/auth/callback/<provider>`) if you use them, and `NEXT_PUBLIC_SITE_URL` on a custom domain.

On your own server (a VPS, `npm run build && npm start`), no Redis is needed: data stays in `data/db.json`. Back that file up.

The `site/` folder is a separate static pitch page, deployed to GitHub Pages by `.github/workflows/pages.yml`.

### Troubleshooting

- **The owner-only Settings panels don't show up.** `OWNER_EMAIL` doesn't match the email you signed up with (it defaults to the maintainer's). Set it in `.env.local` and restart `npm run dev`.
- **"No AI model is configured".** There is no Claude key on your account or the server, and no `GROQ_API_KEY`. Add one of them (Settings page or `.env.local`).
- **Password reset email never arrives.** Without `RESEND_API_KEY` the link is printed in the terminal running the server. With Resend, `RESEND_FROM` must use a domain you verified there.
- **Logged out at random on Vercel.** Set `AUTH_SECRET` or add Redis; otherwise each serverless instance makes up its own secret.
- **No jobs from Adzuna or JSearch.** Those need keys; the keyless boards still work without them. `ADZUNA_COUNTRY` (default `us`) picks the Adzuna country when a search names none.

## Tech

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Auth.js (next-auth v5) · Claude API (`@anthropic-ai/sdk`; Haiku 4.5 + Sonnet 5) · Groq (free fallback model) · pdf-parse · pdfkit · lowdb (JSON file) / Upstash Redis · Resend · Stripe (optional) · Motion. App code is JavaScript; the scoring engines in `lib/matching/` and `lib/resume-health/` are TypeScript.

## Project layout

```
app/                 pages (upload, resume, jobs, queue, roadmap, stats, check, pricing, settings, signin, reset)
  api/               API routes: auth, register, resume, jobs, match, applications, roadmap, settings, ...
components/          shared UI; motion-primitives/ holds the only coloured (animated) pieces
lib/
  matching/          deterministic match score (TypeScript, tested)
  resume-health/     deterministic ATS score (TypeScript, tested)
  job-sources/       one file per job board, plus dedupe, relevance and location
  claude.js          every Claude call; picks own key → shared allowance → free model
  claude-tasks.js    which model and effort each task uses
  free-model.js      the Groq fallback
  auth.js            Auth.js setup (email/password + optional OAuth)
  db.js, redis.js    storage: data/db.json locally, one Redis key on serverless
  tiers.js, entitlements.js   plans and the (off-by-default) paywall
data/                local database file (db.json, git-ignored)
site/                static pitch page for GitHub Pages
scripts/             gen-backgrounds.js (regenerates public/backgrounds)
```

## Contributing

Issues and pull requests are welcome.

- Branch from `dev` and open your pull request against `dev`; `main` is protected and only changes through pull requests with green CI.
- Run `npm run lint` and `npm run build` before opening one (plus `npm test` if you touched `lib/matching/` or `lib/resume-health/`).
- Keep the UI black and white: no Tailwind colour classes outside `neutral-*` / `black` / `white` in static markup. Colour is reserved for animation (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- Never commit `.env.local` or `data/db.json`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and [AGENTS.md](AGENTS.md) for notes aimed at coding agents.

## License

[MIT](LICENSE)
