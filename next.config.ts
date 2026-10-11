import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,

  allowedDevOrigins: [
    "5e06-152-58-107-228.ngrok-free.app",
  ],
};

export default nextConfig;
