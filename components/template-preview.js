"use client";

import { useMemo } from "react";
import { parseResumeMarkdown } from "@/lib/resume-markdown";

// Miniature paper mockup of a resume template, rendered from the user's actual
// resume. Approximates the pdfkit output (same parsed blocks, same style
// parameters) at thumbnail scale. Paper stays white in dark mode.

const FONT_STACKS = {
  sans: "ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Courier New', monospace",
};

const DENSITY_GAP = { normal: 3, tight: 2, airy: 5 };

const MAX_PREVIEW_BLOCKS = 20;

const runText = (runs) => (runs ? runs.map((r) => r.text).join("") : "");

export function TemplatePreview({ template: t, markdown }) {
  const allBlocks = useMemo(() => parseResumeMarkdown(markdown), [markdown]);
  const accent = t.accent ?? "#000000";
  const gap = DENSITY_GAP[t.density];

  const sectionStyle = (style) => {
    if (style === "rule") return { borderBottom: `1px solid ${t.accent ?? "#c4c4c4"}` };
    if (style === "underline") return { textDecoration: "underline" };
    if (style === "leftbar") return { borderLeft: `2.5px solid ${accent}`, paddingLeft: 3 };
    return {};
  };

  const heading = (text, extra) => (
    <div
      className="font-bold uppercase"
      style={{
        fontSize: 5,
        letterSpacing: "0.06em",
        color: accent,
        marginTop: gap + 2,
        marginBottom: gap - 1,
        ...sectionStyle(t.sectionStyle),
        ...extra,
      }}
    >
      {text}
    </div>
  );

  const bodyBlock = (block, i) => {
    if (block.type === "sub")
      return (
        <div key={i} className="truncate font-semibold" style={{ fontSize: 4.5, marginTop: 1 }}>
          {runText(block.runs)}
        </div>
      );
    if (block.type === "bullet")
      return (
        <div key={i} className="truncate text-neutral-700" style={{ fontSize: 4.5 }}>
          {t.bullet} {runText(block.runs)}
        </div>
      );
    if (block.type === "para")
      return (
        <div key={i} className="truncate text-neutral-700" style={{ fontSize: 4.5 }}>
          {runText(block.runs)}
        </div>
      );
    return null;
  };

  // ---- Two-column preview: header full-width, then a tinted sidebar (skills/
  // education) beside the main column (experience/projects). ----
  if (t.layout === "twocol") {
    const header = [];
    const sections = [];
    let cur = null;
    for (const b of allBlocks) {
      if (b.type === "name" || b.type === "contact") {
        if (!cur) header.push(b);
      } else if (b.type === "section") {
        cur = { heading: b.text, blocks: [] };
        sections.push(cur);
      } else if (b.type !== "space" && cur) {
        cur.blocks.push(b);
      }
    }
    const re = new RegExp(`^(${t.sidebarSections ?? "skills|education"})$`, "i");
    const sidebar = sections.filter((s) => re.test(s.heading.trim()));
    const main = sections.filter((s) => !re.test(s.heading.trim()));
    const column = (secs) =>
      secs.map((s, si) => (
        <div key={si}>
          {heading(s.heading)}
          {s.blocks.slice(0, 6).map((b, bi) => bodyBlock(b, bi))}
        </div>
      ));

    return (
      <div
        aria-hidden="true"
        className="aspect-[17/22] w-full overflow-hidden rounded-lg bg-white px-3 py-3 text-neutral-900"
        style={{ fontFamily: FONT_STACKS[t.font] }}
      >
        {header.map((b, i) =>
          b.type === "name" ? (
            <div key={i} className="font-bold" style={{ fontSize: 8, color: accent, textAlign: t.nameAlign }}>
              {b.text}
            </div>
          ) : (
            <div key={i} className="truncate text-neutral-500" style={{ fontSize: 4.5, marginBottom: gap }}>
              {runText(b.runs)}
            </div>
          )
        )}
        <div className="flex gap-2" style={{ marginTop: gap }}>
          <div
            className="w-[34%] shrink-0 rounded-sm px-1.5 py-1"
            style={{ backgroundColor: t.sidebarTint ?? "#f3f4f6" }}
          >
            {column(sidebar)}
          </div>
          <div className="min-w-0 flex-1">{column(main)}</div>
        </div>
      </div>
    );
  }

  // ---- Single column ----
  const blocks = allBlocks.slice(0, MAX_PREVIEW_BLOCKS);
  return (
    <div
      aria-hidden="true"
      className="aspect-[17/22] w-full overflow-hidden rounded-lg bg-white px-3 py-3 text-neutral-900"
      style={{ fontFamily: FONT_STACKS[t.font] }}
    >
      {blocks.map((block, i) => {
        switch (block.type) {
          case "name":
            return t.band ? (
              <div
                key={i}
                className="-mx-3 -mt-3 mb-1.5 px-3 pb-1.5 pt-3 font-bold text-white"
                style={{ backgroundColor: accent, fontSize: 8, textAlign: t.nameAlign }}
              >
                {block.text}
              </div>
            ) : (
              <div
                key={i}
                className="font-bold"
                style={{ fontSize: 8, color: accent, textAlign: t.nameAlign }}
              >
                {block.text}
              </div>
            );
          case "contact":
            return (
              <div
                key={i}
                className="truncate text-neutral-500"
                style={{ fontSize: 4.5, textAlign: t.nameAlign, marginBottom: gap }}
              >
                {runText(block.runs)}
              </div>
            );
          case "section":
            return (
              <div key={i}>
                {heading(block.text, { textAlign: t.nameAlign === "center" ? "center" : "left" })}
              </div>
            );
          case "sub":
          case "bullet":
          case "para":
            return bodyBlock(block, i);
          default:
            return <div key={i} style={{ height: gap }} />;
        }
      })}
    </div>
  );
}
