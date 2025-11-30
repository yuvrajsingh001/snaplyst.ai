import { supabase } from "./supabaseClient";

/**
 * Get the current user
 */
async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return user;
}

/**
 * Ensure the user exists in the profiles table
 * This is needed because Supabase Auth users might not have a corresponding record
 * in the profiles table that the product_stacks table references
 */
export async function ensureUserExists() {
  const user = await getCurrentUser();
  console.log("ensureUserExists called for user:", user.id, user.email);

  // Check if user exists in the profiles table
  const { data: existingProfile, error: checkError } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  console.log("Profile check result:", { existingProfile, checkError });

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116 is "not found" which is expected, other errors are real problems
    console.error("Error checking profile:", checkError);
    throw new Error(`Failed to check profile: ${checkError.message}`);
  }

  // If profile doesn't exist, create it
  if (!existingProfile) {
    const profileData = {
      id: user.id,
      email: user.email || "",
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      created_at: user.created_at || new Date().toISOString(),
    };

    console.log("Creating profile for user:", user.id, profileData);

    // Try insert first (more explicit than upsert)
    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert(profileData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert failed, error details:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });

      // If insert fails due to duplicate, try to fetch existing
      if (insertError.code === "23505") {
        console.log("Profile already exists (duplicate key), fetching...");
        const { data: fetchedProfile, error: fetchError } = await supabase
          .from("profiles")
          .select("id, email, full_name, created_at")
          .eq("id", user.id)
          .single();

        if (fetchError) {
          console.error("Failed to fetch existing profile:", fetchError);
          throw new Error(
            `Profile exists but cannot be accessed: ${fetchError.message}. ` +
            `Please check your RLS policies.`
          );
        }

        console.log("Profile fetched successfully:", fetchedProfile);
        return;
      }

      // Try upsert as fallback
      console.warn("Trying upsert as fallback...");
      const { data: upsertedProfile, error: upsertError } = await supabase
        .from("profiles")
        .upsert(profileData, {
          onConflict: "id",
        })
        .select()
        .single();

      if (upsertError) {
        console.error("Upsert also failed:", upsertError);
        throw new Error(
          `Failed to create profile in database: ${insertError.message}. ` +
          `Upsert also failed: ${upsertError.message}. ` +
          `Please check your Supabase database permissions and RLS policies.`
        );
      }

      if (!upsertedProfile) {
        throw new Error("Profile upsert succeeded but no data returned");
      }

      console.log("Profile created/updated successfully via upsert:", upsertedProfile);
    } else {
      // Verify the profile was created
      if (!insertedProfile) {
        throw new Error("Profile insert succeeded but no data returned");
      }

      console.log("Profile created successfully via insert:", insertedProfile);

      // Double-check by fetching it back
      const { data: verifyProfile, error: verifyError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("id", user.id)
        .single();

      if (verifyError) {
        console.warn("Warning: Profile created but cannot be verified:", verifyError);
      } else {
        console.log("Profile verified:", verifyProfile);
      }
    }
  } else {
    console.log("Profile already exists:", existingProfile);
  }
}

/**
 * Create a new product stack
 */
export async function createStack(payload: {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  metadata?: Record<string, any>;
}) {
  const user = await getCurrentUser();

  // Ensure user exists in profiles table before creating stack
  await ensureUserExists();

  const { data, error } = await supabase
    .from("product_stacks")
    .insert({
      owner_id: user.id,
      title: payload.title || null,
      description: payload.description || null,
      price: payload.price || null,
      currency: payload.currency || "AUD",
      metadata: payload.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create stack");
  }

  // Add image_count to the response (new stack has 0 images)
  return { ...data, image_count: 0 };
}

/**
 * Get all stacks for the current user with image counts
 */
export async function getStacks() {
  const user = await getCurrentUser();

  // Get all stacks for the user
  const { data: stacks, error } = await supabase
    .from("product_stacks")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true }); // Oldest first, so new stacks appear at the end

  if (error) {
    throw new Error(error.message || "Failed to fetch stacks");
  }

  // Get image counts for each stack
  const stacksWithCounts = await Promise.all(
    (stacks || []).map(async (stack) => {
      const { data: images, error: imagesError } = await supabase
        .from("product_images")
        .select("id")
        .eq("stack_id", stack.id);

      const imageCount = imagesError ? 0 : (images?.length || 0);
      return { ...stack, image_count: imageCount };
    })
  );

  return stacksWithCounts;
}

