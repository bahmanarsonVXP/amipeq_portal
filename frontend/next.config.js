/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  /**
   * En `next dev` uniquement : /api/* est proxifié vers le gateway (évite CORS navigateur → :8787).
   * Le build statique (Pages) n’utilise pas les rewrites ; le client utilise NEXT_PUBLIC_API_URL.
   */
  async rewrites() {
    const gw = (process.env.GATEWAY_DEV_PROXY_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
    return [{ source: '/api/:path*', destination: `${gw}/api/:path*` }];
  },
};

module.exports = nextConfig;
