import Anthropic from "@anthropic-ai/sdk";

// Server-side only — ANTHROPIC_API_KEY must never reach the browser.
// All Claude calls go through Next.js API routes that import this module.
const client = new Anthropic();

export const MODEL = "claude-opus-4-8";

/**
 * Ask Claude a question and get back validated JSON matching `schema`.
 * Used for profile extraction, match verdicts, and roadmaps so the
 * responses are machine-readable, not prose.
 */
export async function askClaudeJSON({ system, prompt, schema, maxTokens = 16000 }) {
  const response = await client.messages.create({
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
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content.find((block) => block.type === "text")?.text ?? "";
}

export default client;
