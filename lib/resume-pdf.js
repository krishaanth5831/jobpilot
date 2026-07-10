// Typesets the rebuilt resume's markdown into a PDF buffer with pdfkit.
// Handles exactly what the build prompt produces: #/##/### headings,
// "- " bullets, **bold** runs, links, and plain paragraphs.

import PDFDocument from "pdfkit";

const MARGIN = 54;
const BODY_SIZE = 10;

// Inline markdown → text runs: [{ text, bold }]. Links become "text (url)".
function toRuns(text) {
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

function writeRuns(doc, text, { size = BODY_SIZE, bullet = false } = {}) {
  const runs = toRuns(text);
  runs.forEach((run, i) => {
    const first = i === 0;
    const last = i === runs.length - 1;
    doc
      .font(run.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .text(first && bullet ? `•  ${run.text}` : run.text, {
        continued: !last,
        indent: bullet && first ? 10 : 0,
        lineGap: 2,
      });
  });
}

/**
 * @param {string} markdown
 * @returns {Promise<Buffer>} a letter-format PDF
 */
export function resumeMarkdownToPdf(markdown) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: { Title: "Resume" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const raw of markdown.split("\n")) {
      const line = raw.trim();

      if (!line) {
        doc.moveDown(0.35);
      } else if (line.startsWith("# ")) {
        // Name
        doc.font("Helvetica-Bold").fontSize(20).text(toRuns(line.slice(2)).map((r) => r.text).join(""));
        doc.moveDown(0.15);
      } else if (line.startsWith("## ")) {
        // Section: small caps + hairline rule
        doc.moveDown(0.4);
        doc
          .font("Helvetica-Bold")
          .fontSize(10.5)
          .text(toRuns(line.slice(3)).map((r) => r.text).join("").toUpperCase(), {
            characterSpacing: 1,
          });
        const y = doc.y + 1.5;
        doc
          .moveTo(MARGIN, y)
          .lineTo(doc.page.width - MARGIN, y)
          .lineWidth(0.6)
          .strokeColor("#b3b3b3")
          .stroke()
          .strokeColor("black");
        doc.moveDown(0.5);
      } else if (line.startsWith("### ")) {
        doc.moveDown(0.15);
        writeRuns(doc, `**${line.slice(4)}**`, { size: 10.5 });
      } else if (/^[-*] /.test(line)) {
        writeRuns(doc, line.slice(2), { bullet: true });
      } else if (/^---+$/.test(line)) {
        doc.moveDown(0.35);
      } else {
        writeRuns(doc, line);
      }
    }

    doc.end();
  });
}
