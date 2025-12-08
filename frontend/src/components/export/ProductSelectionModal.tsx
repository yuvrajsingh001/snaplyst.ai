"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ProductForExport } from "@/lib/types/export";
import { exportDepopCsv, exportShopifyCsv, downloadCsv } from "@/lib/export";

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: "depop" | "shopify";
  products: Array<{
    product: any;
    images: Array<{ id: string; storage_path: string; filename?: string }>;
  }>;
}

export default function ProductSelectionModal({
  isOpen,
  onClose,
  platform,
  products,
}: ProductSelectionModalProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [productsWithUrls, setProductsWithUrls] = useState<ProductForExport[]>([]);

  // Load products with image URLs and filter by channel
  useEffect(() => {
    if (!isOpen || products.length === 0) return;

    const loadProductsWithUrls = async () => {
      // Filter products based on platform channel enablement
      const filteredProducts = products.filter(({ product }) => {
        const channels = product.metadata?.channels || {
          depopEnabled: false,
          shopifyEnabled: false,
        };
        
        if (platform === "depop") {
          return channels.depopEnabled === true;
        } else {
          return channels.shopifyEnabled === true;
        }
      });

      const productsForExport: ProductForExport[] = await Promise.all(
        filteredProducts.map(async ({ product, images }) => {
          // Generate public URLs for images
          const imagesWithUrls = images.map((img) => {
            const { data } = supabase.storage
              .from("product-images")
              .getPublicUrl(img.storage_path);
            return {
              id: img.id,
              storage_path: img.storage_path,
              publicUrl: data.publicUrl,
              filename: img.filename,
            };
          });

          return {
            id: product.id,
            title: product.title || "",
            description: product.description || "",
            price: product.price,
            compareAtPrice: product.compareAtPrice || null,
            brand: product.brand || null,
            condition: product.condition || null,
            size: product.size || null,
            colour1: product.colour1 || null,
            colour2: product.colour2 || null,
            tags: product.tags || [],
            sku: product.sku || null,
            weight: product.weight || null,
            weightUnit: product.weightUnit || null,
            category: product.category || null,
            currency: product.currency,
            images: imagesWithUrls,
            channels: product.metadata?.channels || {
              depopEnabled: false,
              shopifyEnabled: false,
            },
          };
        })
      );

      setProductsWithUrls(productsForExport);
      // Select all by default
      setSelectedProductIds(new Set(productsForExport.map((p) => p.id)));
    };

    loadProductsWithUrls();
  }, [isOpen, products, platform]);

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProductIds);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProductIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProductIds.size === productsWithUrls.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(productsWithUrls.map((p) => p.id)));
    }
  };

  const handleExport = async () => {
    if (selectedProductIds.size === 0) {
      alert("Please select at least one product to export");
      return;
    }

    setIsExporting(true);

    try {
      const selectedProducts = productsWithUrls.filter((p) =>
        selectedProductIds.has(p.id)
      );

      let csvContent: string;
      let filename: string;

      if (platform === "depop") {
        csvContent = await exportDepopCsv(selectedProducts);
        filename = `depop-export-${new Date().toISOString().split("T")[0]}.csv`;
      } else {
        csvContent = await exportShopifyCsv(selectedProducts);
        filename = `shopify-export-${new Date().toISOString().split("T")[0]}.csv`;
      }

      downloadCsv(csvContent, filename);
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      alert(`Failed to export CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const platformName = platform === "depop" ? "Depop" : "Shopify";
  const allSelected = selectedProductIds.size === productsWithUrls.length && productsWithUrls.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Export to {platformName} CSV
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
        <div className="flex-1 overflow-y-auto p-6">
          {productsWithUrls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="h-12 w-12 text-zinc-400 dark:text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-black dark:text-zinc-50">
                No products configured for {platformName}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Enable {platformName} in the product editor and configure the required fields to export.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Select products to export ({selectedProductIds.size} of {productsWithUrls.length} selected)
                </p>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="space-y-2">
            {productsWithUrls.map((product) => {
              const isSelected = selectedProductIds.has(product.id);
              const hasImage = product.images.length > 0;
              const imageUrl = hasImage ? product.images[0].publicUrl : null;

              return (
                <div
                  key={product.id}
                  onClick={() => handleToggleProduct(product.id)}
                  className={`flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleProduct(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-black dark:text-zinc-50">
                      {product.title || "Untitled Product"}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {product.images.length} image{product.images.length !== 1 ? "s" : ""} •{" "}
                      {product.price ? `$${product.price}` : "No price"}
                    </p>
                  </div>
                </div>
              );
            })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedProductIds.size === 0 || productsWithUrls.length === 0}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting
              ? "Exporting..."
              : productsWithUrls.length === 0
              ? "No Products Available"
              : `Export ${selectedProductIds.size} Product${selectedProductIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

