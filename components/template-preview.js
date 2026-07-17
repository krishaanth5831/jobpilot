"use client";

import { useMemo } from "react";
import { parseResumeMarkdown } from "@/lib/resume-markdown";

// Miniature paper mockup of a resume template, rendered from the user's actual
// resume. Approximates the pdfkit output (same parsed blocks, same style
// parameters) at thumbnail scale. Paper stays white in dark mode.
// `scale` multiplies every dimension (1 = template thumbnail); `wrap` lets
// long lines wrap like the real PDF instead of truncating — used by the live
// preview, where reading the content matters more than fitting the whole page.

const FONT_STACKS = {
  sans: "ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Courier New', monospace",
};

const DENSITY_GAP = { normal: 3, tight: 2, airy: 5 };

const MAX_PREVIEW_BLOCKS = 20;

const runText = (runs) => (runs ? runs.map((r) => r.text).join("") : "");

export function TemplatePreview({ template: t, markdown, scale = 1, wrap = false }) {
  const allBlocks = useMemo(() => parseResumeMarkdown(markdown), [markdown]);
  const accent = t.accent ?? "#000000";
  const px = (n) => n * scale;
  const gap = px(DENSITY_GAP[t.density]);
  const pad = px(12);
  const line = wrap ? "" : "truncate";

  const sectionStyle = (style) => {
    if (style === "rule") return { borderBottom: `${px(1)}px solid ${t.accent ?? "#c4c4c4"}` };
    if (style === "underline") return { textDecoration: "underline" };
    if (style === "leftbar") return { borderLeft: `${px(2.5)}px solid ${accent}`, paddingLeft: px(3) };
    return {};
  };

  const heading = (text, extra) => (
    <div
      className="font-bold uppercase"
      style={{
        fontSize: px(5),
        letterSpacing: "0.06em",
        color: accent,
        marginTop: gap + px(2),
        marginBottom: gap - px(1),
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
        <div key={i} className={`${line} font-semibold`} style={{ fontSize: px(4.5), marginTop: px(1) }}>
          {runText(block.runs)}
        </div>
      );
    if (block.type === "bullet")
      return (
        <div key={i} className={`${line} text-neutral-700`} style={{ fontSize: px(4.5) }}>
          {t.bullet} {runText(block.runs)}
        </div>
      );
    if (block.type === "para")
      return (
        <div key={i} className={`${line} text-neutral-700`} style={{ fontSize: px(4.5) }}>
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
          {(wrap ? s.blocks : s.blocks.slice(0, 6)).map((b, bi) => bodyBlock(b, bi))}
        </div>
      ));

    return (
      <div
        aria-hidden="true"
        className="aspect-[17/22] w-full overflow-hidden rounded-lg bg-white text-neutral-900"
        style={{ fontFamily: FONT_STACKS[t.font], padding: pad }}
      >
        {header.map((b, i) =>
          b.type === "name" ? (
            <div key={i} className="font-bold" style={{ fontSize: px(8), color: accent, textAlign: t.nameAlign }}>
              {b.text}
            </div>
          ) : (
            <div key={i} className={`${line} text-neutral-500`} style={{ fontSize: px(4.5), marginBottom: gap }}>
              {runText(b.runs)}
            </div>
          )
        )}
        <div className="flex" style={{ marginTop: gap, gap: px(8) }}>
          <div
            className="w-[34%] shrink-0 rounded-sm"
            style={{ backgroundColor: t.sidebarTint ?? "#f3f4f6", padding: `${px(4)}px ${px(6)}px` }}
          >
            {column(sidebar)}
          </div>
          <div className="min-w-0 flex-1">{column(main)}</div>
        </div>
      </div>
    );
  }

  // ---- Single column ----
  const blocks = wrap ? allBlocks : allBlocks.slice(0, MAX_PREVIEW_BLOCKS);
  return (
    <div
      aria-hidden="true"
      className="aspect-[17/22] w-full overflow-hidden rounded-lg bg-white text-neutral-900"
      style={{ fontFamily: FONT_STACKS[t.font], padding: pad }}
    >
      {blocks.map((block, i) => {
        switch (block.type) {
          case "name":
            return t.band ? (
              <div
                key={i}
                className="font-bold text-white"
                style={{
                  margin: `${-pad}px ${-pad}px ${px(6)}px`,
                  padding: `${pad}px ${pad}px ${px(6)}px`,
                  backgroundColor: accent,
                  fontSize: px(8),
                  textAlign: t.nameAlign,
                }}
              >
                {block.text}
              </div>
            ) : (
              <div
                key={i}
                className="font-bold"
                style={{ fontSize: px(8), color: accent, textAlign: t.nameAlign }}
              >
                {block.text}
              </div>
            );
          case "contact":
            return (
              <div
                key={i}
                className={`${line} text-neutral-500`}
                style={{ fontSize: px(4.5), textAlign: t.nameAlign, marginBottom: gap }}
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
