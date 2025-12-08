import type { ProductForExport } from "../../types/export";

/**
 * Maps a product to a Depop CSV row object
 * Keys must exactly match the column names in the Depop template
 */
export function toDepopRow(product: ProductForExport): Record<string, string> {
  const depop = product.channels.depop || {};
  
  // Get up to 8 images (Hero + Picture 2-8)
  const images = product.images.slice(0, 8);
  const imageUrls = images.map((img) => img.publicUrl);
  
  // Pad with empty strings if less than 8 images
  while (imageUrls.length < 8) {
    imageUrls.push("");
  }

  // Map to exact Depop template column names (from row 2 of template)
  return {
    Description: product.description || "",
    Category: depop.category || "",
    Price: product.price?.toString() || "",
    Brand: product.brand || "",
    Condition: product.condition || "",
    Size: product.size || "",
    "Colour 1": product.colour1 || "",
    "Colour 2": product.colour2 || "",
    "Source 1": depop.source1 || "",
    "Source 2": depop.source2 || "",
    Age: depop.age || "",
    "Style 1": depop.style1 || "",
    "Style 2": depop.style2 || "",
    "Style 3": depop.style3 || "",
    Location: depop.location || "",
    "Picture Hero url": imageUrls[0] || "",
    "Picture 2 url": imageUrls[1] || "",
    "Picture 3 url": imageUrls[2] || "",
    "Picture 4 url": imageUrls[3] || "",
    "Picture 5 url": imageUrls[4] || "",
    "Picture 6 url": imageUrls[5] || "",
    "Picture 7 url": imageUrls[6] || "",
    "Picture 8 url": imageUrls[7] || "",
    "Domestic Shipping price": depop.domesticShippingPrice?.toString() || "",
    "International Shipping price": depop.internationalShippingPrice?.toString() || "",
  };
}

