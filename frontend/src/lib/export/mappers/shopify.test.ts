import { describe, expect, it } from "vitest";
import { exportProduct } from "@/test/fixtures";
import { toShopifyRows } from "./shopify";

const longDescription = "a".repeat(161);

describe("toShopifyRows", () => {
  it("slugifies the title when no handle is set", () => {
    const [row] = toShopifyRows(
      exportProduct({ title: "  Rock & Roll --- Jacket!  " }),
    );

    expect(row.Handle).toBe("rock-roll-jacket");
    expect(row.Title).toBe("  Rock & Roll --- Jacket!  ");
    expect(row["SEO Title"]).toBe("  Rock & Roll --- Jacket!  ");
  });

  it("keeps an explicit handle and falls back to the product id without a title", () => {
    expect(
      toShopifyRows(
        exportProduct({
          channels: {
            depopEnabled: false,
            shopifyEnabled: true,
            shopify: { handle: "custom-handle" },
          },
        }),
      )[0].Handle,
    ).toBe("custom-handle");

    expect(
      toShopifyRows(exportProduct({ id: "abc", title: "" }))[0].Handle,
    ).toBe("product-abc");
  });

  it("wraps the description, truncates SEO text, and applies draft defaults", () => {
    const [row] = toShopifyRows(
      exportProduct({
        description: longDescription,
        brand: "Nike",
        tags: ["sale", "outerwear"],
      }),
    );

    expect(row["Body (HTML)"]).toBe(`<p>${longDescription}</p>`);
    expect(row["SEO Description"]).toBe(`${"a".repeat(157)}...`);
    expect(row["SEO Description"]).toHaveLength(160);
    expect(row.Vendor).toBe("Nike");
    expect(row["Product Category"]).toBe("Outerwear");
    expect(row.Tags).toBe("sale, outerwear");
    expect(row.Published).toBe("TRUE");
    expect(row["Gift Card"]).toBe("FALSE");
    expect(row.Status).toBe("draft");
    expect(row["Variant Requires Shipping"]).toBe("TRUE");
    expect(row["Variant Taxable"]).toBe("TRUE");
    expect(row["Option1 Name"]).toBe("Size");
    expect(row["Option1 Value"]).toBe("M");
    expect(row["Option2 Value"]).toBe("");
  });

  it("does not truncate a description that is already 160 characters", () => {
    const description = "b".repeat(160);
    const [row] = toShopifyRows(exportProduct({ description }));
    expect(row["SEO Description"]).toBe(description);
  });

  it("puts variant fields on the first image row only", () => {
    const rows = toShopifyRows(
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
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "Image Src": "https://cdn.example/a.jpg",
      "Image Position": "1",
      "Variant SKU": "JKT-1",
      "Variant Price": "45",
      "Variant Grams": "500",
      "Variant Weight Unit": "g",
      "Variant Inventory Qty": "0",
    });
    expect(rows[1]).toMatchObject({
      "Image Src": "https://cdn.example/b.jpg",
      "Image Position": "2",
      "Variant SKU": "",
      "Variant Price": "",
      "Variant Grams": "",
      Handle: rows[0].Handle,
      Title: "Vintage Jacket",
    });
  });

  it("still emits one row when the product has no images", () => {
    const [row] = toShopifyRows(exportProduct({ images: [] }));
    expect(row["Image Src"]).toBe("");
    expect(row["Image Position"]).toBe("1");
    expect(row["Variant SKU"]).toBe("JKT-1");
  });

  it.each([
    ["g", 2, "2"],
    ["kg", 1.5, "1500"],
    ["lb", 1, "453.592"],
    ["oz", 1, "28.3495"],
  ] as const)("converts %s weight into variant grams", (unit, weight, grams) => {
    const [row] = toShopifyRows(
      exportProduct({ weight, weightUnit: unit, sku: null }),
    );
    expect(row["Variant Grams"]).toBe(grams);
    expect(row["Variant Weight Unit"]).toBe(unit);
  });

  it("keeps a weight of 0 as zero grams", () => {
    const [row] = toShopifyRows(exportProduct({ weight: 0, sku: null }));
    expect(row["Variant Grams"]).toBe("0");
  });

  it("keeps an explicit variant weight of 0", () => {
    const [row] = toShopifyRows(
      exportProduct({
        weight: 500,
        channels: {
          depopEnabled: false,
          shopifyEnabled: true,
          shopify: { variantGrams: 0 },
        },
      }),
    );
    expect(row["Variant Grams"]).toBe("0");
  });

  it("honours explicit shipping and tax flags", () => {
    const [row] = toShopifyRows(
      exportProduct({
        channels: {
          depopEnabled: false,
          shopifyEnabled: true,
          shopify: {
            status: "active",
            vendor: "Studio",
            bodyHtml: "<p>Custom</p>",
            seoDescription: "Short",
            variantRequiresShipping: false,
            variantTaxable: false,
            option2Name: "Color",
            option2Value: "Navy",
            variantPrice: 55,
            variantCompareAtPrice: 80,
          },
        },
      }),
    );

    expect(row).toMatchObject({
      Status: "active",
      Vendor: "Studio",
      "Body (HTML)": "<p>Custom</p>",
      "SEO Description": "Short",
      "Variant Requires Shipping": "FALSE",
      "Variant Taxable": "FALSE",
      "Option2 Name": "Color",
      "Option2 Value": "Navy",
      "Variant Price": "55",
      "Variant Compare At Price": "80",
    });
  });

  it("emits one variant block per variant and restarts image positions", () => {
    const rows = toShopifyRows(
      exportProduct({
        images: [
          { id: "red", storage_path: "red.jpg", publicUrl: "https://cdn.example/red.jpg" },
          { id: "red-2", storage_path: "red-2.jpg", publicUrl: "https://cdn.example/red-2.jpg" },
          { id: "blue", storage_path: "blue.jpg", publicUrl: "https://cdn.example/blue.jpg" },
        ],
        channels: {
          depopEnabled: false,
          shopifyEnabled: true,
          shopify: {
            variants: [
              {
                option1Name: "Size",
                option1Value: "S",
                variantSku: "S",
                variantPrice: 40,
                imageIds: ["red", "red-2"],
              },
              {
                option1Name: "Size",
                option1Value: "L",
                variantSku: "L",
                variantPrice: 42,
                imageIds: ["missing"],
              },
            ],
          },
        },
      }),
    );

    expect(rows.map((row) => [row["Variant SKU"], row["Image Position"], row["Image Src"]])).toEqual([
      ["S", "1", "https://cdn.example/red.jpg"],
      ["", "2", "https://cdn.example/red-2.jpg"],
      ["L", "1", ""],
    ]);
    expect(rows[2]["Option1 Value"]).toBe("L");
    expect(rows[2]["Variant Price"]).toBe("42");
  });

  it("treats an empty imageIds list as every product image", () => {
    const rows = toShopifyRows(
      exportProduct({
        images: [
          { id: "a", storage_path: "a.jpg", publicUrl: "https://cdn.example/a.jpg" },
          { id: "b", storage_path: "b.jpg", publicUrl: "https://cdn.example/b.jpg" },
        ],
        channels: {
          depopEnabled: false,
          shopifyEnabled: true,
          shopify: {
            variants: [{ option1Value: "M", variantSku: "ALL", imageIds: [] }],
          },
        },
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]["Variant SKU"]).toBe("ALL");
    expect(rows[1]["Image Src"]).toBe("https://cdn.example/b.jpg");
  });
});
