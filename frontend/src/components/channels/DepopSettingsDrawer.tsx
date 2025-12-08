"use client";

import { useState, useEffect } from "react";
import type { DepopFields } from "@/lib/types/product";
import {
  DEPOP_CATEGORY_OPTIONS,
  DEPOP_SOURCE_OPTIONS,
  DEPOP_AGE_OPTIONS,
  DEPOP_STYLE_OPTIONS,
  DEPOP_LOCATION_OPTIONS,
} from "@/lib/constants/dropdowns";

interface DepopSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  depopEnabled: boolean;
  depopFields: DepopFields | undefined;
  generalFields: {
    description?: string;
    price?: number | null;
    colour1?: string | null;
    colour2?: string | null;
    brand?: string | null;
  };
  onChange: (fields: DepopFields) => void;
}

export default function DepopSettingsDrawer({
  isOpen,
  onClose,
  depopEnabled,
  depopFields,
  generalFields,
  onChange,
}: DepopSettingsDrawerProps) {
  const [fields, setFields] = useState<DepopFields>(depopFields || {});

  // Update local state when props change
  useEffect(() => {
    setFields(depopFields || {});
  }, [depopFields]);

  const handleFieldChange = (key: keyof DepopFields, value: any) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    onChange(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Depop Advanced Settings
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
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Category
            </label>
            <select
              value={fields.category || ""}
              onChange={(e) => handleFieldChange("category", e.target.value || null)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Select category</option>
              {DEPOP_CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Source 1 & Source 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Source 1
              </label>
              <select
                value={fields.source1 || ""}
                onChange={(e) => handleFieldChange("source1", e.target.value || null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Select source</option>
                {DEPOP_SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Source 2
              </label>
              <select
                value={fields.source2 || ""}
                onChange={(e) => handleFieldChange("source2", e.target.value || null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Select source</option>
                {DEPOP_SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Age
            </label>
            <select
              value={fields.age || ""}
              onChange={(e) => handleFieldChange("age", e.target.value || null)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Select age</option>
              {DEPOP_AGE_OPTIONS.map((age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </select>
          </div>

          {/* Style 1, 2, 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Style 1
              </label>
              <select
                value={fields.style1 || ""}
                onChange={(e) => handleFieldChange("style1", e.target.value || null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Select style</option>
                {DEPOP_STYLE_OPTIONS.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Style 2
              </label>
              <select
                value={fields.style2 || ""}
                onChange={(e) => handleFieldChange("style2", e.target.value || null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Select style</option>
                {DEPOP_STYLE_OPTIONS.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Style 3
              </label>
              <select
                value={fields.style3 || ""}
                onChange={(e) => handleFieldChange("style3", e.target.value || null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Select style</option>
                {DEPOP_STYLE_OPTIONS.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Location
            </label>
            <select
              value={fields.location || ""}
              onChange={(e) => handleFieldChange("location", e.target.value || null)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Select location</option>
              {DEPOP_LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Shipping Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Domestic Shipping Price
              </label>
              <input
                type="number"
                value={fields.domesticShippingPrice || ""}
                onChange={(e) =>
                  handleFieldChange(
                    "domesticShippingPrice",
                    e.target.value ? parseFloat(e.target.value) : null
                  )
                }
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                International Shipping Price
              </label>
              <input
                type="number"
                value={fields.internationalShippingPrice || ""}
                onChange={(e) =>
                  handleFieldChange(
                    "internationalShippingPrice",
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

