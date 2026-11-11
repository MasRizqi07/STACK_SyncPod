import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@syncpod/shared', '@syncpod/db'],
};

export default nextConfig;

