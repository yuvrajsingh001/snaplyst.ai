import { describe, expect, it } from "vitest";
import type { ProductStackWithChannels } from "./types/product";
import { buildDepopCsvRow, buildShopifyCsvRow } from "./channelMapping";

function stack(
  overrides: Partial<ProductStackWithChannels> = {},
): ProductStackWithChannels {
  return {
    id: "stack-1",
    title: "Blue Shirt",
    description: "Lightweight cotton",
    price: 12,
    brand: "Uniqlo",
    condition: "Good",
    size: "M",
    colour1: "Blue",
    tags: ["summer", "cotton"],
    metadata: {
      channels: {
        depopEnabled: true,
        shopifyEnabled: true,
        depop: {
          category: "Tops",
          domesticShippingPrice: 8,
          internationalShippingPrice: 18,
        },
        shopify: { status: "active" },
      },
    },
    ...overrides,
  };
}

describe("channel CSV rows", () => {
  it("maps shared product fields into the legacy Depop row", () => {
    const row = buildDepopCsvRow(stack());

    expect(row).toMatchObject({
      Title: "Blue Shirt",
      Description: "Lightweight cotton",
      Price: "12",
      Brand: "Uniqlo",
      Condition: "Good",
      Size: "M",
      Colour1: "Blue",
      Category: "Tops",
      DomesticShippingPrice: "8",
      InternationalShippingPrice: "18",
    });
  });

  it("builds a Shopify row with a slug handle and shipping defaults", () => {
    const row = buildShopifyCsvRow(
      stack({ title: "Rock & Roll Jacket", description: "x".repeat(170) }),
    );

    expect(row.Handle).toBe("rock-roll-jacket");
    expect(row["Body (HTML)"]).toBe(`<p>${"x".repeat(170)}</p>`);
    expect(row.Vendor).toBe("Uniqlo");
    expect(row.Tags).toBe("summer, cotton");
    expect(row["Option1 Name"]).toBe("Size");
    expect(row["Option1 Value"]).toBe("M");
    expect(row["Variant Price"]).toBe("12");
    expect(row["Variant Requires Shipping"]).toBe("TRUE");
    expect(row.Status).toBe("active");
    expect(row["SEO Description"]).toBe(`${"x".repeat(157)}...`);
  });

  it("turns shipping off only when the flag is explicitly false", () => {
    const row = buildShopifyCsvRow(
      stack({
        metadata: {
          channels: {
            depopEnabled: false,
            shopifyEnabled: true,
            shopify: { variantRequiresShipping: false, variantTaxable: false },
          },
        },
      }),
    );

    expect(row["Variant Requires Shipping"]).toBe("FALSE");
    expect(row["Variant Taxable"]).toBe("FALSE");
    expect(row.Status).toBe("draft");
  });
});
