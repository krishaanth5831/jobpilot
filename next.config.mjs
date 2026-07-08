/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (pdf.js) loads its worker module at runtime; bundling it
  // breaks the worker path, so resolve it from node_modules instead.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