/**
 * Get a single stack by ID
 */
export async function getStack(stackId: string | number) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("product_stacks")
    .select("*")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message || "Stack not found or access denied");
  }

  return data;
}

/**
 * Update a stack (description, price, etc.)
 */
export async function updateStack(
  stackId: string | number,
  updates: {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
  }
) {
  const user = await getCurrentUser();

  // Verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id, owner_id")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Stack not found or access denied");
  }

  // Update the stack
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) {
    updateData.title = updates.title || null;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description || null;
  }
  if (updates.price !== undefined) {
    updateData.price = updates.price || null;
  }
  if (updates.currency !== undefined) {
    updateData.currency = updates.currency || null;
  }

  const { data, error } = await supabase
    .from("product_stacks")
    .update(updateData)
    .eq("id", stackId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to update stack");
  }

  return data;
}

/**
 * Upload file directly to Supabase Storage
 */
export async function uploadToSupabaseStorage(
  file: File,
  path: string
): Promise<{ path: string }> {
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { path: data.path };
}

/**
 * Create a product image record in the database
 * stack_id can be null for initial upload (before similarity grouping)
 */
export async function createProductImage(payload: {
  stack_id?: string | number | null;
  storage_path: string;
  filename?: string;
  width?: number;
  height?: number;
  image_hash?: string | null;
  metadata?: Record<string, any>;
}) {
  const user = await getCurrentUser();

  // If stack_id is provided, verify the stack belongs to the user
  if (payload.stack_id) {
    const { data: stack, error: stackError } = await supabase
      .from("product_stacks")
      .select("id, owner_id")
      .eq("id", payload.stack_id)
      .eq("owner_id", user.id)
      .single();

    if (stackError || !stack) {
      throw new Error("Stack not found or access denied");
    }
  }

  // Extract filename from storage_path if not provided
  const filename = payload.filename || payload.storage_path.split("/").pop() || "";

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      stack_id: payload.stack_id || null,
      storage_path: payload.storage_path,
      filename: filename,
      width: payload.width || null,
      height: payload.height || null,
      image_hash: payload.image_hash || null,
      processed: false,
      metadata: payload.metadata || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create product image");
  }

  return data;
}

/**
 * Update product image to assign it to a stack
 */
export async function assignImageToStack(
  imageId: string | number,
  stackId: string | number
) {
  const user = await getCurrentUser();

  // Verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id, owner_id")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Stack not found or access denied");
  }

  // First verify the image exists and can be accessed
  const { data: existingImage, error: imageCheckError } = await supabase
    .from("product_images")
    .select("id, stack_id")
    .eq("id", imageId)
    .maybeSingle();

  if (imageCheckError) {
    throw new Error(`Failed to check image: ${imageCheckError.message}`);
  }

  if (!existingImage) {
    throw new Error(`Image with id ${imageId} not found or access denied`);
  }

  // Update the image (without select to avoid RLS issues)
  const { error: updateError } = await supabase
    .from("product_images")
    .update({ stack_id: stackId })
    .eq("id", imageId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to assign image to stack");
  }

  // Verify the update succeeded by fetching the image separately
  // This works around RLS policies that might block SELECT after UPDATE
  const { data: updatedImage, error: fetchError } = await supabase
    .from("product_images")
    .select("*")
    .eq("id", imageId)
    .maybeSingle();

  if (fetchError) {
    // If we can't fetch it, the update likely succeeded but RLS blocks SELECT
    // Return a minimal success response
    console.warn(`Update succeeded but cannot verify due to RLS: ${fetchError.message}`);
    return {
      id: imageId,
      stack_id: stackId,
    } as any;
  }

  if (!updatedImage) {
    throw new Error("Image update succeeded but image not found after update");
  }

  return updatedImage;
}

/**
 * Get images for a specific stack
 */
export async function getStackImages(stackId: string | number) {
  const user = await getCurrentUser();

  // First verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Stack not found or access denied");
  }

  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("stack_id", stackId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to fetch stack images");
  }

  return data || [];
}

/**
 * Get unsorted images (images without a stack_id)
 */
export async function getUnsortedImages() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .is("stack_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to fetch unsorted images");
  }

  return data || [];
}

/**
 * Get the header/representative image for a stack (first image)
 */
export async function getStackHeaderImage(stackId: string | number) {
  const user = await getCurrentUser();

  // Verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Stack not found or access denied");
  }

  // Get the first image in the stack (oldest or first uploaded)
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("stack_id", stackId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to fetch stack header image");
  }

  return data;
}

