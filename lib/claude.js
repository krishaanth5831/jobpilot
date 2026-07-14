import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "./api-keys";

// Server-side only — ANTHROPIC_API_KEY must never reach the browser.
// All Claude calls go through Next.js API routes that import this module.
// The key belongs to the signed-in user (lib/api-keys.js), so each account
// uses its own credits. Clients are cached per key value — lazily built (so
// `next build` works without a key) and swapped when the key changes.
const clients = new Map();
async function getClient() {
  const key = await getApiKey("ANTHROPIC_API_KEY");
  if (!key) {
    throw new ConfigError(
      "ANTHROPIC_API_KEY is not set — add your Claude API key on the Settings page"
    );
  }
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

// Sonnet at low effort: these are short, schema-constrained extraction and
// matching calls, so the cheaper model keeps API spend down. Raise effort
// (or switch back to claude-opus-4-8) if verdict quality degrades.
export const MODEL = "claude-sonnet-5";
const EFFORT = "low";

// A rejected key is a configuration problem the user must fix, not a bug —
// surface it as such instead of a generic "X failed".
function toActionableError(err) {
  if (err?.status === 401) {
    return new ConfigError(
      "Anthropic rejected your API key — it may have been revoked or rotated. Create a new key at https://platform.claude.com and update it on the Settings page"
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
  let response;
  try {
    const client = await getClient();
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system,
      output_config: {
        effort: EFFORT,
        format: { type: "json_schema", schema },
      },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw toActionableError(err);
  }

  const text = response.content.find((block) => block.type === "text")?.text;
  return JSON.parse(text);
}

/**
 * Ask Claude for free-form text (cover letters, application answers).
 */
export async function askClaudeText({ system, prompt, maxTokens = 16000 }) {
  let response;
  try {
    const client = await getClient();
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system,
      output_config: { effort: EFFORT },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw toActionableError(err);
  }

  return response.content.find((block) => block.type === "text")?.text ?? "";
}
