import Anthropic from "@anthropic-ai/sdk";

// Server-side only — ANTHROPIC_API_KEY must never reach the browser.
// All Claude calls go through Next.js API routes that import this module.
// Lazily constructed so `next build` (e.g. on CI) works without an API key.
let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ConfigError(
        "ANTHROPIC_API_KEY is not set — copy .env.example to .env.local and add your key from https://platform.claude.com, then restart the dev server"
      );
    }
    client = new Anthropic();
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

export const MODEL = "claude-opus-4-8";

/**
 * Ask Claude a question and get back validated JSON matching `schema`.
 * Used for profile extraction, match verdicts, and roadmaps so the
 * responses are machine-readable, not prose.
 */
export async function askClaudeJSON({ system, prompt, schema, maxTokens = 16000 }) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((block) => block.type === "text")?.text;
  return JSON.parse(text);
}

/**
 * Ask Claude for free-form text (cover letters, application answers).
 */
export async function askClaudeText({ system, prompt, maxTokens = 16000 }) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content.find((block) => block.type === "text")?.text ?? "";
}

export default getClient;
