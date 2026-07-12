/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (pdf.js) loads its worker module at runtime; bundling it
  // breaks the worker path, so resolve it from node_modules instead.
  // pdfkit reads its font data files from disk at runtime — same problem.
  serverExternalPackages: ["pdf-parse", "pdfkit"],
  // No floating dev-tools badge (it also photobombs screenshots);
  // runtime error overlays still appear.
  devIndicators: false,
};

export default nextConfig;
