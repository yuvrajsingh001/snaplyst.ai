import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Note: NEXT_PUBLIC_* variables are automatically exposed to client-side code
  // No need to manually list them here unless you want to override values
};

export default nextConfig;
