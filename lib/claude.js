import Anthropic from "@anthropic-ai/sdk";

// Server-side only — ANTHROPIC_API_KEY must never reach the browser.
// All Claude calls go through Next.js API routes that import this module.
// Lazily constructed so `next build` (e.g. on CI) works without an API key,
// and rebuilt whenever the key changes (the settings page can swap it at
// runtime without a restart).
let client;
let clientKey;
function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ConfigError(
      "ANTHROPIC_API_KEY is not set — add it on the Settings page (or in .env.local)"
    );
  }
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key });
    clientKey = key;
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
      "Anthropic rejected your API key — it may have been revoked or rotated. Create a new key at https://platform.claude.com, update ANTHROPIC_API_KEY in .env.local, and restart the dev server"
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
    response = await getClient().messages.create({
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
    response = await getClient().messages.create({
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

export default getClient;
