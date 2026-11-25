import type { NextConfig } from "next";

// DEPLOY_MODE=server — обычная сборка для `next start` (PM2/Docker на своём сервере).
// По умолчанию (без переменной) — standalone, как требует песочница превью.
// NEXT_PUBLIC_BASE_PATH=/kafedra-assistant — публикация по подпути (tregubovvn.ru/kafedra-assistant).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  basePath,
  output: process.env.DEPLOY_MODE === "server" ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
