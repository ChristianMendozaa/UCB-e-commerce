/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  async rewrites() {
    const base = process.env.NEXT_PUBLIC_AUTH_API_URL; // p.ej. http://localhost:8001 o https://auth.ucb.com
    if (!base) {
      console.warn("[next.config] WARNING: AUTH_API_URL no está definida");
      return [];
    }
    return [
      {
        source: "/api/auth/:path*",
        destination: `${base}/auth/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${base}/users/:path*`,
      },
      // si tu health check está en el mismo backend:
      {
        source: "/api/health",
        destination: `${base}/health`,
      },
    ];
  },
};

export default nextConfig;
