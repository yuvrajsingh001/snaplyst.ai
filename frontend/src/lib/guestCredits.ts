/**
 * Guest credit rules shared by the UI and the tests.
 * The database is the source of truth (see supabase/migrations). These helpers
 * only interpret responses and decide what to show.
 */

export const GUEST_STARTING_CREDITS = 5;
export const GUEST_ACCOUNTS_PER_IP = 3;
export const GUEST_IP_WINDOW_HOURS = 24;

export const OUT_OF_CREDITS_MESSAGE =
  "You're out of guest credits. Create a free account to keep analyzing photos and removing backgrounds.";

type MaybeAnonymous = {
  is_anonymous?: boolean;
} | null | undefined;

export function isAnonymousUser(user: MaybeAnonymous): boolean {
  return user?.is_anonymous === true;
}

export function guestCreditsLabel(credits: number): string {
  if (credits === 1) return "1 guest credit left";
  return `${credits} guest credits left`;
}

export class GuestCreditsError extends Error {
  readonly creditsRemaining: number;
  readonly code = "insufficient_credits" as const;

  constructor(message: string, creditsRemaining: number) {
    super(message);
    this.name = "GuestCreditsError";
    this.creditsRemaining = creditsRemaining;
  }
}

type ErrorBody = {
  detail?: unknown;
  error?: unknown;
  credits_remaining?: unknown;
  ok?: unknown;
  is_guest?: unknown;
  unlimited?: unknown;
};

function asRecord(body: unknown): ErrorBody | null {
  if (!body || typeof body !== "object") return null;
  return body as ErrorBody;
}

export function errorDetail(body: unknown, fallback: string): string {
  const record = asRecord(body);
  if (!record) return fallback;
  const { detail } = record;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function isInsufficientCredits(status: number, body: unknown): boolean {
  if (status !== 402) return false;
  const record = asRecord(body);
  const detail = record?.detail;
  if (!detail || typeof detail !== "object") return false;
  return (detail as { error?: unknown }).error === "insufficient_credits";
}

export function guestCreditsErrorFromResponse(body: unknown): GuestCreditsError {
  const record = asRecord(body);
  const detail = record?.detail;
  const detailRecord = detail && typeof detail === "object" ? (detail as { message?: unknown; credits_remaining?: unknown }) : null;
  const remaining = typeof detailRecord?.credits_remaining === "number" ? detailRecord.credits_remaining : 0;
  const message =
    typeof detailRecord?.message === "string" && detailRecord.message.trim()
      ? detailRecord.message
      : OUT_OF_CREDITS_MESSAGE;
  return new GuestCreditsError(message, remaining);
}

export type GuestGrantResult =
  | {
      status: "ready";
      isGuest: boolean;
      creditsRemaining: number | null;
      unlimited: boolean;
    }
  | {
      status: "quota";
      creditsRemaining: number;
    };

export function interpretGuestGrant(body: unknown): GuestGrantResult {
  const record = asRecord(body);
  if (!record) {
    throw new Error("Could not start a guest session");
  }
  if (record.error === "guest_quota_exceeded") {
    const remaining = typeof record.credits_remaining === "number" ? record.credits_remaining : 0;
    return { status: "quota", creditsRemaining: remaining };
  }
  if (record.ok === false) {
    const message = typeof record.error === "string" ? record.error : "Could not start a guest session";
    throw new Error(message);
  }
  return {
    status: "ready",
    isGuest: record.is_guest === true,
    creditsRemaining: typeof record.credits_remaining === "number" ? record.credits_remaining : null,
    unlimited: record.unlimited === true,
  };
}

export function friendlyAnonymousError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("anonymous") && (lower.includes("disabled") || lower.includes("not enabled"))) {
    return "Guest access isn't turned on yet. Sign up, or enable Anonymous sign-ins in the Supabase dashboard.";
  }
  return message;
}
