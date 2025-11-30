"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ensureUserExists,
} from "@/lib/api";
import type { User } from "@supabase/supabase-js";
import {
  useStack,
  useStackImagesWithUrls,
  useUpdateStack,
  useRemoveBackground,
  useUndoBackgroundRemoval,
  useRemoveBackgroundFromStack,
} from "@/lib/hooks";

export default function StackDetailPage() {
  const router = useRouter();
  const params = useParams();
  const stackId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | null>(null);

  // React Query hooks
  const {
    data: stack,
    isLoading: isLoadingStack,
    error: stackError,
  } = useStack(stackId);

  const {
    data: imagesWithUrls = [],
    isLoading: isLoadingImages,
    error: imagesError,
  } = useStackImagesWithUrls(stackId);

  // Mutations
  const updateStackMutation = useUpdateStack();
  const removeBackgroundMutation = useRemoveBackground();
  const undoBackgroundRemovalMutation = useUndoBackgroundRemoval();
  const removeBackgroundFromStackMutation = useRemoveBackgroundFromStack();

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

  // Update form state when stack data loads
  useEffect(() => {
    if (stack) {
      setDescription(stack.description || "");
      setPrice(stack.price || null);
    }
  }, [stack]);

  // Set error from query errors
  useEffect(() => {
    if (stackError) {
      setError(stackError instanceof Error ? stackError.message : "Failed to load stack");
    } else if (imagesError) {
      setError(imagesError instanceof Error ? imagesError.message : "Failed to load images");
    }
  }, [stackError, imagesError]);

  // Set loading state
  useEffect(() => {
    setIsLoading(isLoadingStack || isLoadingImages);
  }, [isLoadingStack, isLoadingImages]);

  const handleSave = async () => {
    if (!stackId) return;

    try {
      setError("");
      setSaveSuccess(false);

      await updateStackMutation.mutateAsync({
        stackId,
        updates: {
          description: description || undefined,
          price: price || undefined,
        },
      });

      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update stack:", err);
      setError(err instanceof Error ? err.message : "Failed to update stack");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error && !stack) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">
            Error
          </h2>
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
                {stack?.title || "Stack Details"}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm text-green-700 dark:text-green-300">
              Stack updated successfully!
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Horizontal Image Gallery */}
        {imagesWithUrls.length > 0 ? (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
                Images ({imagesWithUrls.length})
              </h2>
              <button
                onClick={async () => {
                  if (!stackId) return;
                  try {
                    setError("");
                    await removeBackgroundFromStackMutation.mutateAsync(stackId);
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 3000);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to remove backgrounds");
                  }
                }}
                disabled={removeBackgroundFromStackMutation.isPending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {removeBackgroundFromStackMutation.isPending
                  ? "Processing..."
                  : "Remove Backgrounds from All"}
              </button>
            </div>
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-zinc-100 dark:scrollbar-thumb-zinc-700 dark:scrollbar-track-zinc-800">
              <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
                {imagesWithUrls.map((img, index) => {
                  const hasBackgroundRemoved = img.metadata?.background_removed === true;
                  const isProcessing = removeBackgroundMutation.isPending && removeBackgroundMutation.variables?.toString() === img.id?.toString();
                  const isUndoing = undoBackgroundRemovalMutation.isPending && undoBackgroundRemovalMutation.variables?.toString() === img.id?.toString();

                  return (
                    <div
                      key={img.id || index}
                      className="flex-shrink-0"
                    >
                      <div className="relative h-64 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm hover:shadow-md transition-shadow dark:border-zinc-800 dark:bg-zinc-800">
                        <img
                          src={img.publicUrl}
                          alt={`Stack image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {/* Overlay with action buttons */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                          <div className="flex flex-col gap-2">
                            {!hasBackgroundRemoved ? (
                              <button
                                onClick={async () => {
                                  if (!img.id) return;
                                  try {
                                    setError("");
                                    await removeBackgroundMutation.mutateAsync(img.id);
                                    setSaveSuccess(true);
                                    setTimeout(() => setSaveSuccess(false), 3000);
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : "Failed to remove background");
                                  }
                                }}
                                disabled={isProcessing || isUndoing}
                                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isProcessing ? "Processing..." : "Remove Background"}
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!img.id) return;
                                  try {
                                    setError("");
                                    await undoBackgroundRemovalMutation.mutateAsync(img.id);
                                    setSaveSuccess(true);
                                    setTimeout(() => setSaveSuccess(false), 3000);
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : "Failed to undo");
                                  }
                                }}
                                disabled={isProcessing || isUndoing}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isUndoing ? "Restoring..." : "Undo"}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Badge for processed images */}
                        {hasBackgroundRemoved && (
                          <div className="absolute top-2 right-2 rounded-full bg-purple-600 px-2 py-1 text-xs font-medium text-white">
                            BG Removed
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              No images in this stack
            </p>
          </div>
        )}

        {/* Editable Fields */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-6 text-lg font-semibold text-black dark:text-zinc-50">
            Stack Information
          </h2>

          <div className="space-y-6">
            {/* Description Field */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                placeholder="Enter description..."
              />
            </div>

            {/* Price Field */}
            <div>
              <label
                htmlFor="price"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Price ({stack?.currency || "AUD"})
              </label>
              <input
                type="number"
                id="price"
                value={price || ""}
                onChange={(e) =>
                  setPrice(e.target.value ? parseFloat(e.target.value) : null)
                }
                min="0"
                step="0.01"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                placeholder="Enter price..."
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={updateStackMutation.isPending}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateStackMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

