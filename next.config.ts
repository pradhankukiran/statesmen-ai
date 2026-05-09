import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "members-api.parliament.uk",
        pathname: "/api/Members/**",
      },
    ],
  },
};

export default nextConfig;
