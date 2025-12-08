import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Check if credentials are configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl.startsWith("https://") &&
    supabaseAnonKey.length > 20);
};

// Only warn in browser (not during build)
if (typeof window !== "undefined" && !isSupabaseConfigured()) {
  console.error(
    "❌ Missing Supabase environment variables!\n" +
    "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
    "See ENV_SETUP.md for instructions."
  );
}

// Use placeholder values only for build-time, but we'll check at runtime
const finalUrl = supabaseUrl || "https://placeholder.supabase.co";
const finalKey = supabaseAnonKey || "placeholder-key";

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (url, options = {}) => {
      // Add better error handling for fetch failures
      return fetch(url, options).catch((error) => {
        console.error("Supabase fetch error:", {
          url: typeof url === 'string' ? url : url.toString(),
          error: error.message,
          supabaseUrl: finalUrl,
          isConfigured: isSupabaseConfigured(),
        });
        
        // Provide more context in the error
        if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
          throw new Error(
            `Failed to connect to Supabase at ${finalUrl}. ` +
            `This could be due to:\n` +
            `1. Network connectivity issues\n` +
            `2. Supabase project is paused (check https://app.supabase.com)\n` +
            `3. Incorrect Supabase URL\n` +
            `4. CORS configuration issues\n` +
            `Original error: ${error.message}`
          );
        }
        throw error;
      });
    },
  },
});

