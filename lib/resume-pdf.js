// Typesets a resume into a PDF buffer with pdfkit, styled by one of the
// templates in lib/resume-templates.js. Structure comes from the shared
// markdown parser so the studio previews match the download. Most templates
// are a single top-to-bottom column; the "twocol" layout splits skills /
// education into a tinted sidebar with experience in the main column.

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

const plain = (block) => (block.runs ? block.runs.map((r) => r.text).join("") : block.text ?? "");

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

// Renders the parsed blocks as one continuous column (pdfkit handles page
// breaks). This is the original layout, used by every non-twocol template.
function renderSingleColumn(doc, blocks, { t, fonts, d, accent, width }) {
  for (const block of blocks) {
    switch (block.type) {
      case "space":
        doc.moveDown(d.space);
        break;

      case "name":
        if (t.band) {
          const bandHeight = d.name + d.margin * 1.1;
          doc.rect(0, 0, doc.page.width, bandHeight).fill(accent);
          doc
            .fillColor("#ffffff")
            .font(fonts.bold)
            .fontSize(d.name)
            .text(block.text, d.margin, bandHeight - d.name - 16, { align: t.nameAlign });
          doc.text("", d.margin, bandHeight + 12);
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
          doc.text("", d.margin, doc.y);
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
}

// ---- Two-column layout ----

// Group blocks into { heading, blocks } sections; anything before the first
// section heading (name, contact, a summary line) is the full-width header.
function splitSections(blocks) {
  const header = [];
  const sections = [];
  let current = null;
  for (const block of blocks) {
    if (block.type === "section") {
      current = { heading: block.text, blocks: [] };
      sections.push(current);
    } else if (block.type === "space") {
      if (current) current.blocks.push(block);
    } else if (current) {
      current.blocks.push(block);
    } else {
      header.push(block);
    }
  }
  return { header, sections };
}

// Height a single body block will take in a column of `width`, plus the font
// to use — measured and drawn identically so pagination stays exact.
function itemMetrics(doc, block, width, { fonts, d, t }) {
  if (block.type === "space") return { height: d.body * (0.35 + d.space), font: fonts.regular, size: d.body };
  if (block.type === "sub") {
    const size = d.body + 0.5;
    doc.font(fonts.bold).fontSize(size);
    return { height: doc.heightOfString(plain(block), { width }) + 2, font: fonts.bold, size };
  }
  if (block.type === "bullet") {
    doc.font(fonts.regular).fontSize(d.body);
    return { height: doc.heightOfString(`${t.bullet}  ${plain(block)}`, { width }) + 1.5, font: fonts.regular, size: d.body };
  }
  // para / contact / fallback
  doc.font(fonts.regular).fontSize(d.body);
  return { height: doc.heightOfString(plain(block), { width }) + 1.5, font: fonts.regular, size: d.body };
}

function renderTwoColumn(doc, blocks, ctx) {
  const { t, fonts, d, accent } = ctx;
  const sidebarRe = new RegExp(`^(${t.sidebarSections ?? "skills|education"})$`, "i");
  const { header, sections } = splitSections(blocks);
  const sidebar = sections.filter((s) => sidebarRe.test(s.heading.trim()));
  const main = sections.filter((s) => !sidebarRe.test(s.heading.trim()));

  // Nothing to put in the sidebar (or nothing in the main) → a two-column grid
  // would look broken; fall back to the normal single column.
  if (sidebar.length === 0 || main.length === 0) {
    const width = doc.page.width - d.margin * 2;
    return renderSingleColumn(doc, blocks, { ...ctx, width });
  }

  const margin = d.margin;
  const contentW = doc.page.width - margin * 2;
  const gutter = 16;
  const leftW = Math.round(contentW * 0.34);
  const rightW = contentW - leftW - gutter;
  const leftX = margin;
  const rightX = margin + leftW + gutter;
  const bottom = doc.page.height - margin;
  const tint = t.sidebarTint ?? "#f3f4f6";

  // Header (name + contact), full width across the top of page 0.
  for (const block of header) {
    if (block.type === "name") {
      doc.fillColor(accent).font(fonts.bold).fontSize(d.name).text(block.text, margin, doc.y, { width: contentW, align: t.nameAlign });
      doc.fillColor(BODY_COLOR).moveDown(0.1);
    } else if (block.type === "contact") {
      doc.fillColor(MUTED_COLOR).font(fonts.regular).fontSize(d.body - 0.5).text(plain(block), margin, doc.y, { width: contentW, align: t.nameAlign });
      doc.fillColor(BODY_COLOR);
    } else if (block.type !== "space") {
      doc.fillColor(BODY_COLOR).font(fonts.regular).fontSize(d.body).text(plain(block), margin, doc.y, { width: contentW });
    }
  }
  const colTop = doc.y + 10;

  const firstPage = doc.bufferedPageRange().start;
  const tinted = new Set();
  const paintTint = (pageIndex) => {
    if (tinted.has(pageIndex)) return;
    tinted.add(pageIndex);
    const top = pageIndex === firstPage ? colTop : margin;
    doc.save().rect(leftX - 8, top - 8, leftW + 16, bottom - top + 16).fill(tint).restore();
    doc.fillColor(BODY_COLOR);
  };

  const ensurePage = (pageIndex) => {
    const range = doc.bufferedPageRange();
    while (range.start + range.count <= pageIndex) doc.addPage();
  };

  // Render one column's sections, paginating by measured height. Sidebar
  // columns paint their tint on each page before drawing onto it.
  const renderColumn = (cols, x, width, isSidebar) => {
    let pageIndex = firstPage;
    let y = colTop;
    doc.switchToPage(pageIndex);
    if (isSidebar) paintTint(pageIndex);

    const place = (h) => {
      if (y + h > bottom) {
        pageIndex += 1;
        ensurePage(pageIndex);
        doc.switchToPage(pageIndex);
        if (isSidebar) paintTint(pageIndex);
        y = margin;
      }
    };

    for (const sec of cols) {
      // Section heading.
      const label = sec.heading.toUpperCase();
      doc.font(fonts.bold).fontSize(d.section);
      const headH = doc.heightOfString(label, { width, characterSpacing: 1 });
      place(headH + 10);
      y += 6;
      doc.fillColor(accent).font(fonts.bold).fontSize(d.section).text(label, x, y, { width, characterSpacing: 1 });
      let yAfter = doc.y;
      if (t.sectionStyle === "rule") {
        const ry = yAfter + 1.5;
        doc.moveTo(x, ry).lineTo(x + width, ry).lineWidth(0.6).strokeColor(accent).stroke().strokeColor("black");
        yAfter = ry + 2;
      }
      doc.fillColor(BODY_COLOR);
      y = yAfter + 3;

      for (const block of sec.blocks) {
        const m = itemMetrics(doc, block, width, ctx);
        if (block.type === "space") { y += m.height; continue; }
        place(m.height);
        const isSub = block.type === "sub";
        const str = block.type === "bullet" ? `${t.bullet}  ${plain(block)}` : plain(block);
        doc.font(m.font).fontSize(m.size).fillColor(isSub ? BODY_COLOR : (block.type === "contact" ? MUTED_COLOR : BODY_COLOR))
          .text(str, x, y, { width });
        y = doc.y + 1.5;
      }
      y += 4;
    }
  };

  // Main first (it usually runs longest and creates the extra pages), then the
  // sidebar paints its tint over the left column of whatever pages exist.
  renderColumn(main, rightX, rightW, false);
  renderColumn(sidebar, leftX, leftW, true);
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
      bufferPages: true,
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - d.margin * 2;
    const blocks = parseResumeMarkdown(markdown);

    if (t.layout === "twocol") {
      renderTwoColumn(doc, blocks, { t, fonts, d, accent });
    } else {
      renderSingleColumn(doc, blocks, { t, fonts, d, accent, width });
    }

    doc.flushPages();
    doc.end();
  });
}
