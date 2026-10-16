"use client";

import { useState, useEffect } from "react";
import type { ShopifyFields } from "@/lib/types/product";
import { SHOPIFY_STATUS_OPTIONS } from "@/lib/constants/dropdowns";

interface ShopifySettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shopifyEnabled: boolean;
  shopifyFields: ShopifyFields | undefined;
  generalFields: {
    title?: string;
    description?: string;
    price?: number | null;
    size?: string | null;
    tags?: string[];
  };
  onChange: (fields: ShopifyFields) => void;
}

export default function ShopifySettingsDrawer({
  isOpen,
  onClose,
  shopifyEnabled,
  shopifyFields,
  generalFields,
  onChange,
}: ShopifySettingsDrawerProps) {
  const [fields, setFields] = useState<ShopifyFields>(shopifyFields || {});

  // Update local state when props change
  useEffect(() => {
    setFields(shopifyFields || {});
  }, [shopifyFields]);

  const handleFieldChange = (key: keyof ShopifyFields, value: any) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    onChange(updated);
  };

  // Generate default handle from title
  const defaultHandle = generalFields.title
    ? generalFields.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

  // Generate default body HTML from description
  const defaultBodyHtml = generalFields.description
    ? `<p>${generalFields.description}</p>`
    : "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Shopify Advanced Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* General Section */}
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">
              General
            </h3>
            <div className="space-y-4">
              {/* Handle */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Handle
                </label>
                <input
                  type="text"
                  value={fields.handle || defaultHandle}
                  onChange={(e) => handleFieldChange("handle", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder={defaultHandle || "product-handle"}
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  URL-friendly identifier (default: slugified title)
                </p>
              </div>

              {/* Note: Title comes from general product fields, not Shopify-specific */}

              {/* Body (HTML) */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Body (HTML)
                </label>
                <textarea
                  value={fields.bodyHtml || defaultBodyHtml}
                  onChange={(e) => handleFieldChange("bodyHtml", e.target.value || null)}
                  rows={6}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 font-mono"
                  placeholder={defaultBodyHtml || "<p>Product description</p>"}
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  HTML content for product description
                </p>
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Vendor
                </label>
                <input
                  type="text"
                  value={fields.vendor || ""}
                  onChange={(e) => handleFieldChange("vendor", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder={generalFields.title || "Brand name"}
                />
              </div>

              {/* Product Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Product Category
                </label>
                <input
                  type="text"
                  value={fields.productCategory || ""}
                  onChange={(e) => handleFieldChange("productCategory", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="e.g., Apparel & Accessories > Clothing"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Type
                </label>
                <input
                  type="text"
                  value={fields.productType || ""}
                  onChange={(e) => handleFieldChange("productType", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="e.g., T-Shirt"
                />
              </div>
            </div>
          </div>

          {/* Pricing/Variant Section */}
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">
              Pricing & Variant
            </h3>
            <div className="space-y-4">
              {/* Option1 Name & Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Option1 Name
                  </label>
                  <input
                    type="text"
                    value={fields.option1Name || "Size"}
                    onChange={(e) => handleFieldChange("option1Name", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Size"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Option1 Value
                  </label>
                  <input
                    type="text"
                    value={fields.option1Value || generalFields.size || ""}
                    onChange={(e) => handleFieldChange("option1Value", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder={generalFields.size || "M"}
                  />
                </div>
              </div>

              {/* Option2 Name & Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Option2 Name (e.g., Color)
                  </label>
                  <input
                    type="text"
                    value={fields.option2Name || ""}
                    onChange={(e) => handleFieldChange("option2Name", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Option2 Value
                  </label>
                  <input
                    type="text"
                    value={fields.option2Value || ""}
                    onChange={(e) => handleFieldChange("option2Value", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Red"
                  />
                </div>
              </div>

              {/* Option3 Name & Value (optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Option3 Name (optional)
                  </label>
                  <input
                    type="text"
                    value={fields.option3Name || ""}
                    onChange={(e) => handleFieldChange("option3Name", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Material"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Option3 Value
                  </label>
                  <input
                    type="text"
                    value={fields.option3Value || ""}
                    onChange={(e) => handleFieldChange("option3Value", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Cotton"
                  />
                </div>
              </div>

              {/* Variant SKU & Barcode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Variant SKU
                  </label>
                  <input
                    type="text"
                    value={fields.variantSku || ""}
                    onChange={(e) => handleFieldChange("variantSku", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="SKU-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Variant Barcode
                  </label>
                  <input
                    type="text"
                    value={fields.variantBarcode || ""}
                    onChange={(e) => handleFieldChange("variantBarcode", e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Barcode"
                  />
                </div>
              </div>

              {/* Inventory Quantity */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Variant Inventory Quantity
                </label>
                <input
                  type="number"
                  value={fields.variantInventoryQty || ""}
                  onChange={(e) =>
                    handleFieldChange(
                      "variantInventoryQty",
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  min="0"
                  step="1"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {"Inventory quantity (Inventory Tracker will be set to \"shopify\")"}
                </p>
              </div>

              {/* Weight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Variant Grams (weight in grams)
                  </label>
                  <input
                    type="number"
                    value={fields.variantGrams || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "variantGrams",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="145"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Variant Weight Unit
                  </label>
                  <select
                    value={fields.variantWeightUnit || "g"}
                    onChange={(e) =>
                      handleFieldChange(
                        "variantWeightUnit",
                        e.target.value as "g" | "kg" | "lb" | "oz" | null
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                    <option value="oz">oz</option>
                  </select>
                </div>
              </div>

              {/* Variant Price & Compare At Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Variant Price
                  </label>
                  <input
                    type="number"
                    value={fields.variantPrice || generalFields.price || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "variantPrice",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder={generalFields.price?.toString() || "0.00"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Variant Compare At Price
                  </label>
                  <input
                    type="number"
                    value={fields.variantCompareAtPrice || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "variantCompareAtPrice",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Variant Requires Shipping & Taxable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="variantRequiresShipping"
                    checked={fields.variantRequiresShipping !== false}
                    onChange={(e) => handleFieldChange("variantRequiresShipping", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <label
                    htmlFor="variantRequiresShipping"
                    className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Variant Requires Shipping
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="variantTaxable"
                    checked={fields.variantTaxable !== false}
                    onChange={(e) => handleFieldChange("variantTaxable", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <label
                    htmlFor="variantTaxable"
                    className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Variant Taxable
                  </label>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Status
                </label>
                <select
                  value={fields.status || "draft"}
                  onChange={(e) =>
                    handleFieldChange("status", e.target.value as "active" | "draft" | "archived")
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {SHOPIFY_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Images Section */}
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">Images</h3>
            <div className="space-y-4">
              {/* Image Alt Text */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Image Alt Text
                </label>
                <input
                  type="text"
                  value={fields.imageAltText || generalFields.title || ""}
                  onChange={(e) => handleFieldChange("imageAltText", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder={generalFields.title || "Alt text for images"}
                />
              </div>

              {/* Variant Image */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Variant Image URL
                </label>
                <input
                  type="text"
                  value={fields.variantImage || ""}
                  onChange={(e) => handleFieldChange("variantImage", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  URL for variant-specific image (optional)
                </p>
              </div>
            </div>
          </div>

          {/* SEO Section */}
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">SEO</h3>
            <div className="space-y-4">
              {/* SEO Title */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  SEO Title
                </label>
                <input
                  type="text"
                  value={fields.seoTitle || generalFields.title || ""}
                  onChange={(e) => handleFieldChange("seoTitle", e.target.value || null)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder={generalFields.title || "SEO title"}
                />
              </div>

              {/* SEO Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  SEO Description
                </label>
                <textarea
                  value={
                    fields.seoDescription ||
                    (generalFields.description
                      ? generalFields.description.length > 160
                        ? generalFields.description.substring(0, 157) + "..."
                        : generalFields.description
                      : "")
                  }
                  onChange={(e) => handleFieldChange("seoDescription", e.target.value || null)}
                  rows={3}
                  maxLength={160}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  placeholder="SEO description (max 160 characters)"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {fields.seoDescription?.length || 0}/160 characters
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

