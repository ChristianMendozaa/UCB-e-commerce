/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Custom loader targets our own GET /api/images/{id}?w=<width> variant
    // endpoint (see lib/image-loader.ts) instead of Next's built-in
    // /_next/image optimizer. Avoids needing `sharp` in the node:22-alpine
    // web container and an extra internal hop; the resize CPU lives in the
    // images service instead of the container that serves all of the HTML.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    deviceSizes: [640, 828, 1080],
    imageSizes: [96, 128, 320],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
    ]
  },
};

export default nextConfig;
