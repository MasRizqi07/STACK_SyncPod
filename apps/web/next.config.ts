import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@syncpod/shared', '@syncpod/db'],
  env: {
    NEXT_PUBLIC_REALTIME_MODE: process.env.NEXT_PUBLIC_REALTIME_MODE || 'fake',
  },
};

export default nextConfig;

