import { afterEach, describe, expect, it, vi } from "vitest";
import { annotateImage, friendlyVisionError, supabaseUserId } from "./visionServer";

describe("friendlyVisionError", () => {
  it.each([
    ["API method is blocked", "not enabled"],
    ["API key not valid", "GOOGLE_VISION_API_KEY"],
    ["Quota exceeded", "quota exceeded"],
  ])("rewrites %s", (apiMessage, expected) => {
    const message = friendlyVisionError(403, "Forbidden", {
      error: { message: apiMessage },
    });
    expect(message).toContain(expected);
    expect(message).not.toContain("NEXT_PUBLIC_GOOGLE_VISION_API_KEY");
  });

  it("uses the HTTP status when the body is not a Vision error", () => {
    expect(friendlyVisionError(500, "Server Error", null)).toContain("Server Error");
  });
});

describe("annotateImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Google with the server key and returns labels and objects", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        responses: [
          {
            labelAnnotations: [{ description: "Jacket", score: 0.9 }],
            localizedObjectAnnotations: [{ name: "Coat", score: 0.8 }],
          },
        ],
      }),
    }));

    const result = await annotateImage(
      "aGVsbG8=",
      "server-vision-key",
      fetchImpl as unknown as typeof fetch,
    );

    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://vision.googleapis.com/v1/images:annotate?key=server-vision-key",
    );
    const request = JSON.parse(String(fetchImpl.mock.calls[0][1].body));
    expect(request.requests[0].image.content).toBe("aGVsbG8=");
    expect(result.labels).toEqual([{ description: "Jacket", score: 0.9 }]);
    expect(result.objects).toEqual([{ name: "Coat", score: 0.8 }]);
  });

  it("throws the friendly message when Google rejects the key", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { message: "API key not valid" } }),
    }));

    await expect(
      annotateImage("abc", "bad", fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow("GOOGLE_VISION_API_KEY");
  });
});

describe("supabaseUserId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the id from the Supabase user endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "user-1" }),
    }));

    await expect(
      supabaseUserId("session-token", fetchImpl as unknown as typeof fetch),
    ).resolves.toBe("user-1");
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://example.supabase.co/auth/v1/user",
    );
    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("apikey")).toBe("anon-key");
  });

  it("returns null when the session is rejected", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    await expect(
      supabaseUserId("nope", fetchImpl as unknown as typeof fetch),
    ).resolves.toBeNull();
  });
});
