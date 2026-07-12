// Typesets a rebuilt/tailored resume into a PDF buffer with pdfkit, styled
// by one of the templates in lib/resume-templates.js. Structure comes from
// the shared markdown parser so the studio previews match the download.

import PDFDocument from "pdfkit";
import { parseResumeMarkdown } from "./resume-markdown.js";
import { getTemplate } from "./resume-templates.js";

const FONTS = {
  sans: { regular: "Helvetica", bold: "Helvetica-Bold" },
  serif: { regular: "Times-Roman", bold: "Times-Bold" },
  mono: { regular: "Courier", bold: "Courier-Bold" },
};

const DENSITY = {
  normal: { margin: 54, body: 10, name: 20, section: 10.5, lineGap: 2, space: 0.35 },
  tight: { margin: 46, body: 9.3, name: 18, section: 10, lineGap: 1.2, space: 0.25 },
  airy: { margin: 60, body: 10, name: 21, section: 10.5, lineGap: 3.2, space: 0.5 },
};

const BODY_COLOR = "#111111";
const MUTED_COLOR = "#555555";

function writeRuns(doc, runs, fonts, { size, bullet = null, lineGap, align }) {
  runs.forEach((run, i) => {
    const first = i === 0;
    const last = i === runs.length - 1;
    doc
      .font(run.bold ? fonts.bold : fonts.regular)
      .fontSize(size)
      .text(first && bullet ? `${bullet}  ${run.text}` : run.text, {
        continued: !last,
        indent: bullet && first ? 10 : 0,
        lineGap,
        align,
      });
  });
}

/**
 * @param {string} markdown
 * @param {string} [templateId] one of lib/resume-templates.js ids
 * @returns {Promise<Buffer>} a letter-format PDF
 */
export function resumeMarkdownToPdf(markdown, templateId) {
  const t = getTemplate(templateId);
  const fonts = FONTS[t.font];
  const d = DENSITY[t.density];
  const accent = t.accent ?? "#000000";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: t.band ? 0 : d.margin, bottom: d.margin, left: d.margin, right: d.margin },
      info: { Title: "Resume" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - d.margin * 2;

    for (const block of parseResumeMarkdown(markdown)) {
      switch (block.type) {
        case "space":
          doc.moveDown(d.space);
          break;

        case "name":
          if (t.band) {
            // Full-bleed band with the name reversed out of it.
            const bandHeight = d.name + d.margin * 1.1;
            doc.rect(0, 0, doc.page.width, bandHeight).fill(accent);
            doc
              .fillColor("#ffffff")
              .font(fonts.bold)
              .fontSize(d.name)
              .text(block.text, d.margin, bandHeight - d.name - 16, { align: t.nameAlign });
            doc.text("", d.margin, bandHeight + 12); // resume normal flow below the band
            doc.fillColor(BODY_COLOR);
          } else {
            doc
              .fillColor(accent)
              .font(fonts.bold)
              .fontSize(d.name)
              .text(block.text, { align: t.nameAlign });
            doc.fillColor(BODY_COLOR).moveDown(0.15);
          }
          break;

        case "contact":
          doc.fillColor(MUTED_COLOR);
          writeRuns(doc, block.runs, fonts, {
            size: d.body - 0.5,
            lineGap: d.lineGap,
            align: t.nameAlign,
          });
          doc.fillColor(BODY_COLOR);
          break;

        case "section": {
          doc.moveDown(d.space + 0.1);
          const label = block.text.toUpperCase();
          const opts = { characterSpacing: 1, align: t.nameAlign === "center" ? "center" : "left" };

          if (t.sectionStyle === "leftbar") {
            const barTop = doc.y;
            doc.rect(d.margin, barTop, 3.5, d.section + 2).fill(accent);
            doc
              .fillColor(accent)
              .font(fonts.bold)
              .fontSize(d.section)
              .text(label, d.margin + 11, barTop + 1, opts);
            doc.text("", d.margin, doc.y); // restore left edge for what follows
            doc.fillColor(BODY_COLOR).moveDown(0.35);
          } else {
            doc
              .fillColor(accent)
              .font(fonts.bold)
              .fontSize(d.section)
              .text(label, { ...opts, underline: t.sectionStyle === "underline" });
            if (t.sectionStyle === "rule") {
              const y = doc.y + 1.5;
              doc
                .moveTo(d.margin, y)
                .lineTo(d.margin + width, y)
                .lineWidth(0.6)
                .strokeColor(t.accent ?? "#b3b3b3")
                .stroke()
                .strokeColor("black");
            }
            doc.fillColor(BODY_COLOR).moveDown(0.45);
          }
          break;
        }

        case "sub":
          doc.moveDown(0.15);
          writeRuns(doc, block.runs, fonts, { size: d.body + 0.5, lineGap: d.lineGap });
          break;

        case "bullet":
          writeRuns(doc, block.runs, fonts, { size: d.body, bullet: t.bullet, lineGap: d.lineGap });
          break;

        case "para":
          writeRuns(doc, block.runs, fonts, { size: d.body, lineGap: d.lineGap });
          break;
      }
    }

    doc.end();
  });
}
