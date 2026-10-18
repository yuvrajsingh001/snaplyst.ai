import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { generateCsvFromTemplate } from "./fromTemplate";

const templatesDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/templates",
);

function mockFetch(body: BodyInit, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 404,
      text: async () => (typeof body === "string" ? body : ""),
      arrayBuffer: async () => body,
    })),
  );
}

describe("generateCsvFromTemplate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the Depop version and helper rows and fills headers case-insensitively", async () => {
    mockFetch(
      [
        "Template version: 5,note",
        "Description,Price,Brand",
        "keep this helper,price help,brand help",
      ].join("\n"),
    );

    const csv = await generateCsvFromTemplate("/templates/depop-template.csv", [
      { description: "Wool jacket", Price: 45, Brand: "Pendleton" },
    ]);

    const lines = csv.replace(/\r\n/g, "\n").split("\n");
    expect(lines[0]).toContain("Template version: 5");
    expect(lines[1]).toContain("Description,Price,Brand");
    expect(lines[2]).toContain("keep this helper");
    expect(lines[3]).toContain("Wool jacket");
    expect(lines[3]).toContain("45");
    expect(lines[3]).toContain("Pendleton");
  });

  it("orders a standard template by its header row and blanks missing cells", async () => {
    mockFetch("Handle,Title,Vendor\n");

    const csv = await generateCsvFromTemplate("/templates/shopify-template.csv", [
      { Title: "Tee", Handle: "tee", Ignored: "nope" },
    ]);

    const lines = csv.replace(/\r\n/g, "\n").split("\n");
    expect(lines[0]).toBe("Handle,Title,Vendor");
    expect(lines[1]).toBe("tee,Tee,");
    expect(csv).not.toContain("Ignored");
  });

  it("reads headers from an xlsx template", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Handle", "Title"],
      ["", ""],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Products");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    mockFetch(bytes);

    const csv = await generateCsvFromTemplate("/templates/shopify-template.xlsx", [
      { Handle: "tee", Title: "Tee" },
    ]);

    expect(csv).toContain("Handle,Title");
    expect(csv).toContain("tee,Tee");
  });

  it("throws when the template cannot be loaded or has no headers", async () => {
    mockFetch("", false);
    await expect(generateCsvFromTemplate("/templates/missing.csv", [])).rejects.toThrow(
      "Failed to load template CSV",
    );

    mockFetch("\n");
    await expect(generateCsvFromTemplate("/templates/empty.csv", [])).rejects.toThrow(
      /no valid headers|no rows|no header row/,
    );
  });

  it("fills the real Depop template from a product row", async () => {
    mockFetch(readFileSync(resolve(templatesDir, "depop-template.csv"), "utf8"));

    const csv = await generateCsvFromTemplate("/templates/depop-template.csv", [
      {
        Description: "Wool coach jacket",
        Price: "45",
        Brand: "Pendleton",
        "Picture Hero url": "https://cdn.example/jacket.jpg",
      },
    ]);

    expect(csv).toContain("Template version");
    expect(csv).toContain("Wool coach jacket");
    expect(csv).toContain("https://cdn.example/jacket.jpg");
    const headerLine = csv.split("\n").find((line) => line.startsWith("Description,"));
    expect(headerLine).toContain("Picture Hero url");
  });
});
