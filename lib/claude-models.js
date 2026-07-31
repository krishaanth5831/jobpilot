// The Claude price table. Nobody picks from this any more — which model runs
// is decided per task in lib/claude-tasks.js — so what is left is the
// arithmetic the spend meter needs, not a menu.
//
// Prices are per 1M tokens (input / output). `rate` is the same number in a
// form lib/claude-spend.js can multiply. `shared` marks the models allowed to
// run on the server's key against an account's free allowance.
//
// OPUS IS NEVER SELECTED, and it stays in this table on purpose. The meter
// prices what it is handed, and a model it does not recognise bills as zero.
// An unreachable row costs nothing; a missing one would silently under-bill
// if anything ever reached for it.
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

/**
 * What a call falls back to when the policy asks for something the shared key
 * may not run. The only remaining use of this is that clamp in lib/claude.js.
 */
export const DEFAULT_CLAUDE = { model: "claude-haiku-4-5", effort: "medium" };
