/**
 * Core product fields shared across all platforms
 */
export type ProductCore = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  compareAtPrice?: number | null; // Compare-at price for Shopify
  brand?: string | null;
  condition?: string | null;
  size?: string | null;
  colour1?: string | null;
  colour2?: string | null;
  tags?: string[]; // for Shopify / SEO / hashtags
  sku?: string | null; // SKU for inventory tracking
  weight?: number | null; // Weight in grams
  weightUnit?: "g" | "kg" | "lb" | "oz" | null; // Weight unit
  category?: string | null; // Internal category (maps to Shopify Product Category)
};

/**
 * Depop-specific product fields
 */
export type DepopFields = {
  category?: string | null;
  source1?: string | null;
  source2?: string | null;
  age?: string | null;
  style1?: string | null;
  style2?: string | null;
  style3?: string | null;
  location?: string | null;
  domesticShippingPrice?: number | null;
  internationalShippingPrice?: number | null;
};

/**
 * Shopify variant definition
 */
export type ShopifyVariant = {
  option1Name?: string | null; // e.g. "Size"
  option1Value?: string | null; // e.g. "M"
  option2Name?: string | null; // e.g. "Color"
  option2Value?: string | null; // e.g. "Red"
  option3Name?: string | null; // e.g. "Material"
  option3Value?: string | null;
  variantSku?: string | null;
  variantPrice?: number | null;
  variantCompareAtPrice?: number | null;
  variantGrams?: number | null; // Weight in grams
  variantWeightUnit?: "g" | "kg" | "lb" | "oz" | null;
  variantRequiresShipping?: boolean;
  variantTaxable?: boolean;
  variantBarcode?: string | null;
  variantImage?: string | null; // URL for variant-specific image
  variantInventoryQty?: number | null; // Inventory quantity
  imageIds?: string[]; // IDs of images that belong to this variant (optional - if not specified, all images belong to this variant)
};

/**
 * Shopify-specific product fields
 */
export type ShopifyFields = {
  handle?: string | null;
  bodyHtml?: string | null; // Shopify "Body (HTML)"
  vendor?: string | null;
  productCategory?: string | null; // Shopify "Product Category"
  productType?: string | null; // Shopify "Type"
  seoTitle?: string | null;
  seoDescription?: string | null;
  // Single variant (backward compatibility - if variants array is provided, this is ignored)
  option1Name?: string | null; // e.g. "Size"
  option1Value?: string | null; // e.g. "M"
  option2Name?: string | null; // e.g. "Color"
  option2Value?: string | null; // e.g. "Red"
  option3Name?: string | null; // e.g. "Material"
  option3Value?: string | null;
  variantSku?: string | null;
  variantPrice?: number | null;
  variantCompareAtPrice?: number | null;
  variantGrams?: number | null; // Weight in grams
  variantWeightUnit?: "g" | "kg" | "lb" | "oz" | null;
  variantRequiresShipping?: boolean;
  variantTaxable?: boolean;
  variantBarcode?: string | null;
  variantImage?: string | null; // URL for variant-specific image
  variantInventoryQty?: number | null; // Inventory quantity
  // Multiple variants support (if provided, single variant fields are ignored)
  variants?: ShopifyVariant[]; // Array of variants - each can have its own images
  // Image details
  imageAltText?: string | null; // Alt text for images
  // Status
  status?: "active" | "draft" | "archived";
};

/**
 * Channel configuration stored in product_stacks.metadata.channels
 */
export type ChannelConfig = {
  depopEnabled: boolean;
  shopifyEnabled: boolean;
  depop?: DepopFields;
  shopify?: ShopifyFields;
};

/**
 * Extended ProductStack type with channel configuration
 */
export type ProductStackWithChannels = ProductCore & {
  currency?: string;
  metadata?: {
    channels?: ChannelConfig;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
};

