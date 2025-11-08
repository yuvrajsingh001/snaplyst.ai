"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabaseClient";
import {
  createStack,
  getStacks,
  uploadToSupabaseStorage,
  createProductImage,
  assignImageToStack,
  getStackImages,
  ensureUserExists,
  getUnsortedImages,
  getStackHeaderImage,
  deleteAllStacks,
  deleteImage,
} from "@/lib/api";
import {
  processImagesWithVision,
  groupSimilarImagesWithVision,
  calculateSimilarityPercentage,
} from "@/lib/googleVision";
import type { User } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

type MenuItem = "profile" | "about" | "settings";

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<MenuItem>("profile");
  const [stacks, setStacks] = useState<any[]>([]);
  const [stacksWithHeaders, setStacksWithHeaders] = useState<Array<{ stack: any; headerImage: any }>>([]);
  const [unsortedImages, setUnsortedImages] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

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
      setIsLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!session) {
        router.push("/");
      } else {
        setUser(session.user);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Load stacks with their header images
  const loadStacksWithHeaders = useCallback(async () => {
    try {
      const stacksData = await getStacks();
      setStacks(stacksData);
      
      // Get header image for each stack
      const stacksWithHeaderImages = await Promise.all(
        stacksData.map(async (stack) => {
          const headerImage = await getStackHeaderImage(stack.id);
          return { stack, headerImage };
        })
      );
      
      setStacksWithHeaders(stacksWithHeaderImages);
    } catch (err) {
      console.error("Failed to load stacks:", err);
    }
  }, []);

  // Load unsorted images
  const loadUnsortedImages = useCallback(async () => {
    try {
      const images = await getUnsortedImages();
      setUnsortedImages(images);
      
      // Create preview URLs for unsorted images
      const previewUrls = await Promise.all(
        images.map(async (img) => {
          const { data } = await supabase.storage
            .from("product-images")
            .createSignedUrl(img.storage_path, 3600);
          return data?.signedUrl || "";
        })
      );
      setUploadedImages(previewUrls.filter(url => url !== ""));
    } catch (err) {
      console.error("Failed to load unsorted images:", err);
    }
  }, []);

  // Ensure profile exists and load stacks on mount
  useEffect(() => {
    const initializeProfile = async () => {
      if (!user) return;

      try {
        // First ensure the profile exists in the database
        await ensureUserExists();
        
        // Load stacks and their header images
        await loadStacksWithHeaders();
        
        // Load unsorted images
        await loadUnsortedImages();
        
        setError(""); // Clear any previous errors
      } catch (err) {
        console.error("Failed to initialize profile:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize profile";
        setError(errorMessage);
      }
    };
    
    if (user) {
      initializeProfile();
    }
  }, [user, loadStacksWithHeaders, loadUnsortedImages]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsUploading(true);
      setError("");

      try {
        // Get Google Vision API key from environment
        const googleVisionApiKey = process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
        if (!googleVisionApiKey || googleVisionApiKey === 'your_google_vision_api_key') {
          setError(
            "Google Vision API key not configured. " +
            "Please create a .env file in the frontend directory with: NEXT_PUBLIC_GOOGLE_VISION_API_KEY=your_api_key " +
            "Then restart your dev server. See QUICK_SETUP_GOOGLE_VISION.md for details."
          );
          setIsUploading(false);
          return;
        }

        // Step 1: Analyze images with Google Vision API
        console.log("Analyzing images with Google Vision API...");
        const imageAnalyses = await processImagesWithVision(acceptedFiles, googleVisionApiKey);

        // Step 2: Upload all images to storage and create records (without stack_id)
        console.log("Uploading images to storage...");
        const user = await supabase.auth.getUser();
        const newPreviewUrls: string[] = [];

        for (const { file, features, labels } of imageAnalyses) {
          try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${user.data.user?.id}/${Date.now()}_${uuidv4()}.${fileExt}`;

            // Upload file to Supabase Storage
            const { path } = await uploadToSupabaseStorage(file, fileName);

            // Create product_image record WITHOUT stack_id, storing features and labels in metadata
            const imageRecord = await createProductImage({
              stack_id: null, // No stack yet - will assign after sorting
              storage_path: path,
              filename: file.name,
              image_hash: null,
              metadata: {
                features: features,
                labels: labels,
              },
            });

            // Create preview URL for display
            const { data: urlData } = await supabase.storage
              .from("product-images")
              .createSignedUrl(path, 3600);
            
            if (urlData?.signedUrl) {
              newPreviewUrls.push(urlData.signedUrl);
            }

            console.log(
              `Uploaded image: ${file.name} (labels: ${labels.slice(0, 3).map((l: { description: string; score: number }) => l.description).join(', ')})`
            );
          } catch (err) {
            console.error("Failed to upload file:", file.name, err);
            setError(
              err instanceof Error
                ? `Failed to upload ${file.name}: ${err.message}`
                : `Failed to upload ${file.name}`
            );
          }
        }

        // Update preview URLs
        setUploadedImages((prev) => [...prev, ...newPreviewUrls]);
        
        // Reload unsorted images
        await loadUnsortedImages();
        
        console.log("Upload complete! Click 'Sort' to group similar images.");
      } catch (err) {
        console.error("Upload error:", err);
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  // Handle Sort button click
  const handleSort = useCallback(async () => {
    setIsSorting(true);
    setError("");

    try {
      const SIMILARITY_THRESHOLD = 60; // 60% similarity threshold

      // Get all unsorted images
      const images = await getUnsortedImages();
      
      if (images.length === 0) {
        setError("No unsorted images to sort.");
        setIsSorting(false);
        return;
      }

      // Extract features and labels from metadata
      const imagesWithFeatures = images
        .filter((img) => img.metadata && img.metadata.features && img.metadata.labels)
        .map((img) => ({
          id: img.id,
          features: img.metadata.features as number[],
          labels: img.metadata.labels as Array<{ description: string; score: number }>,
        }));

      if (imagesWithFeatures.length === 0) {
        setError("No images with analysis data found. Please re-upload images.");
        setIsSorting(false);
        return;
      }

      console.log(`Sorting ${imagesWithFeatures.length} images...`);

      // Group similar images
      const imageGroups = groupSimilarImagesWithVision(
        imagesWithFeatures.map((img) => ({
          id: img.id,
          features: img.features,
          labels: img.labels,
          file: {} as File, // Not needed for grouping
        })),
        SIMILARITY_THRESHOLD
      );

      console.log(`Found ${imageGroups.length} groups of similar images`);

      // Create stacks for each group and assign images
      for (let i = 0; i < imageGroups.length; i++) {
        const group = imageGroups[i];
        
        if (group.length === 0) continue;

        // Create a stack for this group
        const stack = await createStack({
          title: `Similar Images Group ${i + 1}`,
          description: `Group of ${group.length} similar images - ${new Date().toLocaleDateString()}`,
          metadata: {
            similarity_threshold: SIMILARITY_THRESHOLD,
            image_count: group.length,
          },
        });

        // Assign all images in this group to the stack
        for (const img of group) {
          try {
            await assignImageToStack(img.id, stack.id);
            
            // Calculate and store average similarity for the group
            if (group.length > 1) {
              let totalSimilarity = 0;
              let comparisons = 0;
              
              for (let j = 0; j < group.length; j++) {
                for (let k = j + 1; k < group.length; k++) {
                  const similarity = calculateSimilarityPercentage(
                    group[j].features,
                    group[k].features
                  );
                  totalSimilarity += similarity;
                  comparisons++;
                }
              }
              
              const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
              
              // Update image with similarity score
              await supabase
                .from("product_images")
                .update({ similarity_score: avgSimilarity })
                .eq("id", img.id);
            }
          } catch (err) {
            console.error(`Failed to assign image ${img.id} to stack ${stack.id}:`, err);
          }
        }
      }

      // Handle images that don't match any group (similarity < threshold%)
      const groupedImageIds = new Set(
        imageGroups.flatMap((group) => group.map((img) => img.id))
      );
      const ungroupedImages = imagesWithFeatures.filter(
        (img) => !groupedImageIds.has(img.id)
      );

      if (ungroupedImages.length > 0) {
        console.log(`Creating individual stacks for ${ungroupedImages.length} unique images...`);
        for (const img of ungroupedImages) {
          const imageRecord = images.find((i) => i.id === img.id);
          const stack = await createStack({
            title: `Unique Image: ${imageRecord?.filename || 'Image'}`,
            description: `Individual image - ${new Date().toLocaleDateString()}`,
            metadata: {
              is_unique: true,
            },
          });
          await assignImageToStack(img.id, stack.id);
        }
      }

      // Refresh stacks and clear unsorted images
      await loadStacksWithHeaders();
      await loadUnsortedImages();
      
      console.log("Sorting complete!");
    } catch (err) {
      console.error("Sort error:", err);
      setError(err instanceof Error ? err.message : "Sorting failed");
    } finally {
      setIsSorting(false);
    }
  }, [loadStacksWithHeaders, loadUnsortedImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
    },
    multiple: true,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Handle clear all stacks
  const handleClearAllStacks = useCallback(async () => {
    if (!confirm("Are you sure you want to delete ALL stacks? This action cannot be undone.")) {
      return;
    }

    try {
      setIsClearing(true);
      setError("");

      await deleteAllStacks();
      
      // Reload stacks (should be empty now)
      await loadStacksWithHeaders();
      
      console.log("All stacks deleted successfully");
    } catch (err) {
      console.error("Failed to delete stacks:", err);
      setError(err instanceof Error ? err.message : "Failed to delete stacks");
    } finally {
      setIsClearing(false);
    }
  }, [loadStacksWithHeaders]);

  // Handle delete unsorted image
  const handleDeleteImage = useCallback(async (imageId: string, imageIndex: number) => {
    if (!confirm("Are you sure you want to delete this image? This action cannot be undone.")) {
      return;
    }

    try {
      setError("");

      await deleteImage(imageId);
      
      // Remove from local state
      setUnsortedImages((prev) => prev.filter((img) => img.id !== imageId));
      
      // Reload unsorted images to get fresh URLs
      await loadUnsortedImages();
      
      console.log("Image deleted successfully");
    } catch (err) {
      console.error("Failed to delete image:", err);
      setError(err instanceof Error ? err.message : "Failed to delete image");
    }
  }, [loadUnsortedImages]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  const menuItems = [
    { id: "profile" as MenuItem, label: "Profile", icon: "👤" },
    { id: "about" as MenuItem, label: "About", icon: "ℹ️" },
    { id: "settings" as MenuItem, label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      {/* Left Sidebar - Dashboard */}
      <aside
        className={`border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 ${
          isSidebarCollapsed ? "w-16" : "w-80"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          {/* Header with Collapse Button */}
          <div className="mb-4 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-black dark:text-zinc-50">
                  Dashboard
                </h1>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Welcome back!
                </p>
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              ) : (
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Menu Items */}
          <nav className="mb-4 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenuItem(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  activeMenuItem === item.id
                    ? "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span className="text-xl">{item.icon}</span>
                {!isSidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Content based on active menu item */}
          {!isSidebarCollapsed && (
            <div className="mb-4 flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              {activeMenuItem === "profile" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                    Profile Information
                  </h2>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                      {user?.email || "Loading..."}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      User ID
                    </label>
                    <p className="mt-1 truncate text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {user?.id || "Loading..."}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Status
                    </label>
                    <p
                      className={`mt-1 text-sm ${
                        user?.email_confirmed_at
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {user?.email_confirmed_at ? "✓ Verified" : "⚠ Not Verified"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Member Since
                    </label>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Loading..."}
                    </p>
                  </div>
                </div>
              )}

              {activeMenuItem === "about" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                    About Snaplyst
                  </h2>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Snaplyst is an image upload and management platform. Upload,
                    organize, and manage your images with ease.
                  </p>
                  <div className="mt-4 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Version
                      </label>
                      <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                        1.0.0
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Platform
                      </label>
                      <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                        Web Application
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeMenuItem === "settings" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                    Settings
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Settings and preferences will be available here.
                  </p>
                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">
                        Enable notifications
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-zinc-600 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">
                        Auto-upload images
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logout Button */}
          <div className="mt-auto">
            <button
              onClick={handleLogout}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {isSidebarCollapsed ? "🚪" : "Logout"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Image Upload */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50">
              Upload Images
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Drag and drop images here, or click to select files
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Connection Error
                  </h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
                <button
                  onClick={() => setError("")}
                  className="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                >
                  <svg
                    className="h-5 w-5"
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
            </div>
          )}

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragActive
                ? "border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800/50"
                : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
            } ${isUploading ? "opacity-50" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg
                className="h-8 w-8 text-zinc-600 dark:text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            {isUploading ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                Uploading...
              </p>
            ) : isDragActive ? (
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Drop the images here...
              </p>
            ) : (
              <>
                <p className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
                  Drag & drop images here
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  or click to browse files
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                  Supports: JPEG, PNG, GIF, WebP
                </p>
              </>
            )}
          </div>

          {/* Sort Button - Show when there are unsorted images */}
          {unsortedImages.length > 0 && (
            <div className="mt-8">
              <button
                onClick={handleSort}
                disabled={isSorting}
                className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSorting ? "Sorting..." : `Sort ${unsortedImages.length} Image${unsortedImages.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Unsorted Images Grid */}
          {uploadedImages.length > 0 && unsortedImages.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
                Unsorted Images ({unsortedImages.length})
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {unsortedImages.map((image, index) => {
                  // Generate URL from storage path
                  const { data } = supabase.storage
                    .from("product-images")
                    .getPublicUrl(image.storage_path);
                  const imageUrl = data.publicUrl;

                  return (
                    <div
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
                    >
                      <img
                        src={imageUrl}
                        alt={`Uploaded ${index + 1}`}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(image.id, index);
                        }}
                        className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                        title="Remove image"
                      >
                        <svg
                          className="h-4 w-4"
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Stacks Grid - Show only header images */}
          {stacksWithHeaders.length > 0 && (
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
                  Sorted Stacks ({stacksWithHeaders.length})
                </h3>
                <button
                  onClick={handleClearAllStacks}
                  disabled={isClearing}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isClearing ? "Clearing..." : "Clear All"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {stacksWithHeaders.map(({ stack, headerImage }) => {
                  if (!headerImage) return null;
                  
                  const { data } = supabase.storage
                    .from("product-images")
                    .getPublicUrl(headerImage.storage_path);
                  const imageUrl = data.publicUrl;

                  return (
                    <div
                      key={stack.id}
                      onClick={() => router.push(`/stack/${stack.id}`)}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 cursor-pointer hover:border-blue-500 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-blue-500 transition-all"
                    >
                      <img
                        src={imageUrl}
                        alt={stack.title || "Stack header"}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="font-medium truncate">{stack.title}</p>
                        <p className="text-zinc-300">{stack.image_count || 0} image{stack.image_count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
