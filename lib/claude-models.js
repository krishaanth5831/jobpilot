// The Claude models and effort levels users can pick on the Settings page.
// Shared between the server (lib/claude.js, the settings API) and the
// Settings UI — keep this file free of server-only imports. Prices are per
// 1M tokens (input / output).
//
// `rate` is the same number as `price`, in a form the spend meter can do
// arithmetic with (lib/claude-spend.js). `shared` marks the models an account
// may run on the server's key against its free allowance — Opus is excluded
// because a single high-effort Opus call can cost 20x a Haiku one, which
// would burn the whole allowance in a handful of requests.
export const CLAUDE_MODELS = [
  {
    id: "claude-haiku-4-5",
    name: "Haiku 4.5",
    price: "$1 / $5",
    rate: { input: 1, output: 5 },
    shared: true,
    blurb: "Fast and cheap — plenty for screening and drafting. The default.",
  },
  {
    id: "claude-sonnet-5",
    name: "Sonnet 5",
    price: "$3 / $15",
    // Anthropic is running Sonnet 5 at an introductory $2 / $10 through
    // 2026-08-31. The meter deliberately bills the standard rate: counting
    // high spends the allowance slightly early, counting low spends the
    // owner's real money. Drop these to 2/10 only if the meter needs to
    // track the invoice exactly during the intro window.
    rate: { input: 3, output: 15 },
    shared: true,
    blurb: "Noticeably sharper verdicts, reviews, and writing.",
  },
  {
    id: "claude-opus-4-8",
    name: "Opus 4.8",
    price: "$5 / $25",
    rate: { input: 5, output: 25 },
    shared: false,
    blurb: "The most capable Claude — best judgment, highest cost.",
  },
];

/** Models an account can run on the server's shared key. */
export const SHARED_MODELS = CLAUDE_MODELS.filter((m) => m.shared);
export const isSharedModel = (id) => SHARED_MODELS.some((m) => m.id === id);
export const modelRate = (id) =>
  CLAUDE_MODELS.find((m) => m.id === id)?.rate ?? null;

export const EFFORT_LEVELS = [
  { id: "low", name: "Low", blurb: "Quickest and cheapest — little to no thinking" },
  { id: "medium", name: "Medium", blurb: "Balanced thinking — the default" },
  { id: "high", name: "High", blurb: "Thinks hardest — best quality, most tokens" },
];

export const DEFAULT_CLAUDE = { model: "claude-haiku-4-5", effort: "medium" };

export const isValidModel = (id) => CLAUDE_MODELS.some((m) => m.id === id);
export const isValidEffort = (id) => EFFORT_LEVELS.some((e) => e.id === id);
