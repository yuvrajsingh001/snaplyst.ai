import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeImageWithVision,
  calculateSimilarityPercentage,
  cosineSimilarity,
  groupSimilarImagesWithVision,
} from "./googleVision";

class FakeFileReader {
  result: string | null = "data:image/png;base64,aGVsbG8=";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    this.onload?.();
  }
}

describe("cosine similarity", () => {
  it("returns 1 for identical vectors and 0 for orthogonal or empty ones", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(calculateSimilarityPercentage([1, 0], [1, 0])).toBeCloseTo(100);
  });

  it("returns the cosine as a percentage", () => {
    const other: [number, number] = [0.5, Math.sqrt(0.75)];
    expect(cosineSimilarity([1, 0], other)).toBeCloseTo(0.5);
    expect(calculateSimilarityPercentage([1, 0], other)).toBeCloseTo(50);
  });
});

describe("groupSimilarImagesWithVision", () => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
  const image = (id: string, features: number[]) => ({
    id,
    features,
    labels: [],
    file,
  });

  it("drops singletons and groups photos above the threshold", () => {
    const groups = groupSimilarImagesWithVision(
      [
        image("a", [1, 0]),
        image("b", [1, 0]),
        image("c", [0, 1]),
      ],
      50,
    );

    expect(groups.map((group) => group.map((item) => item.id))).toEqual([["a", "b"]]);
  });

  it("requires a candidate to match every member already in the group", () => {
    const half: [number, number] = [0.5, Math.sqrt(0.75)];
    const groups = groupSimilarImagesWithVision(
      [image("a", [1, 0]), image("b", half), image("c", [0, 1])],
      50,
    );

    // b matches a (50%) but c matches b and not a, so c stays out.
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([["a", "b"]]);
  });

  it("uses an inclusive threshold and returns nothing when nothing matches", () => {
    const half: [number, number] = [0.5, Math.sqrt(0.75)];
    expect(
      groupSimilarImagesWithVision([image("a", [1, 0]), image("b", half)], 50),
    ).toHaveLength(1);
    expect(
      groupSimilarImagesWithVision([image("a", [1, 0]), image("b", half)], 50.1),
    ).toEqual([]);
    expect(groupSimilarImagesWithVision([], 50)).toEqual([]);
  });
});

describe("analyzeImageWithVision", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks the server route for annotations and never sends a Vision key", async () => {
    vi.stubGlobal("FileReader", FakeFileReader);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        labels: [
          { description: "Jacket", score: 0.9 },
          { description: "Wool", score: 0.4 },
        ],
        objects: [{ name: "Coat", score: 0.8 }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeImageWithVision(
      new File(["bytes"], "jacket.jpg", { type: "image/jpeg" }),
      "session-token",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vision",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
      }),
    );
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request).toEqual({ content: "aGVsbG8=" });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("googleapis");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("apiKey");
    expect(result.labels.map((label) => label.description)).toEqual(["Jacket", "Wool"]);
    expect(result.objects[0].name).toBe("Coat");

    const magnitude = Math.sqrt(result.features.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1);
  });

  it("surfaces the server error and does not call Google directly", async () => {
    vi.stubGlobal("FileReader", FakeFileReader);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: "Google Vision API quota exceeded." }),
      })),
    );

    await expect(
      analyzeImageWithVision(new File(["x"], "a.jpg"), "session-token"),
    ).rejects.toThrow("quota exceeded");
  });

  it("requires an access token", async () => {
    await expect(analyzeImageWithVision(new File(["x"], "a.jpg"), "")).rejects.toThrow(
      "Not authenticated",
    );
  });
});
