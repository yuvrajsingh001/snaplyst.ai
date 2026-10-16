import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportProduct } from "@/test/fixtures";
import { exportDepopCsv } from "./depopExport";

const template = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../public/templates/depop-template.csv",
  ),
  "utf8",
);

describe("exportDepopCsv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses to export an empty selection", async () => {
    await expect(exportDepopCsv([])).rejects.toThrow("No products to export");
  });

  it("writes mapped products under the official Depop header row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => template })),
    );

    const csv = await exportDepopCsv([
      exportProduct({
        channels: {
          depopEnabled: true,
          shopifyEnabled: false,
          depop: { category: "Outerwear", domesticShippingPrice: 10 },
        },
      }),
    ]);

    const rows = Papa.parse<string[]>(csv, { header: false }).data;
    const headers = rows[1];
    const product = rows[3];
    const cell = (name: string) => product[headers.indexOf(name)];

    expect(String(rows[0][0])).toMatch(/template version/i);
    expect(cell("Description")).toBe("Wool coach jacket");
    expect(cell("Category")).toBe("Outerwear");
    expect(cell("Price")).toBe("45");
    expect(cell("Picture Hero url")).toBe("https://cdn.example/jacket.jpg");
    expect(cell("Domestic Shipping price")).toBe("10");
    expect(cell("Picture 8 url")).toBe("");
  });
});