/**
 * Delete a stack and all its images
 */
export async function deleteStack(stackId: string | number) {
  const user = await getCurrentUser();

  // Verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id, owner_id")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Stack not found or access denied");
  }

  // Get all images in the stack to delete from storage
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("stack_id", stackId);

  if (imagesError) {
    console.warn("Failed to fetch images for deletion:", imagesError);
  }

  // Delete images from storage
  if (images && images.length > 0) {
    const pathsToDelete = images.map((img) => img.storage_path);
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove(pathsToDelete);

    if (storageError) {
      console.warn("Failed to delete some images from storage:", storageError);
    }
  }

  // Delete the stack (cascade should delete images, but we'll delete them explicitly too)
  const { error: deleteImagesError } = await supabase
    .from("product_images")
    .delete()
    .eq("stack_id", stackId);

  if (deleteImagesError) {
    console.warn("Failed to delete images:", deleteImagesError);
  }

  // Delete the stack
  const { error: deleteError } = await supabase
    .from("product_stacks")
    .delete()
    .eq("id", stackId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete stack");
  }

  return { success: true };
}

/**
 * Delete all stacks for the current user
 */
export async function deleteAllStacks() {
  const user = await getCurrentUser();

  // Get all stacks for the user
  const { data: stacks, error: stacksError } = await supabase
    .from("product_stacks")
    .select("id")
    .eq("owner_id", user.id);

  if (stacksError) {
    throw new Error(stacksError.message || "Failed to fetch stacks");
  }

  if (!stacks || stacks.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  // Get all images in all stacks
  const stackIds = stacks.map((s) => s.id);
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("storage_path")
    .in("stack_id", stackIds);

  if (imagesError) {
    console.warn("Failed to fetch images for deletion:", imagesError);
  }

  // Delete images from storage
  if (images && images.length > 0) {
    const pathsToDelete = images.map((img) => img.storage_path);
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove(pathsToDelete);

    if (storageError) {
      console.warn("Failed to delete some images from storage:", storageError);
    }
  }

  // Delete all images
  const { error: deleteImagesError } = await supabase
    .from("product_images")
    .delete()
    .in("stack_id", stackIds);

  if (deleteImagesError) {
    console.warn("Failed to delete images:", deleteImagesError);
  }

  // Delete all stacks
  const { error: deleteError } = await supabase
    .from("product_stacks")
    .delete()
    .eq("owner_id", user.id);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete stacks");
  }

  return { success: true, deletedCount: stacks.length };
}

/**
 * Delete a single image
 */
export async function deleteImage(imageId: string | number) {
  const user = await getCurrentUser();

  // Get the image to verify ownership and get storage path
  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("storage_path, stack_id")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(imageError.message || "Failed to fetch image");
  }

  if (!image) {
    throw new Error("Image not found");
  }

  // If image is in a stack, verify the stack belongs to the user
  if (image.stack_id) {
    const { data: stack, error: stackError } = await supabase
      .from("product_stacks")
      .select("id, owner_id")
      .eq("id", image.stack_id)
      .eq("owner_id", user.id)
      .single();

    if (stackError || !stack) {
      throw new Error("Access denied");
    }
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("product-images")
    .remove([image.storage_path]);

  if (storageError) {
    console.warn("Failed to delete image from storage:", storageError);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to delete image");
  }

  return { success: true };
}

/**
 * Remove background from an image
 * Processes image via backend and uploads processed version to Supabase
 */
