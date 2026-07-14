// Reads and updates .env.local so API keys can be managed from the settings
// page instead of a text editor. Only whitelisted keys are ever touched;
// other lines and comments are preserved. Server-side only.

import { promises as fs } from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

// The only keys the settings page may read or write.
export const MANAGED_KEYS = [
  "ANTHROPIC_API_KEY",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
  "ADZUNA_COUNTRY",
  "RAPIDAPI_KEY",
  // Accounts (optional; auth config loads at boot, so these need a restart)
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_MICROSOFT_ENTRA_ID_ID",
  "AUTH_MICROSOFT_ENTRA_ID_SECRET",
];

async function readLines() {
  try {
    return (await fs.readFile(ENV_PATH, "utf8")).split("\n");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

/** Current values of the managed keys from .env.local (not process.env). */
export async function readManagedValues() {
  const values = {};
  for (const line of await readLines()) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && MANAGED_KEYS.includes(match[1])) {
      values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return values;
}

/**
 * Write key/value pairs into .env.local, updating lines in place and
 * appending missing ones. An empty-string value clears the key. Values are
 * validated upstream (single line, no control characters).
 */
export async function updateManagedValues(updates) {
  const lines = await readLines();
  const remaining = new Map(Object.entries(updates));

  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match && remaining.has(match[1])) {
      const value = remaining.get(match[1]);
      remaining.delete(match[1]);
      return `${match[1]}=${value}`;
    }
    return line;
  });

  for (const [key, value] of remaining) {
    // Keep a single trailing newline before appending.
    while (updated.length && updated[updated.length - 1] === "") updated.pop();
    updated.push(`${key}=${value}`);
  }
  updated.push("");

  await fs.writeFile(ENV_PATH, updated.join("\n"), { mode: 0o600 });
}
