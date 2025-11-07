import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Check if credentials are configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== "https://placeholder.supabase.co" && 
    supabaseAnonKey !== "placeholder-key" &&
    supabaseUrl.startsWith("https://") &&
    supabaseAnonKey.length > 20);
};

// Only warn in browser (not during build)
if (typeof window !== "undefined" && !isSupabaseConfigured()) {
  console.error(
    "❌ Missing Supabase environment variables!\n" +
    "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
    "See SUPABASE_SETUP.md for instructions."
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
});

