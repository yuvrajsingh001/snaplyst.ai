import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Explicitly expose environment variables
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_GOOGLE_VISION_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      },
};

export default nextConfig;
