// The free built-in model: Llama 3.3 70B on Groq's free tier. New accounts
// have no API keys, so instead of a wall of "add your key" errors they get
// working AI out of the box via one server-wide GROQ_API_KEY (owner-managed
// on the Settings page; free at console.groq.com). Anyone who pastes their
// own ANTHROPIC_API_KEY is upgraded to Claude automatically (lib/claude.js).
//
// Plain fetch against Groq's OpenAI-compatible endpoint — no SDK dependency,
// same pattern as lib/redis.js. GROQ_BASE_URL exists so tests can point at a
// mock server.

import { ConfigError } from "./claude";

export const FREE_MODEL = "llama-3.3-70b-versatile";

const baseUrl = () => process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

/** True when the server has a shared Groq key for keyless accounts. */
export function freeModelAvailable() {
  return Boolean(process.env.GROQ_API_KEY);
}

// The free tier caps llama-3.3-70b at 12K tokens/minute shared across every
// account on this server — a Claude-sized max_tokens (16K) would be rejected
// outright, so cap the completion budget well under the TPM window.
const MAX_FREE_TOKENS = 6000;

async function chat({ system, prompt, maxTokens, json }) {
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      max_tokens: Math.min(maxTokens, MAX_FREE_TOKENS),
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ConfigError(
      "The free built-in model's key was rejected — the owner needs to update the Groq key on the Settings page. Or paste your own Claude API key there to skip the free model entirely."
    );
  }
  if (res.status === 429 || res.status === 413) {
    throw new ConfigError(
      "The free built-in model is busy right now (its rate limit is shared by every account on this server). Wait a minute and retry — or add your own Claude API key on the Settings page for dedicated, higher-quality AI."
    );
  }
  if (!res.ok) {
    throw new Error(`Free model request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Free-tier counterpart of askClaudeJSON. Llama has no server-enforced JSON
 * schemas, so we get the closest guarantee: Groq's JSON mode (always valid
 * JSON) plus the schema embedded in the system prompt.
 */
export async function askFreeJSON({ system, prompt, schema, maxTokens = 16000 }) {
  const jsonSystem =
    `${system}\n\n` +
    "Respond with a single JSON object only — no prose, no code fences. " +
    `It must strictly match this JSON schema:\n${JSON.stringify(schema)}`;
  const text = await chat({ system: jsonSystem, prompt, maxTokens, json: true });
  return JSON.parse(text);
}

/** Free-tier counterpart of askClaudeText (cover letters, answers). */
export async function askFreeText({ system, prompt, maxTokens = 16000 }) {
  return chat({ system, prompt, maxTokens, json: false });
}
