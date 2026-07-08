import { ImageResponse } from "next/og";

export const alt = "jobpilot — apply where you qualify";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The logo's pixel squares (same coordinates as components/logo.js).
const SQUARES = [
  [140, 45], [186, 45], [245, 15], [222, 88], [224, 133], [221, 203],
  [175, 203], [148, 175], [105, 170], [95, 212], [90, 130], [100, 85],
];

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
          <div style={{ fontSize: 40, color: "#a3a3a3" }}>jobpilot</div>
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
        <svg viewBox="0 0 383 267" width={430} height={300}>
          {SQUARES.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={40} height={40} fill="#fff" />
          ))}
        </svg>
      </div>
    ),
    { ...size }
  );
}
