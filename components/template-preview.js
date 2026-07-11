"use client";

import { useMemo } from "react";
import { parseResumeMarkdown } from "@/lib/resume-markdown";

// Miniature paper mockup of a resume template, rendered from the user's
// actual rebuilt resume. Approximates the pdfkit output (same parsed blocks,
// same style parameters) at thumbnail scale. Paper stays white in dark mode.

const FONT_STACKS = {
  sans: "ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Courier New', monospace",
};

const DENSITY_GAP = { normal: 3, tight: 2, airy: 5 };

const MAX_PREVIEW_BLOCKS = 20;

export function TemplatePreview({ template: t, markdown }) {
  const blocks = useMemo(
    () => parseResumeMarkdown(markdown).slice(0, MAX_PREVIEW_BLOCKS),
    [markdown]
  );
  const accent = t.accent ?? "#000000";
  const gap = DENSITY_GAP[t.density];
  const run = (runs) => runs.map((r) => r.text).join("");

  const sectionStyle = (style) => {
    if (style === "rule") return { borderBottom: `1px solid ${t.accent ?? "#c4c4c4"}` };
    if (style === "underline") return { textDecoration: "underline" };
    if (style === "leftbar")
      return { borderLeft: `2.5px solid ${accent}`, paddingLeft: 3 };
    return {};
  };

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
                {run(block.runs)}
              </div>
            );
          case "section":
            return (
              <div
                key={i}
                className="font-bold uppercase"
                style={{
                  fontSize: 5,
                  letterSpacing: "0.06em",
                  color: accent,
                  marginTop: gap + 2,
                  marginBottom: gap - 1,
                  textAlign: t.nameAlign === "center" ? "center" : "left",
                  ...sectionStyle(t.sectionStyle),
                }}
              >
                {block.text}
              </div>
            );
          case "sub":
            return (
              <div key={i} className="truncate font-semibold" style={{ fontSize: 4.5, marginTop: 1 }}>
                {run(block.runs)}
              </div>
            );
          case "bullet":
            return (
              <div key={i} className="truncate text-neutral-700" style={{ fontSize: 4.5 }}>
                {t.bullet} {run(block.runs)}
              </div>
            );
          case "para":
            return (
              <div key={i} className="truncate text-neutral-700" style={{ fontSize: 4.5 }}>
                {run(block.runs)}
              </div>
            );
          default:
            return <div key={i} style={{ height: gap }} />;
        }
      })}
    </div>
  );
}
