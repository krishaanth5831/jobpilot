// Generates the five snapshot fixture PDFs.
//
// They are GENERATED rather than collected so that no real person's resume is
// committed to this repository. Every name, address and employer below is
// invented. Run with:  node lib/resume-health/__tests__/fixtures/generate.mjs
//
// The committed .pdf files are the fixtures; this script is committed too so
// they can be reproduced or adjusted.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ---------- a minimal valid PNG, for the "scanned" fixture ---------- */

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

/** Flat grey 8-bit RGB PNG — stands in for a scan. */
function makePng(width, height, grey = 0xd8) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      // A faint horizontal banding so it reads as a page scan, not a swatch.
      const v = y % 40 < 3 ? grey - 40 : grey;
      raw[p] = v;
      raw[p + 1] = v;
      raw[p + 2] = v;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(name, build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => {
      const file = path.join(HERE, name);
      fs.writeFileSync(file, Buffer.concat(chunks));
      console.log(`wrote ${name} (${fs.statSync(file).size} bytes)`);
      resolve();
    });
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

const SKILLS_FULL =
  "Python, JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, " +
  "Terraform, AWS, Git, REST APIs, pytest, CI/CD, Linux";

/* ---------- 1. clean single-column, LaTeX-style ---------- */

async function cleanSingleColumn() {
  await write("clean-single-column.pdf", (doc) => {
    doc.fontSize(20).text("A. Candidate", { align: "left" });
    doc.fontSize(10).text("candidate@example.com | +31 6 12345678");
    doc.text("Amsterdam, Netherlands | linkedin.com/in/acandidate");
    doc.moveDown();

    doc.fontSize(13).text("Summary");
    doc.fontSize(10).text(
      "Backend engineer focused on data-heavy services and deployment tooling.",
    );
    doc.moveDown(0.5);

    doc.fontSize(13).text("Experience");
    doc.fontSize(11).text("Backend Engineer, Northwind Systems");
    doc.fontSize(10).text("Mar 2022 - Aug 2025");
    doc.list(
      [
        "Reduced median API latency from 480 ms to 120 ms by adding query-level caching.",
        "Migrated 14 services to Docker and Kubernetes, cutting deploy time by 65%.",
        "Built a CI/CD pipeline in GitHub Actions covering 320 pytest cases.",
        "Designed the PostgreSQL schema behind a 40 million row event store.",
      ],
      { bulletRadius: 1.5 },
    );
    doc.moveDown(0.4);

    doc.fontSize(11).text("Junior Developer, Halcyon Labs");
    doc.fontSize(10).text("Jun 2020 - Feb 2022");
    doc.list(
      [
        "Shipped 3 React features used by 12000 monthly active users.",
        "Automated weekly reporting with Python, saving 6 hours per week.",
        "Wrote REST APIs in Node.js serving 90 requests per second at peak.",
      ],
      { bulletRadius: 1.5 },
    );
    doc.moveDown(0.5);

    doc.fontSize(13).text("Education");
    doc.fontSize(10).text("BSc Computer Science, Delft University - Jun 2020");
    doc.moveDown(0.5);

    doc.fontSize(13).text("Skills");
    doc.fontSize(10).text(SKILLS_FULL);
    doc.moveDown(0.5);

    doc.fontSize(13).text("Projects");
    doc.fontSize(10).text(
      "Ledger: an open-source double-entry accounting library in TypeScript with 900 GitHub stars.",
    );
  });
}

/* ---------- 2. Canva-style two-column with a photo ---------- */

