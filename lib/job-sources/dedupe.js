// The same posting often shows up on several boards under different ids.
// A normalized company+title key catches those duplicates cheaply.

const normalize = (text) =>
  (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Fuzzy identity for a job, or null when the company is unknown —
 * "software engineer @ unknown" from two boards is usually NOT the same job.
 */
export function fuzzyJobKey(job) {
  const company = normalize(job.company);
  const title = normalize(job.title);
  if (!company || company === "unknown" || !title) return null;
  return `${company}|${title}`;
}
