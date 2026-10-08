import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // typecheck en verde: `bun run typecheck` (tsc --noEmit) pasa en todo src/,
  // así que el build vuelve a validar tipos (sin ignoreBuildErrors).
  reactStrictMode: false,
};

export default nextConfig;
