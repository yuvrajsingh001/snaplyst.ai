import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMiddleware() {
  vi.resetModules();
  return import("@/middleware");
}

describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("lets the request through when maintenance mode is off", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "false");
    const { middleware } = await loadMiddleware();
    const { NextRequest } = await import("next/server");

    const response = middleware(
      new NextRequest("https://snaplyst-ai.vercel.app/profile"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").not.toContain("text/html");
  });

  it("returns the maintenance page when the flag is true", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "true");
    const { middleware } = await loadMiddleware();
    const { NextRequest } = await import("next/server");

    const response = middleware(
      new NextRequest("https://snaplyst-ai.vercel.app/profile"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Under Maintenance");
  });
});
