import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportProduct } from "@/test/fixtures";
import { exportShopifyCsv } from "./shopifyExport";

const template = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../public/templates/shopify-template.csv",
  ),
  "utf8",
);

describe("exportShopifyCsv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses to export an empty selection", async () => {
    await expect(exportShopifyCsv([])).rejects.toThrow("No products to export");
  });

  it("does not treat extra image rows as a duplicate handle", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => template })),
    );

    await exportShopifyCsv([
      exportProduct({
        images: [
          { id: "img-1", storage_path: "a.jpg", publicUrl: "https://cdn.example/a.jpg" },
          { id: "img-2", storage_path: "b.jpg", publicUrl: "https://cdn.example/b.jpg" },
        ],
      }),
    ]);

    expect(warn.mock.calls.some((call) => String(call[0]).includes("Duplicate handle"))).toBe(
      false,
    );
  });

  it("warns once when two products generate the same handle", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => template })),
    );

    await exportShopifyCsv([
      exportProduct({ id: "a", title: "Vintage Jacket" }),
      exportProduct({ id: "b", title: "Vintage Jacket" }),
    ]);

    const duplicates = warn.mock.calls.filter((call) =>
      String(call[0]).includes('Duplicate handle "vintage-jacket"'),
    );
    expect(duplicates).toHaveLength(1);
  });

  it("emits one Shopify row per image using the official columns", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => template })),
    );

    const csv = await exportShopifyCsv([
      exportProduct({
        images: [
          {
            id: "img-1",
            storage_path: "a.jpg",
            publicUrl: "https://cdn.example/a.jpg",
          },
          {
            id: "img-2",
            storage_path: "b.jpg",
            publicUrl: "https://cdn.example/b.jpg",
          },
        ],
      }),
    ]);

    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]).toMatchObject({
      Handle: "vintage-jacket",
      Title: "Vintage Jacket",
      Vendor: "Pendleton",
      "Variant SKU": "JKT-1",
      "Variant Price": "45",
      "Image Src": "https://cdn.example/a.jpg",
      "Image Position": "1",
      Status: "draft",
    });
    expect(parsed.data[1]["Image Src"]).toBe("https://cdn.example/b.jpg");
    expect(parsed.data[1]["Variant SKU"]).toBe("");
    expect(parsed.meta.fields).toContain("SEO Description");
  });
});
