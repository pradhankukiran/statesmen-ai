import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "members-api.parliament.uk",
        pathname: "/api/Members/**",
      },
      {
        // Featured portraits Parliament has no photo for (see photoCredit
        // in data/popular-pms.json).
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
  experimental: {
    // Opt the App Router into using document.startViewTransition for
    // navigations. Pairs with `@view-transition { navigation: auto }` in
    // app/globals.css for a default cross-route fade, and named
    // viewTransitionName styles on shared elements (e.g. the politician
    // portrait between landing card and profile).
    viewTransition: true,
  },
};

export default nextConfig;
