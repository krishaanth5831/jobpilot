import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "./api-keys";
import { DEFAULT_CLAUDE, isSharedModel } from "./claude-models";
import { HAIKU, policyFor } from "./claude-tasks";
import { askFreeJSON, askFreeText, freeModelAvailable } from "./free-model";
import {
  callerIsOwner,
  chargeAllowance,
  readAllowance,
  sharedKeyAvailable,
} from "./claude-spend";

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

  // The owner runs on the server key unmetered: it is their own key, and an
  // allowance would be charging them for their own credits. Ahead of the
  // allowance check so no ledger is consulted or written for them at all.
  if (sharedKeyAvailable() && (await callerIsOwner())) {
    return { free: false, key: process.env.ANTHROPIC_API_KEY, metered: false };
  }

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

// Which model, and how hard it thinks — decided by the TASK, in
// lib/claude-tasks.js. There is no per-account setting: see that file for why.
//
// The two model families take DIFFERENT request shapes. Haiku 4.5 only
// supports classic extended thinking (budget_tokens; `effort` and adaptive
// both 400), while Sonnet 5 only supports adaptive thinking plus
// output_config.effort (budget_tokens 400s). Thinking bills as output tokens,
// so the Haiku budgets stay modest — and budget_tokens must be >= 1024 yet
// < max_tokens, so tiny calls (the 300-token query rewrite) skip thinking
// entirely instead of sending an impossible budget.
const HAIKU_BUDGET = { low: 0, medium: 4000, high: 8000 };

// `metered` means the server is paying. Every model the policy can pick is
// allowed on the shared key today, but the clamp stays: it is the one place
// that guarantees the allowance can never be spent on something outside
// SHARED_MODELS, whatever a future policy decides to reach for.
function modelParams(maxTokens, task, { metered = false } = {}) {
  const { model: picked, effort } = policyFor(task);
  const model = metered && !isSharedModel(picked) ? DEFAULT_CLAUDE.model : picked;

  if (model !== HAIKU) {
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
 *
 * `task` names the caller in lib/claude-tasks.js and is what picks the model
 * and effort. Leaving it out is not an error — it just gets the cheapest
 * setting, which is the right way for a mislabelled call to fail.
 */
export async function askClaudeJSON({ system, prompt, schema, maxTokens = 16000, task }) {
  const provider = await resolveProvider();
  if (provider.free) return askFreeJSON({ system, prompt, schema, maxTokens });

  const { output_config, ...params } = modelParams(maxTokens, task, provider);
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
export async function askClaudeText({ system, prompt, maxTokens = 16000, task }) {
  const provider = await resolveProvider();
  if (provider.free) return askFreeText({ system, prompt, maxTokens });

  const params = modelParams(maxTokens, task, provider);
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
