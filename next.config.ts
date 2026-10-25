import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverless output for Vercel deployment
  // outputFileTracingRoot is not needed for PostgreSQL (was required for better-sqlite3 native binary)
};

export default nextConfig;
