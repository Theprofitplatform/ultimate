import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable turbopack for faster builds
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // Disable strict ESLint for build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: [
      'localhost',
      'ultimateseo.com',
      'api.ultimateseo.com'
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Redirect configuration
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
        has: [
          {
            type: 'cookie',
            key: 'auth_tokens',
          },
        ],
      },
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },

  // Webpack configuration
  webpack(config, { isServer }) {
    // Optimize bundle
    config.optimization.minimize = true;
    
    // Add SVG support
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // Build output configuration
  output: 'standalone',
  outputFileTracingRoot: '/home/avi/projects/ultimate',

  // Compression
  compress: true,

  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    reactStrictMode: true,
  }),

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    reactStrictMode: true,
    swcMinify: true,
    compiler: {
      removeConsole: {
        exclude: ['error'],
      },
    },
    // Enable static optimization
    trailingSlash: false,
    // Asset optimization
    assetPrefix: process.env.CDN_URL || '',
  }),
};

export default nextConfig;
