import type { ProductForExport } from "@/lib/types/export";

export function exportProduct(
  overrides: Partial<ProductForExport> = {},
): ProductForExport {
  const { channels, images, ...rest } = overrides;
  return {
    id: "prod-1",
    title: "Vintage Jacket",
    description: "Wool coach jacket",
    price: 45,
    brand: "Pendleton",
    condition: "Good",
    size: "M",
    colour1: "Red",
    colour2: "Black",
    tags: ["wool", "vintage"],
    sku: "JKT-1",
    weight: 500,
    weightUnit: "g",
    category: "Outerwear",
    ...rest,
    images: images ?? [
      {
        id: "img-1",
        storage_path: "user/jacket.jpg",
        publicUrl: "https://cdn.example/jacket.jpg",
      },
    ],
    channels: {
      depopEnabled: true,
      shopifyEnabled: true,
      ...channels,
    },
  };
}
