import type { ProductForExport } from "../../types/export";

/**
 * Maps a product to Shopify CSV rows (one row per image)
 * Keys must exactly match the column names in the Shopify template
 */
export function toShopifyRows(product: ProductForExport): Record<string, string>[] {
  const shopify = product.channels.shopify || {};
  
  // Generate handle (slugified title)
  // If no handle or title, use product ID to ensure uniqueness
  let handle = shopify.handle;
  if (!handle) {
    if (product.title) {
      handle = slugify(product.title);
    } else {
      // Fallback to product ID if no title (ensures uniqueness)
      handle = `product-${product.id}`;
    }
  }
  
  // Generate body HTML (fallback to description wrapped in <p>)
  const bodyHtml = shopify.bodyHtml || (product.description ? `<p>${product.description}</p>` : "");
  
  // Generate SEO description (truncate to 160 chars)
  const seoDescription = shopify.seoDescription || truncate(product.description || "", 160);
  
  // Vendor falls back to brand
  const vendor = shopify.vendor || product.brand || "";
  
  // Product Category falls back to general category
  const productCategory = shopify.productCategory || product.category || "";
  
  // Image alt text (can be per image or general)
  const imageAltText = shopify.imageAltText || product.title || "";
  
  // Status defaults to draft
  const status = shopify.status || "draft";
  
  // Product-level fields (same for all rows)
  const productLevelFields: Record<string, string> = {
    Handle: handle,
    Title: product.title || "",
    "Body (HTML)": bodyHtml,
    Vendor: vendor,
    "Product Category": productCategory,
    Type: shopify.productType || "",
    Tags: product.tags?.join(", ") || "",
    Published: "TRUE",
    "Image Alt Text": imageAltText,
    "Gift Card": "FALSE",
    "SEO Title": shopify.seoTitle || product.title || "",
    "SEO Description": seoDescription,
    "Google Shopping / Google Product Category": "",
    "Google Shopping / Gender": "",
    "Google Shopping / Age Group": "",
    "Google Shopping / MPN": "",
    "Google Shopping / Condition": product.condition || "",
    "Google Shopping / Custom Product": "FALSE",
    "Variant Tax Code": "",
    "Cost per item": "",
    "Included / United States": "",
    "Price / United States": "",
    "Compare At Price / United States": "",
    "Included / International": "",
    "Price / International": "",
    "Compare At Price / International": "",
    Status: status,
  };
  
  // Helper function to create a variant row
  const createVariantRow = (
    variant: {
      option1Name?: string | null;
      option1Value?: string | null;
      option2Name?: string | null;
      option2Value?: string | null;
      option3Name?: string | null;
      option3Value?: string | null;
      variantSku?: string | null;
      variantPrice?: number | null;
      variantCompareAtPrice?: number | null;
      variantGrams?: number | null;
      variantWeightUnit?: "g" | "kg" | "lb" | "oz" | null;
      variantRequiresShipping?: boolean;
      variantTaxable?: boolean;
      variantBarcode?: string | null;
      variantImage?: string | null;
      variantInventoryQty?: number | null;
    },
    imageUrl: string,
    imagePosition: string,
    includeVariantFields: boolean
  ): Record<string, string> => {
    const variantPrice = variant.variantPrice?.toString() || product.price?.toString() || "";
    const variantCompareAtPrice = variant.variantCompareAtPrice?.toString() || product.compareAtPrice?.toString() || "";
    const variantSku = variant.variantSku || product.sku || "";
    const variantGrams = variant.variantGrams?.toString() || 
      (product.weight ? convertWeightToGrams(product.weight, product.weightUnit || "g").toString() : "");
    const variantWeightUnit = variant.variantWeightUnit || product.weightUnit || "g";
    const requiresShipping = variant.variantRequiresShipping !== false ? "TRUE" : "FALSE";
    const taxable = variant.variantTaxable !== false ? "TRUE" : "FALSE";
    
    const option1Name = variant.option1Name || "Size";
    const option1Value = variant.option1Value || product.size || "";
    const option2Name = variant.option2Name || "";
    const option2Value = option2Name ? (variant.option2Value || product.colour1 || "") : "";
    const option3Name = variant.option3Name || "";
    const option3Value = option3Name ? (variant.option3Value || "") : "";
    
    const row: Record<string, string> = {
      ...productLevelFields,
      "Image Src": imageUrl,
      "Image Position": imagePosition,
    };
    
    if (includeVariantFields) {
      // Include variant fields only in first row per variant
      row["Option1 Name"] = option1Name;
      row["Option1 Value"] = option1Value;
      row["Option2 Name"] = option2Name;
      row["Option2 Value"] = option2Value;
      row["Option3 Name"] = option3Name;
      row["Option3 Value"] = option3Value;
      row["Variant SKU"] = variantSku;
      row["Variant Grams"] = variantGrams;
      row["Variant Inventory Tracker"] = "shopify";
      row["Variant Inventory Qty"] = variant.variantInventoryQty?.toString() || "0";
      row["Variant Inventory Policy"] = "deny";
      row["Variant Fulfillment Service"] = "manual";
      row["Variant Price"] = variantPrice;
      row["Variant Compare At Price"] = variantCompareAtPrice;
      row["Variant Requires Shipping"] = requiresShipping;
      row["Variant Taxable"] = taxable;
      row["Variant Barcode"] = variant.variantBarcode || "";
      row["Variant Image"] = variant.variantImage || imageUrl;
      row["Variant Weight Unit"] = variantWeightUnit;
    } else {
      // Empty variant fields for additional image rows
      row["Option1 Name"] = "";
      row["Option1 Value"] = "";
      row["Option2 Name"] = "";
      row["Option2 Value"] = "";
      row["Option3 Name"] = "";
      row["Option3 Value"] = "";
      row["Variant SKU"] = "";
      row["Variant Grams"] = "";
      row["Variant Inventory Tracker"] = "";
      row["Variant Inventory Qty"] = "";
      row["Variant Inventory Policy"] = "";
      row["Variant Fulfillment Service"] = "";
      row["Variant Price"] = "";
      row["Variant Compare At Price"] = "";
      row["Variant Requires Shipping"] = "";
      row["Variant Taxable"] = "";
      row["Variant Barcode"] = "";
      row["Variant Image"] = "";
      row["Variant Weight Unit"] = "";
    }
    
    return row;
  };
  
  // Check if multiple variants are defined
  if (shopify.variants && shopify.variants.length > 0) {
    // Multiple variants mode - each variant can have its own images
    const allRows: Record<string, string>[] = [];
    
    for (const variant of shopify.variants) {
      // Get images for this variant (if imageIds specified, filter; otherwise use all images)
      const variantImages = variant.imageIds && variant.imageIds.length > 0
        ? product.images.filter(img => variant.imageIds!.includes(img.id))
        : product.images;
      
      if (variantImages.length === 0) {
        // No images for this variant - still create a row with empty image
        allRows.push(createVariantRow(variant, "", "1", true));
      } else {
        // First image row includes variant fields
        allRows.push(createVariantRow(variant, variantImages[0].publicUrl, "1", true));
        
        // Additional image rows for this variant (no variant fields)
        variantImages.slice(1).forEach((image, index) => {
          allRows.push(createVariantRow(variant, image.publicUrl, (index + 2).toString(), false));
        });
      }
    }
    
    return allRows;
  } else {
    // Single variant mode (backward compatibility)
    const variant: {
      option1Name?: string | null;
      option1Value?: string | null;
      option2Name?: string | null;
      option2Value?: string | null;
      option3Name?: string | null;
      option3Value?: string | null;
      variantSku?: string | null;
      variantPrice?: number | null;
      variantCompareAtPrice?: number | null;
      variantGrams?: number | null;
      variantWeightUnit?: "g" | "kg" | "lb" | "oz" | null;
      variantRequiresShipping?: boolean;
      variantTaxable?: boolean;
      variantBarcode?: string | null;
      variantImage?: string | null;
      variantInventoryQty?: number | null;
    } = {
      option1Name: shopify.option1Name || "Size",
      option1Value: shopify.option1Value || product.size || "",
      option2Name: shopify.option2Name || "",
      option2Value: shopify.option2Value || product.colour1 || "",
      option3Name: shopify.option3Name || "",
      option3Value: shopify.option3Value || "",
      variantSku: shopify.variantSku,
      variantPrice: shopify.variantPrice,
      variantCompareAtPrice: shopify.variantCompareAtPrice,
      variantGrams: shopify.variantGrams,
      variantWeightUnit: shopify.variantWeightUnit,
      variantRequiresShipping: shopify.variantRequiresShipping,
      variantTaxable: shopify.variantTaxable,
      variantBarcode: shopify.variantBarcode,
      variantImage: shopify.variantImage,
      variantInventoryQty: shopify.variantInventoryQty,
    };
    
    if (product.images.length === 0) {
      return [createVariantRow(variant, "", "1", true)];
    }
    
    const rows: Record<string, string>[] = [];
    rows.push(createVariantRow(variant, product.images[0].publicUrl, "1", true));
    
    product.images.slice(1).forEach((image, index) => {
      rows.push(createVariantRow(variant, image.publicUrl, (index + 2).toString(), false));
    });
    
    return rows;
  }
}

/**
 * Helper to slugify a string for use as a handle
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Helper to truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Convert weight to grams
 */
function convertWeightToGrams(weight: number, unit: "g" | "kg" | "lb" | "oz"): number {
  switch (unit) {
    case "g":
      return weight;
    case "kg":
      return weight * 1000;
    case "lb":
      return weight * 453.592;
    case "oz":
      return weight * 28.3495;
    default:
      return weight; // Assume grams if unknown
  }
}
