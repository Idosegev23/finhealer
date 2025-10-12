/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com'], // Google profile images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore pdf-parse test files during build
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };

      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'canvas',
      });
    }

    // Ignore test data files
    config.module = config.module || {};
    config.module.exprContextCritical = false;

    return config;
  },
}

module.exports = nextConfig

