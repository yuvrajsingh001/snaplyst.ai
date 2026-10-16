"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureUserExists } from "@/lib/api";
import type { User } from "@supabase/supabase-js";
import {
  useProduct,
  useStackImagesWithUrls,
  useUpdateProductWithChannels,
  useRemoveBackground,
  useGuestCredits,
} from "@/lib/hooks";
import { GuestCreditsError } from "@/lib/guestCredits";
import { GuestCreditIndicator } from "@/components/guest/GuestCreditIndicator";
import { GuestSignupPrompt } from "@/components/guest/GuestSignupPrompt";
import type { ProductCore, ChannelConfig } from "@/lib/types/product";
import DepopSettingsDrawer from "@/components/channels/DepopSettingsDrawer";
import ShopifySettingsDrawer from "@/components/channels/ShopifySettingsDrawer";
import {
  CONDITION_OPTIONS,
  SIZE_OPTIONS,
  COLOUR_OPTIONS,
} from "@/lib/constants/dropdowns";

export default function ProductEditorPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [signupPromptOpen, setSignupPromptOpen] = useState(false);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);

  // Form state for general fields
  const [generalFields, setGeneralFields] = useState<Partial<ProductCore>>({
    title: "",
    description: "",
    price: null,
    compareAtPrice: null,
    brand: null,
    condition: null,
    size: null,
    colour1: null,
    colour2: null,
    tags: [],
    sku: null,
    weight: null,
    weightUnit: "g",
    category: null,
  });

  // Channel configuration state
  const [channelConfig, setChannelConfig] = useState<ChannelConfig>({
    depopEnabled: false,
    shopifyEnabled: false,
    depop: {},
    shopify: {},
  });

  // Drawer states
  const [depopDrawerOpen, setDepopDrawerOpen] = useState(false);
  const [shopifyDrawerOpen, setShopifyDrawerOpen] = useState(false);

  // Hero image selection
  const [heroImageId, setHeroImageId] = useState<string | null>(null);

  // React Query hooks
  const {
    data: product,
    isLoading: isLoadingProduct,
    error: productError,
  } = useProduct(productId);

  const {
    data: imagesWithUrls = [],
    isLoading: isLoadingImages,
    error: imagesError,
  } = useStackImagesWithUrls(productId);

  const updateProductMutation = useUpdateProductWithChannels();
  const removeBackgroundMutation = useRemoveBackground();
  const { isGuest, credits, setCredits } = useGuestCredits(user);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      setUser(session.user);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!session) {
        router.push("/");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Ensure profile exists on mount
  useEffect(() => {
    const initializeProfile = async () => {
      if (!user) return;

      try {
        await ensureUserExists();
      } catch (err) {
        console.error("Failed to initialize profile:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize profile");
      }
    };

    if (user) {
      initializeProfile();
    }
  }, [user]);

  // Update form state when product data loads
  useEffect(() => {
    if (product) {
      setGeneralFields({
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
        weightUnit: product.weightUnit || "g",
        category: product.category || null,
      });

      const channels = product.metadata?.channels || {
        depopEnabled: false,
        shopifyEnabled: false,
        depop: {},
        shopify: {},
      };
      setChannelConfig(channels);

      // Set hero image (first image by default)
      if (imagesWithUrls.length > 0 && !heroImageId) {
        setHeroImageId(imagesWithUrls[0].id);
      }
    }
  }, [product, imagesWithUrls]);

  // Set error from query errors
  useEffect(() => {
    if (productError) {
      setError(productError instanceof Error ? productError.message : "Failed to load product");
    } else if (imagesError) {
      setError(imagesError instanceof Error ? imagesError.message : "Failed to load images");
    }
  }, [productError, imagesError]);

  // Set loading state
  useEffect(() => {
    setIsLoading(isLoadingProduct || isLoadingImages);
  }, [isLoadingProduct, isLoadingImages]);

  const handleSave = async () => {
    if (!productId) return;

    // Validation
    if (!generalFields.title || generalFields.title.trim() === "") {
      setError("Title is required");
      return;
    }

    if (generalFields.price === null || generalFields.price === undefined) {
      setError("Price is required");
      return;
    }

    if (imagesWithUrls.length === 0) {
      setError("At least one image is required");
      return;
    }

    try {
      setError("");
      setSaveSuccess(false);

      await updateProductMutation.mutateAsync({
        productId,
        updates: {
          ...generalFields,
          channels: channelConfig,
        },
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update product:", err);
      setError(err instanceof Error ? err.message : "Failed to update product");
    }
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setGeneralFields({ ...generalFields, tags });
  };

  const handleDepopFieldsChange = (depopFields: any) => {
    setChannelConfig({
      ...channelConfig,
      depop: depopFields,
    });
  };

  const handleShopifyFieldsChange = (shopifyFields: any) => {
    setChannelConfig({
      ...channelConfig,
      shopify: shopifyFields,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">Error</h2>
          <p className="mb-4 text-zinc-600 dark:text-zinc-400">{error}</p>
          <button
            onClick={() => router.push("/profile")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/profile")}
                className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Back to profile"
              >
                <svg
                  className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-black dark:text-zinc-50">
                Edit Product
              </h1>
            </div>
            {isGuest && (
              <GuestCreditIndicator
                credits={credits}
                onEmptyClick={() => setSignupPromptOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm text-green-700 dark:text-green-300">
              Product updated successfully!
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Main Content - 3 columns on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column: Images */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
                Images ({imagesWithUrls.length})
              </h2>
              {imagesWithUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {imagesWithUrls.map((img, index) => {
                    const isHero = heroImageId === img.id;
                    return (
                      <div
                        key={img.id || index}
                        className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                          isHero
                            ? "border-blue-500 ring-2 ring-blue-500"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                        onClick={() => setHeroImageId(img.id)}
                      >
                        <img
                          src={img.publicUrl}
                          alt={`Product image ${index + 1}`}
                          className="h-32 w-full object-cover"
                        />
                        {isHero && (
                          <div className="absolute top-2 right-2 rounded-full bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                            Hero
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No images in this product
                </p>
              )}
              {imagesWithUrls.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const target = imagesWithUrls.find((img) => img.id === heroImageId) ?? imagesWithUrls[0];
                    if (!target?.id) return;
                    if (isGuest && credits === 0) {
                      setSignupPromptOpen(true);
                      return;
                    }
                    setIsRemovingBackground(true);
                    setError("");
                    try {
                      await removeBackgroundMutation.mutateAsync(target.id);
                    } catch (err) {
                      if (err instanceof GuestCreditsError) {
                        setCredits(err.creditsRemaining);
                        setSignupPromptOpen(true);
                      } else {
                        setError(err instanceof Error ? err.message : "Could not remove the background");
                      }
                    } finally {
                      setIsRemovingBackground(false);
                    }
                  }}
                  disabled={isRemovingBackground}
                  className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  {isRemovingBackground
                    ? "Removing background..."
                    : isGuest
                      ? "Remove background (1 credit)"
                      : "Remove background"}
                </button>
              )}
            </div>
          </div>

          {/* Middle Column: General Product Fields */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-6 text-lg font-semibold text-black dark:text-zinc-50">
                General Product Fields
              </h2>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={generalFields.title || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Product title"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={generalFields.description || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, description: e.target.value })
                    }
                    rows={4}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Product description"
                  />
                </div>

                {/* Price & Compare At Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Price ({product?.currency || "AUD"}) *
                    </label>
                    <input
                      type="number"
                      value={generalFields.price || ""}
                      onChange={(e) =>
                        setGeneralFields({
                          ...generalFields,
                          price: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Compare At Price
                    </label>
                    <input
                      type="number"
                      value={generalFields.compareAtPrice || ""}
                      onChange={(e) =>
                        setGeneralFields({
                          ...generalFields,
                          compareAtPrice: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={generalFields.sku || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, sku: e.target.value || null })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="SKU-001"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={generalFields.category || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, category: e.target.value || null })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="e.g., Apparel & Accessories > Clothing"
                  />
                </div>

                {/* Weight */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Weight
                    </label>
                    <input
                      type="number"
                      value={generalFields.weight || ""}
                      onChange={(e) =>
                        setGeneralFields({
                          ...generalFields,
                          weight: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Unit
                    </label>
                    <select
                      value={generalFields.weightUnit || "g"}
                      onChange={(e) =>
                        setGeneralFields({
                          ...generalFields,
                          weightUnit: e.target.value as "g" | "kg" | "lb" | "oz" | null,
                        })
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

                {/* Brand */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={generalFields.brand || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, brand: e.target.value || null })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Brand name"
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Condition
                  </label>
                  <select
                    value={generalFields.condition || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, condition: e.target.value || null })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="">Select condition</option>
                    {CONDITION_OPTIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Size */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Size
                  </label>
                  <select
                    value={generalFields.size || ""}
                    onChange={(e) =>
                      setGeneralFields({ ...generalFields, size: e.target.value || null })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="">Select size</option>
                    {SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Colour 1 & Colour 2 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Colour 1
                    </label>
                    <select
                      value={generalFields.colour1 || ""}
                      onChange={(e) =>
                        setGeneralFields({ ...generalFields, colour1: e.target.value || null })
                      }
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">Select colour</option>
                      {COLOUR_OPTIONS.map((colour) => (
                        <option key={colour} value={colour}>
                          {colour}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Colour 2
                    </label>
                    <select
                      value={generalFields.colour2 || ""}
                      onChange={(e) =>
                        setGeneralFields({ ...generalFields, colour2: e.target.value || null })
                      }
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">Select colour</option>
                      {COLOUR_OPTIONS.map((colour) => (
                        <option key={colour} value={colour}>
                          {colour}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={generalFields.tags?.join(", ") || ""}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Channels Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-6 text-lg font-semibold text-black dark:text-zinc-50">
                Channels
              </h2>

              <div className="space-y-6">
                {/* Depop */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="depopEnabled"
                        checked={channelConfig.depopEnabled}
                        onChange={(e) =>
                          setChannelConfig({
                            ...channelConfig,
                            depopEnabled: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <label
                        htmlFor="depopEnabled"
                        className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        List on Depop
                      </label>
                    </div>
                    {channelConfig.depopEnabled && (
                      <button
                        onClick={() => setDepopDrawerOpen(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Advanced
                      </button>
                    )}
                  </div>
                </div>

                {/* Shopify */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="shopifyEnabled"
                        checked={channelConfig.shopifyEnabled}
                        onChange={(e) =>
                          setChannelConfig({
                            ...channelConfig,
                            shopifyEnabled: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <label
                        htmlFor="shopifyEnabled"
                        className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        List on Shopify
                      </label>
                    </div>
                    {channelConfig.shopifyEnabled && (
                      <button
                        onClick={() => setShopifyDrawerOpen(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Advanced
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button - Fixed at bottom right */}
        <div className="fixed bottom-8 right-8">
          <button
            onClick={handleSave}
            disabled={updateProductMutation.isPending}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateProductMutation.isPending ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>

      {/* Drawers */}
      <DepopSettingsDrawer
        isOpen={depopDrawerOpen}
        onClose={() => setDepopDrawerOpen(false)}
        depopEnabled={channelConfig.depopEnabled}
        depopFields={channelConfig.depop}
        generalFields={{
          description: generalFields.description,
          price: generalFields.price,
          colour1: generalFields.colour1,
          colour2: generalFields.colour2,
          brand: generalFields.brand,
        }}
        onChange={handleDepopFieldsChange}
      />

      <ShopifySettingsDrawer
        isOpen={shopifyDrawerOpen}
        onClose={() => setShopifyDrawerOpen(false)}
        shopifyEnabled={channelConfig.shopifyEnabled}
        shopifyFields={channelConfig.shopify}
        generalFields={{
          title: generalFields.title,
          description: generalFields.description,
          price: generalFields.price,
          size: generalFields.size,
          tags: generalFields.tags,
        }}
        onChange={handleShopifyFieldsChange}
      />
      <GuestSignupPrompt open={signupPromptOpen} onClose={() => setSignupPromptOpen(false)} />
    </div>
  );
}

