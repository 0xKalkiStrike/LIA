import type { NextConfig } from "next";

// The FastAPI backend (api/server.py) runs on 127.0.0.1:8001 (see config/settings.json).
// In dev we proxy same-origin /api and /static calls to it so the browser never
// hits CORS and the token/cookie story stays simple. Override with BACKEND_ORIGIN.
const BACKEND = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
      { source: "/static/:path*", destination: `${BACKEND}/static/:path*` },
    ];
  },
};

export default nextConfig;
