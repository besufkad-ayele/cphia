import type { NextConfig } from "next";

/** Long-lived browser cache for hashed/static public brand assets. */
const STATIC_CACHE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ['heic2any'],
  async headers() {
    return [
      {
        source: '/:file(cphia-2026-logo|cphia-africa-logo|cphia-logo|hero).:ext(png|jpg|jpeg|webp|svg|gif)',
        headers: [{ key: 'Cache-Control', value: STATIC_CACHE }],
      },
      {
        source: '/animation/:path*',
        headers: [{ key: 'Cache-Control', value: STATIC_CACHE }],
      },
      {
        source: '/vendor/:path*',
        headers: [{ key: 'Cache-Control', value: STATIC_CACHE }],
      },
      {
        source: '/:path*.:ext(woff2|woff|ttf|otf)',
        headers: [{ key: 'Cache-Control', value: STATIC_CACHE }],
      },
    ];
  },
};

export default nextConfig;
