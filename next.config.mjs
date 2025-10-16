/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  async rewrites() {
    const AUTH = process.env.NEXT_PUBLIC_AUTH_API_URL;
    const PRODUCTS = process.env.NEXT_PUBLIC_PRODUCTS_API_URL;
    const ORDERS = process.env.NEXT_PUBLIC_ORDERS_API_URL;
    return [
      {
        source: "/api/auth/:path*",
        destination: `${AUTH}/auth/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${AUTH}/users/:path*`,
      },
      {
        source: "/api/careers/:path*",
        destination: `${AUTH}/careers/:path*`,
      },
      // {
      //   source: "/api/products/:path*",
      //   destination: `${PRODUCTS}/api/products/:path*`
      // },
      // {
      //   source: "/api/orders/:path*",
      //   destination: `${ORDERS}/orders/:path*`
      // },
    ];
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
