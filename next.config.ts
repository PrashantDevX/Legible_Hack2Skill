import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) resolves its worker file by path at runtime;
  // bundling it into the server chunks breaks that lookup. Load it as a
  // normal node_module instead.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
