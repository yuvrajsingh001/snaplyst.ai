import { supabase } from "./supabaseClient";
import {
  GuestCreditsError,
  errorDetail,
  guestCreditsErrorFromResponse,
  isAnonymousUser,
  isInsufficientCredits,
} from "./guestCredits";
import { analysisFromVisionAnnotations, analyzeImageWithVision } from "./googleVision";

export type MeteredVisionResult = {
  labels: Array<{ description: string; score: number }>;
  objects: Array<{ name: string; score: number }>;
  features: number[];
  creditsRemaining: number | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

/**
 * Analyze one image.
 * Guests go through the backend, which spends a credit before calling Google.
 * Signed-in accounts keep the existing browser call and are not metered.
 */
export async function analyzeImageWithMeteredVision(file: File): Promise<MeteredVisionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Sign in required");
  }

  if (!isAnonymousUser(session.user)) {
    const analysis = await analyzeImageWithVision(file, session.access_token);
    return { ...analysis, creditsRemaining: null };
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!backendUrl) {
    throw new Error(
      "Backend API URL not configured. Set NEXT_PUBLIC_API_URL so guest photo analysis can be metered."
    );
  }

  const dataUrl = await fileToBase64(file);
  const imageBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

  const response = await fetch(`${backendUrl}/api/vision/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  const body = await response.json().catch(() => null);
  if (isInsufficientCredits(response.status, body)) {
    throw guestCreditsErrorFromResponse(body);
  }
  if (!response.ok) {
    throw new Error(errorDetail(body, "Could not analyze that photo"));
  }

  const annotations =
    body && typeof body === "object" && "annotations" in body
      ? (body as { annotations: Parameters<typeof analysisFromVisionAnnotations>[0] }).annotations
      : null;
  if (!annotations) {
    throw new Error("Could not analyze that photo");
  }
  const analysis = analysisFromVisionAnnotations(annotations);
  const creditsRemaining =
    body && typeof body === "object" && "credits_remaining" in body &&
    typeof (body as { credits_remaining?: unknown }).credits_remaining === "number"
      ? (body as { credits_remaining: number }).credits_remaining
      : null;

  return { ...analysis, creditsRemaining };
}

export function isGuestCreditsError(error: unknown): error is GuestCreditsError {
  return error instanceof GuestCreditsError;
}
