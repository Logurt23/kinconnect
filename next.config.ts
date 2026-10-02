import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Vault and listing photos are uploaded through server actions.
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
