import Anthropic from "@anthropic-ai/sdk";
import { getApiKey, getModelPrefs } from "./api-keys";
import {
  DEFAULT_CLAUDE,
  isSharedModel,
  isValidEffort,
  isValidModel,
} from "./claude-models";
import { askFreeJSON, askFreeText, freeModelAvailable } from "./free-model";
import { chargeAllowance, readAllowance, sharedKeyAvailable } from "./claude-spend";

// Server-side only — ANTHROPIC_API_KEY must never reach the browser.
// All Claude calls go through Next.js API routes that import this module.
// Clients are cached per key value — lazily built (so `next build` works
// without a key) and swapped when the key changes.
const clients = new Map();

// Who serves this request, in order:
//
//   1. The account's OWN Claude key. Unmetered — they are spending their own
//      credits, and any model they picked is fair game.
//   2. The server's shared key, while the account still has allowance left
//      (lib/claude-spend.js). Metered, and clamped to the cheaper models.
//   3. The free built-in model (lib/free-model.js).
//   4. Nothing configured — a ConfigError saying what to set.
//
// The allowance is checked BEFORE the call, not after: charging is a
// read-modify-write that can lose a concurrent increment, so the pre-check is
// what actually bounds the spend.
async function resolveProvider() {
  const key = await getApiKey("ANTHROPIC_API_KEY");
  if (key) return { free: false, key, metered: false };

  if (sharedKeyAvailable()) {
    const allowance = await readAllowance();
    if (!allowance.exhausted) {
      return { free: false, key: process.env.ANTHROPIC_API_KEY, metered: true };
    }
  }

  if (freeModelAvailable()) return { free: true };
  throw new ConfigError(
    "No AI model is configured — add your Claude API key on the Settings page (or the owner can set a free Groq key there to enable the built-in model)"
  );
}

function getClient(key) {
  let client = clients.get(key);
  if (!client) {
    client = new Anthropic({ apiKey: key });
    clients.set(key, client);
  }
  return client;
}

// Configuration problems are safe (and useful) to show in the UI,
// unlike arbitrary upstream errors.
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

// Which model, and how hard it thinks — both picked per account on the
// Settings page (lib/claude-models.js lists the choices); unset or invalid
// preferences fall back to Haiku 4.5 at medium effort, the cheapest setup.
// The two model families take DIFFERENT request shapes: Haiku 4.5 only
// supports classic extended thinking (budget_tokens; `effort` and adaptive
// both 400), while Sonnet 5 / Opus 4.8 only support adaptive thinking plus
// output_config.effort (budget_tokens 400s). Thinking bills as output
// tokens, so the Haiku budgets stay modest — and budget_tokens must be
// >= 1024 yet < max_tokens, so tiny calls (e.g. the 300-token query rewrite)
// skip thinking entirely instead of sending an impossible budget.
const HAIKU_BUDGET = { low: 0, medium: 4000, high: 8000 };

// `metered` means the server is paying. Opus is excluded from the shared key
// (lib/claude-models.js), so an account running on the allowance falls back to
// the default model rather than being refused — picking Opus is an upgrade you
// unlock by bringing your own key, not an error.
async function modelParams(maxTokens, { metered = false } = {}) {
  const prefs = await getModelPrefs();
  let model = isValidModel(prefs.model) ? prefs.model : DEFAULT_CLAUDE.model;
  if (metered && !isSharedModel(model)) model = DEFAULT_CLAUDE.model;
  const effort = isValidEffort(prefs.effort) ? prefs.effort : DEFAULT_CLAUDE.effort;

  if (model !== "claude-haiku-4-5") {
    return { model, thinking: { type: "adaptive" }, output_config: { effort } };
  }
  const budget = Math.min(HAIKU_BUDGET[effort], maxTokens - 1024);
  if (budget < 1024) return { model };
  return { model, thinking: { type: "enabled", budget_tokens: budget } };
}

// A rejected key is a configuration problem someone must fix, not a bug —
// surface it as such instead of a generic "X failed". Which someone depends on
// whose key it was: telling a user to rotate a key they never set would send
// them looking for a Settings field that is empty.
function toActionableError(err, metered) {
  if (err?.status === 401) {
    return new ConfigError(
      metered
        ? "The server's shared Claude key was rejected — the owner needs to update it. You can add your own key on the Settings page to keep working in the meantime."
        : "Anthropic rejected your API key — it may have been revoked or rotated. Create a new key at https://platform.claude.com and update it on the Settings page"
    );
  }
  return err;
}

/**
 * Ask Claude a question and get back validated JSON matching `schema`.
 * Used for profile extraction, match verdicts, and roadmaps so the
 * responses are machine-readable, not prose.
 */
export async function askClaudeJSON({ system, prompt, schema, maxTokens = 16000 }) {
  const provider = await resolveProvider();
  if (provider.free) return askFreeJSON({ system, prompt, schema, maxTokens });

  const { output_config, ...params } = await modelParams(maxTokens, provider);
  let response;
  try {
    const client = getClient(provider.key);
    response = await client.messages.create({
      ...params,
      max_tokens: maxTokens,
      system,
      output_config: { ...output_config, format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw toActionableError(err, provider.metered);
  }
  if (provider.metered) await chargeAllowance(params.model, response.usage);

  const text = response.content.find((block) => block.type === "text")?.text;
  return JSON.parse(text);
}

/**
 * Ask Claude for free-form text (cover letters, application answers).
 */
export async function askClaudeText({ system, prompt, maxTokens = 16000 }) {
  const provider = await resolveProvider();
  if (provider.free) return askFreeText({ system, prompt, maxTokens });

  const params = await modelParams(maxTokens, provider);
  let response;
  try {
    const client = getClient(provider.key);
    response = await client.messages.create({
      ...params,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw toActionableError(err, provider.metered);
  }
  if (provider.metered) await chargeAllowance(params.model, response.usage);

  return response.content.find((block) => block.type === "text")?.text ?? "";
}
