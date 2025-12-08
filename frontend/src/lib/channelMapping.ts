/**
 * Channel mapping utilities
 * These functions will be used to build CSV rows for Depop and Shopify exports
 */

import type { ProductStackWithChannels, DepopFields, ShopifyFields } from "./types/product";

/**
 * Build a Depop CSV row from a product with channels
 * This is a placeholder - will be implemented when CSV export is needed
 */
export function buildDepopCsvRow(product: ProductStackWithChannels): Record<string, string> {
  const channels = product.metadata?.channels;
  const depop = channels?.depop || {};
  
  // Map general fields to Depop columns
  return {
    Title: product.title || "",
    Description: product.description || "",
    Price: product.price?.toString() || "",
    Brand: product.brand || "",
    Condition: product.condition || "",
    Size: product.size || "",
    Colour1: product.colour1 || "",
    Colour2: product.colour2 || "",
    Category: depop.category || "",
    Source1: depop.source1 || "",
    Source2: depop.source2 || "",
    Age: depop.age || "",
    Style1: depop.style1 || "",
    Style2: depop.style2 || "",
    Style3: depop.style3 || "",
    Location: depop.location || "",
    DomesticShippingPrice: depop.domesticShippingPrice?.toString() || "",
    InternationalShippingPrice: depop.internationalShippingPrice?.toString() || "",
  };
}

/**
 * Build a Shopify CSV row from a product with channels
 * This is a placeholder - will be implemented when CSV export is needed
 */
export function buildShopifyCsvRow(product: ProductStackWithChannels): Record<string, string> {
  const channels = product.metadata?.channels;
  const shopify = channels?.shopify || {};
  
  // Map general fields to Shopify columns
  return {
    Handle: shopify.handle || slugify(product.title),
    Title: product.title || "",
    "Body (HTML)": shopify.bodyHtml || `<p>${product.description || ""}</p>`,
    Vendor: shopify.vendor || product.brand || "",
    "Product Category": shopify.productCategory || "",
    Type: shopify.productType || "",
    Tags: product.tags?.join(", ") || "",
    "Option1 Name": shopify.option1Name || "Size",
    "Option1 Value": shopify.option1Value || product.size || "",
    "Variant SKU": shopify.variantSku || "",
    "Variant Price": shopify.variantPrice?.toString() || product.price?.toString() || "",
    "Variant Compare At Price": shopify.variantCompareAtPrice?.toString() || "",
    "Variant Requires Shipping": shopify.variantRequiresShipping !== false ? "TRUE" : "FALSE",
    "Variant Taxable": shopify.variantTaxable !== false ? "TRUE" : "FALSE",
    Status: shopify.status || "draft",
    "SEO Title": shopify.seoTitle || product.title || "",
    "SEO Description": shopify.seoDescription || truncate(product.description || "", 160),
  };
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

