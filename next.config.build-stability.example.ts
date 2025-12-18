import type { NextConfig } from "next";
import path from "node:path";
import { withBuildStability } from "./src/lib/build-stability/next-integration";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
} as NextConfig;

// Apply build stability plugin
export default withBuildStability({
  enabled: process.env.NODE_ENV === 'production',
  mode: 'strict',
  sourceDir: 'src',
  skipEnvironmentValidation: false,
  skipPreBuildValidation: false,
  failOnWarnings: false,
  outputValidationResults: true
})(nextConfig);