"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type MenuItem = "profile" | "about" | "settings";

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<MenuItem>("profile");

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    
    try {
      // Create preview URLs for immediate display
      const previewUrls = acceptedFiles.map((file) =>
        URL.createObjectURL(file)
      );
      setUploadedImages((prev) => [...prev, ...previewUrls]);

      // TODO: Upload files to your storage backend (MinIO/Supabase Storage)
      // For now, we'll just simulate the upload
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Files to upload:", acceptedFiles);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  }, []);

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

          {/* Uploaded Images Grid */}
          {uploadedImages.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
                Uploaded Images ({uploadedImages.length})
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {uploadedImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    <img
                      src={imageUrl}
                      alt={`Uploaded ${index + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <button
                      onClick={() => {
                        setUploadedImages((prev) =>
                          prev.filter((_, i) => i !== index)
                        );
                        URL.revokeObjectURL(imageUrl);
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
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
