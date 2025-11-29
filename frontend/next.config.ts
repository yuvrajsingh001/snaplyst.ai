import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Note: NEXT_PUBLIC_* variables are automatically exposed to client-side code
  // No need to manually list them here unless you want to override values
  
  // Increase body size limit for API routes (base64 images can be large)
  // Default is 1MB, increase to 10MB for image uploads
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default nextConfig;
