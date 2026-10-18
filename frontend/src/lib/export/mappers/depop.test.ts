import { describe, expect, it } from "vitest";
import { exportProduct } from "@/test/fixtures";
import { toDepopRow } from "./depop";

describe("toDepopRow", () => {
  it("maps listing fields and channel settings onto Depop columns", () => {
    const row = toDepopRow(
      exportProduct({
        channels: {
          depopEnabled: true,
          shopifyEnabled: false,
          depop: {
            category: "Outerwear",
            source1: "Vintage",
            source2: "Thrifted",
            age: "1990s",
            style1: "Casual",
            style2: "Vintage",
            style3: "Grunge",
            location: "Australia",
            domesticShippingPrice: 10,
            internationalShippingPrice: 25,
          },
        },
      }),
    );

    expect(row).toMatchObject({
      Description: "Wool coach jacket",
      Category: "Outerwear",
      Price: "45",
      Brand: "Pendleton",
      Condition: "Good",
      Size: "M",
      "Colour 1": "Red",
      "Colour 2": "Black",
      "Source 1": "Vintage",
      "Source 2": "Thrifted",
      Age: "1990s",
      "Style 1": "Casual",
      "Style 2": "Vintage",
      "Style 3": "Grunge",
      Location: "Australia",
      "Picture Hero url": "https://cdn.example/jacket.jpg",
      "Domestic Shipping price": "10",
      "International Shipping price": "25",
    });
  });

  it("pads a short gallery out to eight picture columns", () => {
    const row = toDepopRow(exportProduct());

    expect(row["Picture Hero url"]).toBe("https://cdn.example/jacket.jpg");
    expect(row["Picture 2 url"]).toBe("");
    expect(row["Picture 8 url"]).toBe("");
  });

  it("keeps only the first eight images", () => {
    const images = Array.from({ length: 9 }, (_, index) => ({
      id: `img-${index}`,
      storage_path: `user/${index}.jpg`,
      publicUrl: `https://cdn.example/${index}.jpg`,
    }));

    const row = toDepopRow(exportProduct({ images }));

    expect(row["Picture Hero url"]).toBe("https://cdn.example/0.jpg");
    expect(row["Picture 8 url"]).toBe("https://cdn.example/7.jpg");
    expect(JSON.stringify(row)).not.toContain("https://cdn.example/8.jpg");
  });

  it("leaves channel columns blank when Depop settings are missing", () => {
    const row = toDepopRow(
      exportProduct({
        price: null,
        brand: null,
        channels: { depopEnabled: true, shopifyEnabled: false },
      }),
    );

    expect(row.Price).toBe("");
    expect(row.Brand).toBe("");
    expect(row.Category).toBe("");
    expect(row["Domestic Shipping price"]).toBe("");
  });
});
