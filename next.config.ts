import type { NextConfig } from "next";

// DEPLOY_MODE=server — обычная сборка для `next start` (PM2/Docker на своём сервере).
// По умолчанию (без переменной) — standalone, как требует песочница превью.
const nextConfig: NextConfig = {
  output: process.env.DEPLOY_MODE === "server" ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