async function canvaTwoColumn() {
  await write("canva-two-column.pdf", (doc) => {
    // Contact details up in the header band, where parsers drop them.
    doc.fontSize(9).text("candidate@example.com  |  +31 6 12345678", 50, 18);

    // Sidebar background and a portrait-shaped photo.
    doc.rect(40, 60, 170, 720).fill("#eef2f6");
    doc.image(makePng(120, 150), 60, 70, { width: 110 });

    doc.fillColor("#000");
    let y = 250;
    doc.fontSize(12).text("EXPERTISE", 50, y);
    y += 24;
    // Skills as rating bars: the labels are drawn, the LEVEL is only a shape.
    for (const skill of ["Python", "React", "Docker", "AWS", "SQL", "Git", "Linux"]) {
      doc.fontSize(9).text(skill, 50, y);
      doc.rect(50, y + 12, 140, 5).fill("#c3ccd6");
      doc.rect(50, y + 12, 95, 5).fill("#5b7085");
      doc.fillColor("#000");
      y += 30;
    }

    doc.fontSize(12).text("CONTACT", 50, y + 10);
    doc.fontSize(9).text("Rotterdam, Netherlands", 50, y + 32);

    // Right column.
    doc.fontSize(20).text("A. Candidate", 250, 70);
    doc.fontSize(12).text("WHAT I BRING", 250, 110);
    doc.fontSize(9).text(
      "A dynamic, results-driven team player and self-starter who thinks outside the box.",
      250,
      130,
      { width: 300 },
    );

    doc.fontSize(12).text("WHERE I HAVE BEEN", 250, 180);
    doc.fontSize(10).text("Product Designer, Vantage Studio", 250, 202);
    doc.fontSize(9).text("2021 - 2024", 250, 218);
    doc.text(
      "I was responsible for the redesign of the onboarding flow and my work was recognised across the company.",
      250,
      234,
      { width: 300 },
    );
    doc.text(
      "Responsible for maintaining the design system and I supported the marketing team with assets on request.",
      250,
      274,
      { width: 300 },
    );

    doc.fontSize(10).text("Design Intern, Kettle & Co", 250, 330);
    doc.fontSize(9).text("2020 - 2021", 250, 346);
    doc.text(
      "Helped with various design tasks and I was involved in client presentations.",
      250,
      362,
      { width: 300 },
    );

    doc.fontSize(12).text("LEARNING", 250, 430);
    doc.fontSize(9).text("BA Graphic Design, Willem de Kooning - 2020", 250, 452);
  });
}

/* ---------- 3. Word export with a table layout ---------- */

async function wordWithTables() {
  await write("word-with-tables.pdf", (doc) => {
    doc.fontSize(18).text("A. Candidate", 50, 50);
    doc.fontSize(10).text("candidate@example.com", 50, 76);
    doc.text("+31 6 12345678", 50, 90);
    doc.text("Utrecht, Netherlands", 50, 104);

    doc.fontSize(13).text("Experience", 50, 140);

    // A grid: three columns repeated over several rows, drawn with rules.
    const rows = [
      ["Mechanical Engineer", "Ardent Manufacturing", "03/2021 - 09/2024"],
      ["Design Engineer", "Braid Industrial", "2019 - 2021"],
      ["Engineering Intern", "Corvus Works", "Jun 2018 - Sep 2018"],
      ["Workshop Assistant", "Delta Fabrication", "2017 - 2018"],
    ];
    let y = 170;
    for (const row of rows) {
      doc.fontSize(9);
      doc.text(row[0], 50, y, { width: 150 });
      doc.text(row[1], 220, y, { width: 150 });
      doc.text(row[2], 400, y, { width: 130 });
      doc
        .moveTo(50, y + 22)
        .lineTo(545, y + 22)
        .stroke();
      y += 34;
    }

    y += 10;
    doc.fontSize(13).text("Responsibilities", 50, y);
    y += 22;
    doc.fontSize(9);
    doc.list(
      [
        "Responsible for producing technical drawings using SolidWorks and AutoCAD.",
        "Tasked with running FEA studies in ANSYS on housing components before release, which involved coordinating with the production team and the external supplier on tolerances and material selection across several revisions.",
        "Supported the manufacturing team with GD&T reviews and DFM feedback.",
      ],
      50,
      y,
      { bulletRadius: 1.5, width: 495 },
    );

    doc.fontSize(13).text("Education", 50, 500);
    doc.fontSize(9).text("MSc Mechanical Engineering, TU Eindhoven - 2019", 50, 522);

    doc.fontSize(13).text("Skills", 50, 560);
    doc
      .fontSize(9)
      .text("SolidWorks, AutoCAD, ANSYS, GD&T, DFM, MATLAB, Six Sigma", 50, 582);
  });
}

/* ---------- 4. a scan: image only, no text layer ---------- */

async function scannedImage() {
  await write("scanned-image.pdf", (doc) => {
    doc.image(makePng(600, 850), 0, 0, { width: 595, height: 842 });
  });
}

/* ---------- 5. sparse student ---------- */

async function sparseStudent() {
  await write("sparse-student.pdf", (doc) => {
    doc.fontSize(16).text("A. Candidate");
    doc.fontSize(10).text("candidate@example.com");
    doc.moveDown();

    doc.fontSize(12).text("Education");
    doc.fontSize(10).text("BSc Electrical Engineering, TU Delft, expected 2027");
    doc.moveDown();

    doc.fontSize(12).text("Skills");
    doc.fontSize(10).text("Python, MATLAB, teamwork, communication, problem solving");
    doc.moveDown();

    doc.fontSize(12).text("About");
    doc
      .fontSize(10)
      .text(
        "I am a hard-working and detail-oriented student. I am a team player and I am looking for an internship where I can develop my skills further and contribute to a dynamic team.",
        { width: 495 },
      );
  });
}

await cleanSingleColumn();
await canvaTwoColumn();
await wordWithTables();
await scannedImage();
await sparseStudent();
console.log("done");
