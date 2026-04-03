import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.STANDALONE_BUILD === 'true' ? 'standalone' : undefined,
  serverExternalPackages: ['puppeteer', 'puppeteer-core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