export async function removeBackgroundFromImage(imageId: string | number) {
  const user = await getCurrentUser();
  
  // Get the image to verify ownership and get storage path
  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("storage_path, stack_id, metadata")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(imageError.message || "Failed to fetch image");
  }

  if (!image) {
    throw new Error("Image not found");
  }

  // Verify the stack belongs to the user (if image is in a stack)
  if (image.stack_id) {
    const { data: stack, error: stackError } = await supabase
      .from("product_stacks")
      .select("id, owner_id")
      .eq("id", image.stack_id)
      .eq("owner_id", user.id)
      .single();

    if (stackError || !stack) {
      throw new Error("Access denied");
    }
  }

  // Get public URL for the image
  const { data: urlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(image.storage_path);

  if (!urlData?.publicUrl) {
    throw new Error("Failed to get image URL");
  }

  // Call backend to process image
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!backendUrl || backendUrl === "http://localhost:8000") {
    throw new Error(
      "Backend API URL not configured. " +
      "Please set NEXT_PUBLIC_API_URL environment variable to your backend URL " +
      "(e.g., https://your-backend.railway.app)"
    );
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/background-removal/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: urlData.publicUrl,
      }),
    });
  } catch (fetchError) {
    throw new Error(
      `Failed to connect to backend at ${backendUrl}. ` +
      `Please check that the backend is deployed and accessible. ` +
      `Error: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to process image" }));
    throw new Error(error.detail || `Backend returned error: ${response.status} ${response.statusText}`);
  }

  const { processed_image_base64 } = await response.json();

  // Convert base64 to blob
  const base64Data = processed_image_base64.replace(/^data:image\/\w+;base64,/, "");
  const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const blob = new Blob([binaryData], { type: "image/png" });
  const file = new File([blob], `bg_removed_${Date.now()}.png`, { type: "image/png" });

  // Generate new storage path
  const originalPath = image.storage_path;
  const pathParts = originalPath.split("/");
  const filename = pathParts[pathParts.length - 1];
  const nameWithoutExt = filename.split(".")[0];
  const newPath = `${pathParts.slice(0, -1).join("/")}/${nameWithoutExt}_bg_removed.png`;

  // Upload processed image to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(newPath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload processed image");
  }

  // Store original path in metadata for undo
  const metadata = image.metadata || {};
  metadata.original_storage_path = originalPath;
  metadata.background_removed = true;
  metadata.background_removed_at = new Date().toISOString();

  // Update database record with new storage path
  const { data: updatedImage, error: updateError } = await supabase
    .from("product_images")
    .update({
      storage_path: uploadData.path,
      metadata: metadata,
    })
    .eq("id", imageId)
    .select()
    .single();

  if (updateError) {
    // If update fails, try to delete the uploaded file
    await supabase.storage.from("product-images").remove([uploadData.path]);
    throw new Error(updateError.message || "Failed to update image record");
  }

  return updatedImage;
}

/**
 * Undo background removal - restore original image
 */
export async function undoBackgroundRemoval(imageId: string | number) {
  const user = await getCurrentUser();

  // Get the image
  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("storage_path, stack_id, metadata")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) {
    throw new Error(imageError.message || "Failed to fetch image");
  }

  if (!image) {
    throw new Error("Image not found");
  }

  // Verify the stack belongs to the user (if image is in a stack)
  if (image.stack_id) {
    const { data: stack, error: stackError } = await supabase
      .from("product_stacks")
      .select("id, owner_id")
      .eq("id", image.stack_id)
      .eq("owner_id", user.id)
      .single();

    if (stackError || !stack) {
      throw new Error("Access denied");
    }
  }

  // Check if original path exists in metadata
  const metadata = image.metadata || {};
  const originalPath = metadata.original_storage_path;

  if (!originalPath) {
    throw new Error("No original image found to restore");
  }

  // Update database to restore original path
  const updatedMetadata = { ...metadata };
  delete updatedMetadata.original_storage_path;
  delete updatedMetadata.background_removed;
  delete updatedMetadata.background_removed_at;

  const { data: updatedImage, error: updateError } = await supabase
    .from("product_images")
    .update({
      storage_path: originalPath,
      metadata: updatedMetadata,
    })
    .eq("id", imageId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message || "Failed to restore original image");
  }

  // Optionally delete the processed image from storage (optional cleanup)
  try {
    await supabase.storage.from("product-images").remove([image.storage_path]);
  } catch (e) {
    // Ignore errors when deleting processed image
    console.warn("Failed to delete processed image:", e);
  }

  return updatedImage;
}

/**
 * Remove background from all images in a stack
 */
export async function removeBackgroundFromStack(stackId: string | number) {
  const user = await getCurrentUser();

  // Verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id, owner_id")
    .eq("id", stackId)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Stack not found or access denied");
  }

  // Get all images in the stack
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .eq("stack_id", stackId);

  if (imagesError) {
    throw new Error(imagesError.message || "Failed to fetch stack images");
  }

  if (!images || images.length === 0) {
    return { processed: 0, failed: 0 };
  }

  // Process each image
  let processed = 0;
  let failed = 0;

  for (const image of images) {
    try {
      await removeBackgroundFromImage(image.id);
      processed++;
    } catch (error) {
      console.error(`Failed to process image ${image.id}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}
