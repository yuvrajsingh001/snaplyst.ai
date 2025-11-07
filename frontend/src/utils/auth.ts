import { supabase } from "@/lib/supabaseClient";

/**
 * Checks if user is authenticated via Supabase
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Gets the current user from Supabase
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Signs out the user via Supabase
 */
export async function signOut() {
  await supabase.auth.signOut();
}

