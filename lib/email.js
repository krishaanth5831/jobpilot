// Transactional email via Resend's REST API (free tier: 3k emails/month,
// 100/day — plenty for password resets). Plain fetch, no SDK, same pattern
// as lib/redis.js and lib/free-model.js. RESEND_BASE_URL exists so tests
// can point at a mock server; RESEND_FROM must be a verified sender on the
// Resend account (the jobblast.nl domain, once its DNS records are added).

const baseUrl = () => process.env.RESEND_BASE_URL || "https://api.resend.com";

/** True when the server can send email (owner has configured Resend). */
export function emailAvailable() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({ to, subject, text, html }) {
  const from = process.env.RESEND_FROM || "jobblast <noreply@jobblast.nl>";
  const res = await fetch(`${baseUrl()}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  }
}
