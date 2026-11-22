<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# jobpilot — agent guide

AI job-application copilot (the product is called **jobblast**; the repo/package is `jobpilot` — both names are correct, don't "fix" either). Next.js 16 App Router, React 19, JavaScript app code with TypeScript in `lib/matching/**` and `lib/resume-health/**`. npm + `package-lock.json`. Node 22 (CI).

The block above is written and re-added by `next dev`. Don't delete it; commit it with your work.

## Commands (the gate)

```bash
npm ci            # clean install (CI uses this)
npm run dev       # next dev
npm run lint      # eslint            <- CI gate
npm run build     # next build        <- CI gate
npm run typecheck # tsc -p tsconfig.json
npm run test      # compiles to .test-build/, then node --test on matching + resume-health
```

`lint-and-build` is the required status check on `main`. There is no format script — don't invent one, and don't reformat untouched lines.

## Non-negotiable repo rules

- **Branching:** `main` is protected. Work on `dev` or a feature branch off `dev`; land via PR `dev -> main` with green CI. Never push to `main`.
- **Monochrome UI:** no Tailwind color utilities outside `neutral-*`/`black`/`white` in static markup. The accent gradient (`--accent-gradient` in `app/globals.css`) is only for `components/motion-primitives/`, `components/ai-loading.js`, and the hero scene — color means "the AI is doing something". Before you finish: grep your diff for `red-|green-|blue-|indigo-|cyan-|amber-`; any hit outside those paths is a bug.
- **Commits:** short imperative subject ("Add X", "Fix Y"), body only when the *why* isn't obvious.
- **Secrets:** never commit `.env.local` or `data/db.json`. Keys are documented by name in `.env.example` (Anthropic, Adzuna, RapidAPI, Auth.js + OAuth providers, Upstash, Groq, Resend, Stripe). AI/search/billing providers are individually optional — code must degrade, not crash, when one is absent.

## Map

| Path | What it is | Safe to parallelize? |
|---|---|---|
| `app/` | routes, pages, API handlers, global shell | Risky — shared layout/globals |
| `components/` | reusable UI | Yes, by component area |
| `lib/` | domain logic: matching, resume-health, parsers, integrations | Yes, by subsystem |
| `site/` | static landing/share page, deployed by `pages.yml` | Yes — fully separate surface |
| `scripts/` | asset generation (`gen-backgrounds.js`) | Yes |
| `public/` | images, screenshots (`public/photos/README.md` first) | Yes |
| `data/` | runtime lowdb file | No — shared state |

Read before editing: `CONTRIBUTING.md`, the route/component you're changing, and the `lib/` modules it imports.

Do not hand-edit / do not read into context: `package-lock.json`, `.next/`, `out/`, `.test-build/`, `next-env.d.ts`, `data/db.json`, `public/backgrounds/*` (regenerate via `scripts/gen-backgrounds.js`).

## Gotchas

- Storage is `data/db.json` locally and a single Redis key on serverless — don't assume a real DB or add per-row queries.
- Tests compile to `.test-build/` first because the target Node lacks native type stripping; run `npm run test`, not `node --test` directly.
- `next.config.mjs` externalizes `pdf-parse`/`pdfkit` and traces native canvas + pdfjs worker + pdfkit fonts. Touching PDF or resume parsing means checking that config.
- `AUTH_SECRET` can be generated on first run when blank.

---

# Working with agents in this repo

## Token discipline

1. `rg` for a symbol, then read only the matching range (`sed -n 'A,Bp'`). Don't open a file to discover what's in it.
2. Read a whole file only if it's <~200 lines or you're rewriting most of it.
3. Never read the do-not-read list above (lockfile, build output, `node_modules`, images, `.env*`).
4. Never re-read a file you already read this session.
5. Verify narrowest-first: the one test file, then `npm run lint`; run `npm run build` once, at the end.
6. Pipe noisy output (`npm run build 2>&1 | tail -30`). Never paste a full build log into context — paste the failing lines.
7. Close out a unit of work with a <=15-line summary of decisions + file paths, then drop the exploration transcript.

## Parallel execution: orchestrator + workers

Fan out when a task has >=2 units touching disjoint files (e.g. "new matching heuristic" + "settings UI" + "landing page copy"). Otherwise stay single-agent — `schema -> API -> UI` is sequential, three unrelated surfaces is parallel.

The orchestrator writes no feature code. It:

1. Splits work along the boundaries in the map above.
2. **Freezes contracts first, itself:** shared types in `lib/matching/**`, API request/response shapes, prop signatures. Commit them to the integration branch before any worker starts. Workers consume contracts; a worker that needs one changed stops and reports.
3. Owns all dependency changes (`npm install`, lockfile) — serially, before fan-out. Workers never run install/upgrade against the lockfile.
4. Gives each worker its own worktree, port and brief (below). 2-4 concurrent workers; past that, review is the bottleneck.
5. Reviews each diff, merges in dependency order, then runs `npm run lint && npm run build && npm run test` once and opens the PR.

Worker brief (keep under ~20 lines — the worker reads this file, don't re-explain the repo):

```
Goal:            <one sentence, observable outcome>
Worktree:        ../jobpilot-<slug>   Branch: agent/<slug>   Dev port: 3001+
Files you own:   <explicit paths/globs — edit ONLY these>
Do not touch:    package-lock.json, frozen contracts, other workers' paths
Contracts:       <paths, read-only>
Done when:       <exact commands that must pass>
Report:          diff summary, commands run, assumptions made
Stop and ask if: a contract must change, or work spills outside your files
```

Anti-patterns: two workers in one file; a worker running `npm install`; workers rebasing on each other mid-flight; a worker touching `app/globals.css` or the auth config while others build on it.

## One worktree per agent

Agents must never share a working tree — concurrent edits, `git switch` and installs clobber each other.

```bash
# orchestrator, once
git fetch origin && git switch -c integration/<task> origin/dev && git push -u origin integration/<task>

# per worker
git worktree add ../jobpilot-<slug> -b agent/<slug> integration/<task>
cd ../jobpilot-<slug> && npm ci        # node_modules is NOT shared across worktrees
npm run dev -- -p 3002                 # unique port per worker; .next is per-worktree already
```

- One worktree per worker, `../jobpilot-<slug>`, branch `agent/<slug>`; the worker stays inside it.
- Unique dev port per worker — two `next dev` on 3000 collide silently.
- Integrate by merging `agent/*` into `integration/<task>`, then one PR `integration/<task> -> dev` (and `dev -> main` per `CONTRIBUTING.md`). Workers never push to `dev` or `main` and never merge each other.
- Clean up: `git worktree remove ../jobpilot-<slug>` after merge, then `git worktree prune`.

## Done means

`npm run lint`, `npm run build` and (if you touched `lib/matching/**` or `lib/resume-health/**`) `npm run test` pass; the diff has nothing unrelated; the monochrome grep is clean; docs affected by a user-visible change are updated.
