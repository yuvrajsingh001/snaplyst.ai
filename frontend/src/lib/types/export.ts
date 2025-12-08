import type { ProductCore, ChannelConfig } from "./product";

/**
 * Product image with URL for export
 */
export type ProductImage = {
  id: string;
  storage_path: string;
  publicUrl: string;
  filename?: string;
};

/**
 * Product ready for CSV export
 * Includes core fields, images with URLs, and channel configuration
 */
export type ProductForExport = ProductCore & {
  currency?: string;
  images: ProductImage[];
  channels: ChannelConfig;
};

/**
 * Depop CSV row structure
 */
export type DepopCsvRow = {
  Title: string;
  Description: string;
  Price: string;
  Brand: string;
  Condition: string;
  Size: string;
  Colour1: string;
  Colour2: string;
  Category: string;
  Source1: string;
  Source2: string;
  Age: string;
  Style1: string;
  Style2: string;
  Style3: string;
  Location: string;
  DomesticShippingPrice: string;
  InternationalShippingPrice: string;
  "Picture Hero url": string;
  "Picture 2 url": string;
  "Picture 3 url": string;
  "Picture 4 url": string;
  "Picture 5 url": string;
  "Picture 6 url": string;
  "Picture 7 url": string;
  "Picture 8 url": string;
};

/**
 * Shopify CSV row structure
 */
export type ShopifyCsvRow = {
  Handle: string;
  Title: string;
  "Body (HTML)": string;
  Vendor: string;
  "Product Category": string;
  Type: string;
  Tags: string;
  "Option1 Name": string;
  "Option1 Value": string;
  "Variant SKU": string;
  "Variant Price": string;
  "Variant Compare At Price": string;
  "Variant Requires Shipping": string;
  "Variant Taxable": string;
  Status: string;
  "SEO Title": string;
  "SEO Description": string;
  "Image Src": string;
  "Image Position": string;
};

