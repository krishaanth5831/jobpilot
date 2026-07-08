# jobpilot — Website Build Plan

The full plan to take jobpilot from working scaffold to a beautiful, animated product. Built around one hard design rule:

> **Everything is black & white. Color exists only inside animations and 3D renders.**

That constraint is the identity of the site: a stark monochrome interface where the only living color comes from motion — a glow that follows the cursor, a shimmer during an AI call, the 3D hero render. Color = "the AI is doing something."

---

## 1. Design system

### Palette

| Token | Light mode | Dark mode | Use |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#000000` | page background |
| `--foreground` | `#000000` | `#ffffff` | text, icons |
| `--muted` | `#f5f5f5` (neutral-100) | `#0a0a0a` (neutral-950) | cards, wells |
| `--border` | `#e5e5e5` (neutral-200) | `#262626` (neutral-800) | hairlines |
| `--subtle` | `#737373` (neutral-500) | `#a3a3a3` (neutral-400) | secondary text |
| **Accent (motion only)** | `#6366f1 → #22d3ee` gradient | same | ONLY inside glow/shimmer/border-trail animations and the Spline render — never on static UI |

Rules of enforcement:
- No Tailwind color classes outside `neutral-*`/`black`/`white` in static markup. The accent gradient lives in exactly one place (`app/globals.css` as `--accent-gradient`) and is referenced only by animation components.
- Grayscale Haikei SVG backgrounds count as "static" → black/white/gray only.
- The Spline 3D scene and animation internals are the exception and *should* use the accent colors — that's the payoff of the constraint.

### Typography & texture
- **Geist Sans** (already installed) for everything; **Geist Mono** for scores, job IDs, and data (`match.score`, salaries).
- Big, tight display type on the landing page (`tracking-tight`, weights 600–800), airy `text-neutral-500` body copy.
- Depth without color: hairline borders, generous whitespace, subtle grain/dot-grid Haikei textures, and `progressive-blur` — never drop shadows in color.

### Motion principles
- Entrances animate **once** on scroll into view (`in-view`), fast (200–400ms), ease-out. No looping decoration except the hero.
- Hover states are physical: `tilt`, `magnetic`, `border-trail` — not color swaps.
- Every AI wait state (Claude call in flight) gets a shimmer/glow treatment so latency feels intentional.
- Respect `prefers-reduced-motion`: all motion-primitives usage wrapped so animations collapse to simple fades.

---

## 2. Tool stack

