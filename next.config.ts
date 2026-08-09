import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "open.api.nexon.com",
        pathname: "/static/maplestory/character/look/**",
      },
    ],
  },
};

export default nextConfig;
