# Contributing / Workflow

This repo uses a simple two-branch workflow. `main` is protected — **all changes land through pull requests** that pass CI.

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Stable. Protected: no direct pushes, no force-pushes, no deletion. Changes arrive only via PRs with green CI. |
| `dev` | Working branch. Day-to-day commits go here (or on feature branches that merge into here). |

## Day-to-day flow

```bash
# 1. Always start from an up-to-date dev
git checkout dev
git pull

# 2. Work and commit as usual
git add -A
git commit -m "Add job picker to roadmap page"
git push

# 3. When a feature is ready, open a PR from dev into main
gh pr create --base main --head dev --title "Add roadmap job picker" --fill

# 4. Wait for CI to pass, then merge (from GitHub UI or CLI)
gh pr checks --watch
gh pr merge --merge

# 5. Sync your local branches after the merge
git checkout main && git pull
git checkout dev && git merge main && git push
```

For bigger features, branch off `dev` (`git checkout -b feature/xyz dev`), merge back into `dev` when done, and PR `dev → main` as above.

## CI

Every push to `dev` and every PR into `main` runs [`ci.yml`](.github/workflows/ci.yml):

1. `npm ci` — clean install
2. `npm run lint` — ESLint
3. `npm run build` — production Next.js build

The `lint-and-build` job is a **required status check** on `main` — a PR cannot merge until it's green. If CI fails, fix it on `dev` and push again; the PR updates automatically.

## Rules enforced on `main` (GitHub ruleset)

- Pull request required for every change (0 approvals required — solo project)
- `lint-and-build` status check must pass
- No force pushes, no branch deletion

## Design rule: black & white, color only in motion

The UI is strictly monochrome. **No Tailwind color utilities outside `neutral-*` / `black` / `white` in static markup.** The accent gradient is defined once (`--accent-gradient` in `app/globals.css`) and may only be referenced by animation components (`components/motion-primitives/`, `components/ai-loading.js`) and the hero scene — color means "the AI is doing something."

Reviewable check: grep your diff for Tailwind color classes (`red-`, `green-`, `blue-`, `indigo-`, `cyan-`, `amber-`, …). Any hit outside `components/motion-primitives/` or the hero scene is a bug.

## Commit style

Short imperative subject line ("Add X", "Fix Y"), body only when the *why* isn't obvious. Never commit secrets — `.env.local` and `data/db.json` are gitignored for a reason.