| Tool | What for | How it comes in |
| --- | --- | --- |
| **[motion-primitives](https://motion-primitives.com)** | The UI kit — 33 copy-in animated components on top of `motion` + Tailwind | `npx motion-primitives@latest add <name>` → lands in `components/motion-primitives/`, fully editable |
| **[motion](https://motion.dev)** (installed by the kit) | Page transitions, layout animations, custom variants beyond the kit | npm dep |
| **[Haikei](https://haikei.app)** | Grayscale SVG backgrounds — layered waves (section dividers), blob scatter (empty states), low-poly grid (hero backdrop), circle scatter (roadmap) | Free, no signup. Export SVG in grayscale → `public/backgrounds/`. Keep the Haikei settings noted in a comment in each SVG for regeneration |
| **[Spline](https://spline.design)** (`@splinetool/react-spline`) | The 3D hero render — e.g. a slowly orbiting paper plane / abstract "pilot" object. Already used in Tracko, so the workflow is familiar. This is where the accent color lives | npm dep, lazy-loaded, static grayscale poster image as fallback/loading state |
| **[Lenis](https://lenis.darkroom.engineering)** | Buttery smooth scrolling to make the scroll-triggered animations feel premium | `lenis` npm dep, mounted in a client provider |
| **[lucide-react](https://lucide.dev)** | Consistent 1.5px-stroke icons — reads perfectly in monochrome | npm dep |
| **[sonner](https://sonner.emilkowal.ski)** | Toasts ("Application drafted", errors) — styled b&w | npm dep |
| **next-themes** | Light/dark toggle — trivial with a pure b&w palette, doubles the design for free | npm dep |
| **react-dropzone** | Drag-and-drop resume upload | npm dep |
| **Vercel** | Deployment + preview URLs on every PR | GitHub integration |

### motion-primitives components we'll use (from the full catalog)

`text-effect`, `text-shimmer`, `text-loop`, `text-morph`, `text-scramble`, `animated-group`, `in-view`, `spotlight`, `tilt`, `magnetic`, `border-trail`, `glow-effect`, `animated-number`, `sliding-number`, `morphing-dialog`, `dialog`, `disclosure`, `accordion`, `dock`, `scroll-progress`, `infinite-slider`, `transition-panel`, `progressive-blur`, `animated-background`, `cursor`.

---

## 3. Shared shell (built first, used everywhere)

- **`components/site-nav.js`** — floating bottom **`dock`** (macOS style) with lucide icons for Home / Upload / Jobs / Queue / Roadmap + theme toggle. On desktop it can sit top-center; `magnetic` on each item.
- **`components/page-shell.js`** — consistent max-width, `scroll-progress` hairline bar at the top, Lenis provider, page enter transition (`animated-group` fade+rise).
- **`components/ai-loading.js`** — the reusable "Claude is thinking" state: `text-shimmer` label + `border-trail` (accent gradient) around the affected card. Used by upload, match, draft, and roadmap calls.
- **`components/empty-state.js`** — grayscale Haikei blob-scatter background + one-liner + CTA.
- **`app/globals.css`** — tokens above, dot-grid utility, `--accent-gradient`, reduced-motion overrides.

---

## 4. Page-by-page plan

### 4.1 Landing (`/`) — the showpiece
1. **Hero**: full-viewport. Haikei low-poly grid SVG at ~4% opacity as backdrop. Headline set with **`text-effect`** (per-word blur-in): *"Apply where you qualify."* Subline with **`text-loop`** cycling: "internships / new-grad roles / your dream job". Right side (desktop) / background (mobile): the **Spline 3D scene** — the only colored, moving object on the page.
2. **How-it-works**: four **`spotlight`** cards (Upload → Match → Apply → Roadmap), cursor-following spotlight in white-on-black; **`in-view`** staggered entrance; **`tilt`** on hover.
3. **Live-demo strip**: an **`image-comparison`** slider showing "your resume" vs "your extracted profile", or a fake match card with **`animated-number`** counting to a score.
4. **Sources marquee**: **`infinite-slider`** of job-board names (Adzuna, + future sources) in grayscale.
5. **Footer CTA**: giant `text-effect` headline, **`magnetic`** "Upload your resume" button, Haikei layered-waves divider (grayscale) above it.

### 4.2 Upload (`/upload`)
- `react-dropzone` zone: dashed hairline border; on drag-over a **`glow-effect`** ring (accent — it's an animation).
- While Claude extracts: the `ai-loading` treatment + **`text-shimmer-wave`** on "Reading your resume…".
- Result: replace the raw JSON dump with profile cards (Skills as pills, Experience timeline, Projects grid) entering via **`animated-group`** stagger; **`disclosure`** per section; count of skills with **`sliding-number`**.
- Re-upload flow + sonner toast on success.

### 4.3 Jobs (`/jobs`)
- Search bar as a **`toolbar-expandable`** (role expands to reveal location + filters).
- Skeleton cards with `text-shimmer` while fetching; **`border-trail`** around each card while its match call runs.
- Job card: `tilt` (subtle, 2–3°), match score as **`animated-number`** 0→score, verdict badge in pure b&w (filled = qualified, outline = not yet). Missing requirements in an **`accordion`**.
- Qualified → `magnetic` "Draft application" button. Not qualified → "Build roadmap" link that pre-fills `/roadmap` (replaces today's paste-a-job-id UX).
- Filter/sort row using **`animated-background`** (the shared highlight that slides between selected filter pills).

### 4.4 Queue (`/queue`)
- Applications listed as compact rows; clicking one opens a **`morphing-dialog`** that grows from the card into the full cover-letter view — the marquee interaction of this page.
- Inside the dialog: editable textarea, copy button (sonner confirmation), link out to `job.url`, "Mark as submitted".
- Status transitions animate with **`transition-panel`** (pending → submitted). Submitted rows collapse to a ✓ state.
- Empty state: Haikei blob scatter + "Nothing to review yet".

### 4.5 Roadmap (`/roadmap`)
- Job picker (unqualified jobs from the store) replaces the manual ID input — cards in a horizontal **`carousel`**.
- Generating: `text-scramble` on "Analyzing the gap…" + ai-loading treatment.
- The plan renders as a vertical timeline: hairline spine, steps enter one-by-one with **`in-view`**; category chip (skill/project/cert) in Geist Mono; estimated time as `sliding-number` weeks.
- Haikei circle-scatter (grayscale) faintly behind the timeline; completed-step checkboxes persisted to lowdb (`roadmap.steps[i].done`).

---

## 5. Build phases (each = one PR from `dev` → `main`)

| Phase | PR | Contents | Done when |
| --- | --- | --- | --- |
| 0 | Design foundation | Tokens/globals.css, next-themes, Lenis, dock nav, page-shell, scroll-progress, ai-loading, empty-state, fonts, lucide, sonner | Every page renders inside the new shell in both themes |
| 1 | Landing page | Hero (Spline scene + text-effect/text-loop), spotlight cards, infinite-slider, Haikei backgrounds exported | Lighthouse ≥ 90 perf/a11y on `/`, hero fallback works with JS-heavy scene lazy-loaded |
| 2 | Upload experience | Dropzone, profile cards UI, shimmer states, sonner | Upload a real resume PDF end-to-end, profile renders as cards |
| 3 | Jobs experience | Expandable search, match cards, animated scores, accordion, filters | Search → match → qualified/not-yet flows verified against Adzuna |
| 4 | Queue experience | Morphing-dialog review, edit/copy/submit states | Draft → review → mark submitted round-trip |
| 5 | Roadmap experience | Job picker carousel, timeline, step completion | Roadmap for a real unqualified job renders + persists checkmarks |
| 6 | Polish & ship | Page transitions, custom `cursor` (landing only), reduced-motion audit, mobile pass, meta/OG images (Haikei-based), deploy to Vercel | Deployed URL, mobile + reduced-motion verified |

Ordering rationale: the shell (0) is a dependency of everything; the landing (1) locks the visual language the app pages then inherit; app pages (2–5) follow the user journey in order; polish last so it applies to finished surfaces.

### Haikei asset checklist (produced during phases 1–5, all grayscale)
- `hero-lowpoly.svg` — low-poly grid, near-white/near-black variants
- `divider-waves.svg` — layered waves section divider (landing)
- `empty-blobs.svg` — blob scatter (queue/jobs empty states)
- `roadmap-circles.svg` — circle scatter (roadmap backdrop)
- `og-image.png` — 1200×630 social card base

---

## 6. Guardrails & verification

- **CI stays green**: every phase PR passes `lint-and-build` (already enforced on `main`).
- **The b&w rule is testable**: grep the diff for Tailwind color utilities outside `neutral/black/white` — anything else must live inside `components/motion-primitives/` or the Spline scene. Add this note to CONTRIBUTING.md in Phase 0.
- **Performance**: Spline scene lazy-loaded (`next/dynamic`, no SSR) with a static poster; Haikei SVGs inlined or served from `public/` (they're tiny); animations use transforms/opacity only.
- **Accessibility**: `prefers-reduced-motion` fallbacks, focus-visible rings (white/black inverse), semantic headings, dialog focus traps (morphing-dialog), color-independent status (qualified = filled badge + label, never color alone).
- **Manual test script per phase**: run `npm run dev`, walk the affected flow with a real resume + live Adzuna/Claude keys, check both themes, check mobile width (390px), check reduced-motion.

---

## 7. Out of scope (tracked in README roadmap)

Multi-user auth, real database, more job sources, Greenhouse/Lever one-click submit — none of these block the visual build and all slot in behind the existing API routes.
