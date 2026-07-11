// Parses the rebuilt resume's markdown into typed blocks. Shared by the
// pdfkit renderer (server) and the template preview cards (client), so the
// two always agree on structure. Pure JS, no dependencies.

// Inline markdown → text runs: [{ text, bold }]. Links become "text (url)".
export function toRuns(text) {
  const cleaned = text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1"); // italics render as plain
  return cleaned
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((seg) =>
      seg.startsWith("**") && seg.endsWith("**")
        ? { text: seg.slice(2, -2), bold: true }
        : { text: seg, bold: false }
    );
}

const plain = (text) => toRuns(text).map((r) => r.text).join("");

/**
 * @returns {Array<{type: "name"|"contact"|"section"|"sub"|"bullet"|"para"|"space", text?: string, runs?: Array}>}
 */
export function parseResumeMarkdown(markdown) {
  const blocks = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line || /^---+$/.test(line)) {
      blocks.push({ type: "space" });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "name", text: plain(line.slice(2)) });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "section", text: plain(line.slice(3)) });
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "sub", runs: toRuns(`**${line.slice(4)}**`) });
    } else if (/^[-*] /.test(line)) {
      blocks.push({ type: "bullet", runs: toRuns(line.slice(2)) });
    } else {
      // The line right after the name is the contact strip.
      const prev = blocks.findLast((b) => b.type !== "space");
      blocks.push({ type: prev?.type === "name" ? "contact" : "para", runs: toRuns(line) });
    }
  }
  return blocks;
}
