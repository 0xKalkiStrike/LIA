import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  // Performance optimizations for low-end devices
  productionBrowserSourceMaps: false,
  compress: true,
  swcMinify: true,
  optimizeFonts: true,
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [320, 640, 750, 828, 1080, 1200, 1920],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
      { source: "/static/:path*", destination: `${BACKEND}/static/:path*` },
    ];
  },
  webpack: (config) => {
    config.optimization = {
      ...config.optimization,
      minimize: true,
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          default: false,
          vendors: false,
          monaco: {
            test: /[\\/]node_modules[\\/]@monaco-editor[\\/]/,
            name: "monaco",
            priority: 10,
          },
          three: {
            test: /[\\/]node_modules[\\/](three|@pixiv)[\\/]/,
            name: "three",
            priority: 10,
          },
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
    };
    return config;
  },
};

export default nextConfig;
