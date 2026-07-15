/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (pdf.js) loads its worker module at runtime; bundling it
  // breaks the worker path, so resolve it from node_modules instead.
  // pdfkit reads its font data files from disk at runtime — same problem.
  serverExternalPackages: ["pdf-parse", "pdfkit"],
  // Files Vercel's dependency tracing misses because they're loaded through
  // dynamic requires. Without the @napi-rs/canvas native binary, pdfjs can't
  // polyfill DOMMatrix and the resume upload route dies on import; without
  // the .afm font metrics, pdfkit can't typeset the resume PDF.
  outputFileTracingIncludes: {
    "/api/resume": [
      "node_modules/@napi-rs/canvas/**",
      "node_modules/@napi-rs/canvas-linux-x64-gnu/**",
    ],
    "/api/resume/pdf": ["node_modules/pdfkit/js/data/**"],
  },
  // No floating dev-tools badge (it also photobombs screenshots);
  // runtime error overlays still appear.
  devIndicators: false,
};

export default nextConfig;
