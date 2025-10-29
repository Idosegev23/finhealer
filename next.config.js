const path = require('path');

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
      // Force pdfjs-dist to use Node.js build instead of browser build
      // pdf-parse internally imports pdf.mjs which doesn't work in Node
      const nodeModules = path.join(__dirname, 'node_modules');
      const pdfjsNodePath = path.join(nodeModules, 'pdfjs-dist/legacy/build/pdf.node.mjs');
      
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist/legacy/build/pdf.mjs': pdfjsNodePath,
        'pdfjs-dist/build/pdf.mjs': pdfjsNodePath,
        'pdfjs-dist/legacy/build/pdf.js': pdfjsNodePath,
      };
      
      // Mark as external to prevent bundling issues
      config.externals = [
        ...(config.externals || []),
        {
          'pdfjs-dist/legacy/build/pdf.mjs': `commonjs pdfjs-dist/legacy/build/pdf.node.mjs`,
        },
      ];
    }
    return config;
  },
}

module.exports = nextConfig

