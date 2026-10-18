import { describe, expect, it } from "vitest";
import {
  GUEST_ACCOUNTS_PER_IP,
  GUEST_IP_WINDOW_HOURS,
  GUEST_STARTING_CREDITS,
  GuestCreditsError,
  friendlyAnonymousError,
  guestCreditsErrorFromResponse,
  guestCreditsLabel,
  interpretGuestGrant,
  isAnonymousUser,
  isInsufficientCredits,
} from "./guestCredits";
import { analysisFromVisionAnnotations } from "./googleVision";

describe("guest credit rules", () => {
  it("starts guests at 5 credits and caps new trials per network", () => {
    expect(GUEST_STARTING_CREDITS).toBe(5);
    expect(GUEST_ACCOUNTS_PER_IP).toBe(3);
    expect(GUEST_IP_WINDOW_HOURS).toBe(24);
  });

  it("treats only anonymous Supabase users as guests", () => {
    expect(isAnonymousUser({ is_anonymous: true })).toBe(true);
    expect(isAnonymousUser({ is_anonymous: false })).toBe(false);
    expect(isAnonymousUser(null)).toBe(false);
    expect(isAnonymousUser({})).toBe(false);
  });

  it("labels the remaining balance", () => {
    expect(guestCreditsLabel(5)).toBe("5 guest credits left");
    expect(guestCreditsLabel(1)).toBe("1 guest credit left");
    expect(guestCreditsLabel(0)).toBe("0 guest credits left");
  });

  it("recognizes the server's out-of-credits payload", () => {
    const body = {
      detail: {
        error: "insufficient_credits",
        message: "You're out of guest credits.",
        credits_remaining: 0,
      },
    };
    expect(isInsufficientCredits(402, body)).toBe(true);
    expect(isInsufficientCredits(500, body)).toBe(false);
    expect(isInsufficientCredits(402, { detail: "Sign in required" })).toBe(false);

    const error = guestCreditsErrorFromResponse(body);
    expect(error).toBeInstanceOf(GuestCreditsError);
    expect(error.creditsRemaining).toBe(0);
    expect(error.message).toContain("out of guest credits");
  });

  it("turns a grant response into a ready balance or a quota block", () => {
    expect(
      interpretGuestGrant({
        ok: true,
        is_guest: true,
        unlimited: false,
        credits_remaining: 5,
      }),
    ).toEqual({
      status: "ready",
      isGuest: true,
      creditsRemaining: 5,
      unlimited: false,
    });

    expect(
      interpretGuestGrant({
        ok: false,
        error: "guest_quota_exceeded",
        credits_remaining: 0,
      }),
    ).toEqual({ status: "quota", creditsRemaining: 0 });
  });

  it("explains a disabled anonymous provider", () => {
    expect(friendlyAnonymousError("Anonymous sign-ins are disabled")).toContain(
      "Anonymous sign-ins",
    );
    expect(friendlyAnonymousError("Invalid login credentials")).toBe("Invalid login credentials");
  });
});

describe("analysisFromVisionAnnotations", () => {
  it("normalizes label and object scores the same way the browser call does", () => {
    const result = analysisFromVisionAnnotations({
      labelAnnotations: [
        { description: "Jacket", score: 0.9 },
        { description: "Wool", score: 0.4 },
      ],
      localizedObjectAnnotations: [{ name: "Coat", score: 0.8 }],
    });

    expect(result.labels.map((label) => label.description)).toEqual(["Jacket", "Wool"]);
    expect(result.objects[0]?.name).toBe("Coat");
    const magnitude = Math.sqrt(result.features.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1);
  });
});
