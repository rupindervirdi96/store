import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @store/shared is compiled to CommonJS in packages/shared/dist.
  transpilePackages: ['@store/shared'],
};

export default nextConfig;
