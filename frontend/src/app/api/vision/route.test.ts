import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 401) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Unauthorized",
    json: async () => body,
  };
}

describe("POST /api/vision", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects a missing session before calling Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/vision", {
        method: "POST",
        body: JSON.stringify({ content: "abc" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing bearer token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call Google when the server key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("GOOGLE_VISION_API_KEY", "");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/v1/user")) return jsonResponse({ id: "user-1" });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/vision", {
        method: "POST",
        headers: { Authorization: "Bearer good-token" },
        body: JSON.stringify({ content: "abc" }),
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("GOOGLE_VISION_API_KEY");
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("googleapis"))).toBe(
      false,
    );
  });

  it("annotates with the server key for a valid session", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("GOOGLE_VISION_API_KEY", "server-vision-key");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/v1/user")) return jsonResponse({ id: "user-1" });
      return jsonResponse({
        responses: [
          {
            labelAnnotations: [{ description: "Jacket", score: 0.9 }],
            localizedObjectAnnotations: [],
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/vision", {
        method: "POST",
        headers: { Authorization: "Bearer good-token", "Content-Type": "application/json" },
        body: JSON.stringify({ content: "aGVsbG8=" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      labels: [{ description: "Jacket", score: 0.9 }],
      objects: [],
    });
    const googleCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("vision.googleapis.com"),
    );
    expect(String(googleCall?.[0])).toContain("key=server-vision-key");
    expect(String(googleCall?.[0])).not.toContain("NEXT_PUBLIC");
  });
});
