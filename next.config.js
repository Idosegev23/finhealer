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
      // Externalize canvas dependencies to prevent bundling issues
      // pdf-parse uses pdfjs-dist which tries to load canvas, but we don't need it for text extraction
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'commonjs canvas',
        '@napi-rs/canvas': 'commonjs @napi-rs/canvas',
      });
    }
    return config;
  },
}

module.exports = nextConfig

