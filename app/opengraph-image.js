import { ImageResponse } from "next/og";

export const alt = "jobpilot — apply where you qualify";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The shield mark (same paths as components/logo.js).
const SHIELD = "M 22,5 L 78,5 L 95,20 L 95,58 L 50,101 L 5,58 L 5,20 Z";
const HOOK_TOP = "M 30,24 L 70,24 L 58,39 L 45,39 L 45,54 L 30,70 Z";
const HOOK_BOTTOM = "M 70,78 L 30,78 L 42,63 L 55,63 L 55,48 L 70,32 Z";

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
        <svg viewBox="0 0 100 106" width={320} height={339}>
          <path d={SHIELD} fill="#fff" />
          <path d={HOOK_TOP} fill="#000" />
          <path d={HOOK_BOTTOM} fill="#000" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
