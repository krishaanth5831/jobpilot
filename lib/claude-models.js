// The Claude models and effort levels users can pick on the Settings page.
// Shared between the server (lib/claude.js, the settings API) and the
// Settings UI — keep this file free of server-only imports. Prices are per
// 1M tokens (input / output).
export const CLAUDE_MODELS = [
  {
    id: "claude-haiku-4-5",
    name: "Haiku 4.5",
    price: "$1 / $5",
    blurb: "Fast and cheap — plenty for screening and drafting. The default.",
  },
  {
    id: "claude-sonnet-5",
    name: "Sonnet 5",
    price: "$3 / $15",
    blurb: "Noticeably sharper verdicts, reviews, and writing.",
  },
  {
    id: "claude-opus-4-8",
    name: "Opus 4.8",
    price: "$5 / $25",
    blurb: "The most capable Claude — best judgment, highest cost.",
  },
];

export const EFFORT_LEVELS = [
  { id: "low", name: "Low", blurb: "Quickest and cheapest — little to no thinking" },
  { id: "medium", name: "Medium", blurb: "Balanced thinking — the default" },
  { id: "high", name: "High", blurb: "Thinks hardest — best quality, most tokens" },
];

export const DEFAULT_CLAUDE = { model: "claude-haiku-4-5", effort: "medium" };

export const isValidModel = (id) => CLAUDE_MODELS.some((m) => m.id === id);
export const isValidEffort = (id) => EFFORT_LEVELS.some((e) => e.id === id);
