import { ImageResponse } from "next/og";

export const alt = "jobblast — apply where you qualify";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The pixel-rocket mark (same grid as components/logo.js).
const GRID = [
  "........###",
  ".......####",
  "......####.",
  ".....#.##..",
  "..#.####...",
  "...####....",
  "..####.....",
  ".#####.....",
  "..###......",
  ".#.........",
  "#.#........",
];
const PIXELS = GRID.flatMap((row, y) =>
  [...row].flatMap((ch, x) => (ch === "." ? [] : [{ x, y }]))
);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#000",
          color: "#fff",
          padding: "80px 96px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, color: "#a3a3a3" }}>jobblast</div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, marginTop: 16 }}>
            Apply where
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3 }}>
            you qualify.
          </div>
          <div style={{ fontSize: 28, color: "#737373", marginTop: 28 }}>
            AI job copilot — honest matches, drafted applications, gap roadmaps.
          </div>
        </div>
        <svg viewBox="0 0 11 11" width={330} height={330}>
          {PIXELS.map(({ x, y }, i) => (
            <rect key={i} x={x + 0.075} y={y + 0.075} width={0.85} height={0.85} fill="#fff" />
          ))}
        </svg>
      </div>
    ),
    { ...size }
  );
}
