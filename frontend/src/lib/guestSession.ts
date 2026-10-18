import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  friendlyAnonymousError,
  interpretGuestGrant,
  type GuestGrantResult,
} from "./guestCredits";

function backendUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error(
      "Backend API URL not configured. Set NEXT_PUBLIC_API_URL to the background-removal service."
    );
  }
  return url;
}

export async function syncGuestSession(accessToken: string): Promise<GuestGrantResult> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl()}/api/guest/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    throw new Error(
      `Could not reach the background service to start guest credits. ${message}`
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : `Guest session failed (${response.status})`;
    throw new Error(detail);
  }
  return interpretGuestGrant(body);
}

/**
 * Sign in anonymously (or reuse the current anonymous session) and ask the
 * backend to grant the 5-credit balance. The grant is idempotent.
 */
export async function continueAsGuest(): Promise<GuestGrantResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session && session.user.is_anonymous !== true) {
    return { status: "ready", isGuest: false, creditsRemaining: null, unlimited: true };
  }

  let accessToken = session?.access_token;
  if (!accessToken) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(
        friendlyAnonymousError(error?.message || "Could not start a guest session")
      );
    }
    accessToken = data.session.access_token;
  }

  return syncGuestSession(accessToken);
}

export async function ensureGuestSession(): Promise<GuestGrantResult | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user.is_anonymous) return null;
  return syncGuestSession(session.access_token);
}
