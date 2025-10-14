/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  async rewrites() {
    const AUTH = process.env.NEXT_PUBLIC_AUTH_API_URL;
    const PRODUCTS = process.env.NEXT_PUBLIC_PRODUCTS_API_URL;
    return [
      {
        source: "/api/auth/:path*",
        destination: `${AUTH}/auth/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${AUTH}/users/:path*`,
      },
      // si tu health check está en el mismo backend:
      {
        source: "/api/health",
        destination: `${AUTH}/health`,
      },
      {
        source: "/api/careers/:path*",
        destination: `${AUTH}/careers/:path*`,
      },
      {
        source: "/api/products/:path*", 
        destination: `${PRODUCTS}/api/products/:path*`
      }
    ];
  },
};

export default nextConfig;
