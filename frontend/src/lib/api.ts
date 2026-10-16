import { supabase, isSupabaseConfigured } from "./supabaseClient";
import type { ProductCore, ChannelConfig, ProductStackWithChannels } from "./types/product";

/**
 * Get the current user
 */
async function getCurrentUser() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file."
    );
  }

  try {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "not set";
        throw new Error(
          `Failed to connect to Supabase. Please check:\n` +
          `1. Your internet connection\n` +
          `2. That NEXT_PUBLIC_SUPABASE_URL is correct: ${supabaseUrl.substring(0, 40)}...\n` +
          `3. That your Supabase project is active (not paused)\n` +
          `4. That CORS is properly configured in your Supabase project settings\n` +
          `Original error: ${error.message}`
        );
      }
      throw new Error(error.message || "User not authenticated");
    }

    if (!user) {
      throw new Error("User not authenticated. Please sign in.");
  }

  return user;
  } catch (err) {
    // Handle network errors
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(
        `Network error connecting to Supabase. Please check:\n` +
        `1. Your internet connection\n` +
        `2. That your Supabase project URL is correct\n` +
        `3. That CORS is properly configured in your Supabase project\n` +
        `4. That your Supabase project is not paused`
      );
    }
    // Re-throw if it's already our custom error
    if (err instanceof Error && err.message.includes("Supabase")) {
      throw err;
    }
    // Otherwise wrap in a generic error
    throw new Error(err instanceof Error ? err.message : "Failed to get current user");
  }
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
 * Get products with images and channels for export
 * Returns all products for the current user with their images
 */
export async function getProductsForExport(): Promise<Array<{
  product: ProductStackWithChannels;
  images: Array<{ id: string; storage_path: string; filename?: string }>;
}>> {
  const user = await getCurrentUser();

  // Get all stacks for the user
  const { data: stacks, error: stacksError } = await supabase
    .from("product_stacks")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (stacksError) {
    throw new Error(stacksError.message || "Failed to fetch products");
  }

  if (!stacks || stacks.length === 0) {
    return [];
  }

  // Get images for all stacks
  const stackIds = stacks.map((s) => s.id);
  const { data: allImages, error: imagesError } = await supabase
    .from("product_images")
    .select("id, stack_id, storage_path, filename")
    .in("stack_id", stackIds)
    .order("created_at", { ascending: true });

  if (imagesError) {
    throw new Error(imagesError.message || "Failed to fetch images");
  }

  // Group images by stack_id
  const imagesByStack: Record<string, Array<{ id: string; storage_path: string; filename?: string }>> = {};
  (allImages || []).forEach((img) => {
    if (img.stack_id) {
      if (!imagesByStack[img.stack_id]) {
        imagesByStack[img.stack_id] = [];
      }
      imagesByStack[img.stack_id].push({
        id: img.id,
        storage_path: img.storage_path,
        filename: img.filename,
      });
    }
  });

  // Combine stacks with their images
  return stacks.map((stack) => {
    const metadata = stack.metadata || {};
    const channels: ChannelConfig = metadata.channels || {
      depopEnabled: false,
      shopifyEnabled: false,
    };

    const product: ProductStackWithChannels = {
      id: stack.id,
      title: stack.title || "",
      description: stack.description || "",
      price: stack.price,
      compareAtPrice: metadata.compareAtPrice || null,
      brand: metadata.brand || null,
      condition: metadata.condition || null,
      size: metadata.size || null,
      colour1: metadata.colour1 || null,
      colour2: metadata.colour2 || null,
      tags: metadata.tags || [],
      sku: metadata.sku || null,
      weight: metadata.weight || null,
      weightUnit: metadata.weightUnit || null,
      category: metadata.category || null,
      currency: stack.currency,
      metadata: {
        ...metadata,
        channels,
      },
      created_at: stack.created_at,
      updated_at: stack.updated_at,
      owner_id: stack.owner_id,
    };

    return {
      product,
      images: imagesByStack[stack.id] || [],
    };
  });
}

/**
 * Get a product stack with channel configuration
 * Returns the stack with normalized channel config from metadata.channels
 */
export async function getProductWithChannels(id: string | number): Promise<ProductStackWithChannels> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("product_stacks")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message || "Product not found or access denied");
  }

  // Normalize the data structure
  const metadata = data.metadata || {};
  const channels: ChannelConfig = metadata.channels || {
    depopEnabled: false,
    shopifyEnabled: false,
  };

  return {
    id: data.id,
    title: data.title || "",
    description: data.description || "",
    price: data.price,
    compareAtPrice: metadata.compareAtPrice || null,
    brand: metadata.brand || null,
    condition: metadata.condition || null,
    size: metadata.size || null,
    colour1: metadata.colour1 || null,
    colour2: metadata.colour2 || null,
    tags: metadata.tags || [],
    sku: metadata.sku || null,
    weight: metadata.weight || null,
    weightUnit: metadata.weightUnit || null,
    category: metadata.category || null,
    currency: data.currency,
    metadata: {
      ...metadata,
      channels,
    },
    created_at: data.created_at,
    updated_at: data.updated_at,
    owner_id: data.owner_id,
  };
}

/**
 * Update a product stack with channel configuration
 * Updates both core fields and channel config in metadata.channels
 */
export async function updateProductWithChannels(
  id: string | number,
  payload: Partial<ProductCore & { channels: ChannelConfig; currency?: string }>
) {
  const user = await getCurrentUser();

  // Verify the stack belongs to the user
  const { data: stack, error: stackError } = await supabase
    .from("product_stacks")
    .select("id, owner_id, metadata")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (stackError || !stack) {
    throw new Error("Product not found or access denied");
  }

  // Build update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  // Update core fields
  if (payload.title !== undefined) {
    updateData.title = payload.title || null;
  }
  if (payload.description !== undefined) {
    updateData.description = payload.description || null;
  }
  if (payload.price !== undefined) {
    // Ensure price is stored as a number (not string)
    // Note: Database column should be NUMERIC/DECIMAL, not INTEGER, to support decimal prices
    if (payload.price !== null && payload.price !== undefined) {
      const priceValue = typeof payload.price === 'number' 
        ? payload.price 
        : parseFloat(String(payload.price));
      
      // Validate that it's a valid number
      if (isNaN(priceValue)) {
        throw new Error(`Invalid price value: ${payload.price}`);
      }
      
      updateData.price = priceValue;
    } else {
      updateData.price = null;
    }
  }
  if (payload.currency !== undefined) {
    updateData.currency = payload.currency || "AUD";
  }

  // Update metadata fields (brand, condition, size, colours, tags)
  const currentMetadata = stack.metadata || {};
  const newMetadata: any = { ...currentMetadata };

  if (payload.brand !== undefined) {
    newMetadata.brand = payload.brand || null;
  }
  if (payload.condition !== undefined) {
    newMetadata.condition = payload.condition || null;
  }
  if (payload.size !== undefined) {
    newMetadata.size = payload.size || null;
  }
  if (payload.colour1 !== undefined) {
    newMetadata.colour1 = payload.colour1 || null;
  }
  if (payload.colour2 !== undefined) {
    newMetadata.colour2 = payload.colour2 || null;
  }
  if (payload.tags !== undefined) {
    newMetadata.tags = payload.tags || [];
  }
  if (payload.compareAtPrice !== undefined) {
    newMetadata.compareAtPrice = payload.compareAtPrice || null;
  }
  if (payload.sku !== undefined) {
    newMetadata.sku = payload.sku || null;
  }
  if (payload.weight !== undefined) {
    newMetadata.weight = payload.weight || null;
  }
  if (payload.weightUnit !== undefined) {
    newMetadata.weightUnit = payload.weightUnit || null;
  }
  if (payload.category !== undefined) {
    newMetadata.category = payload.category || null;
  }

  // Update channel configuration
  if (payload.channels !== undefined) {
    newMetadata.channels = payload.channels;
  }

  updateData.metadata = newMetadata;

  const { data, error } = await supabase
    .from("product_stacks")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Provide more helpful error message for type mismatch
    if (error.message?.includes("invalid input syntax for type integer")) {
      throw new Error(
        `Database schema error: The 'price' column in 'product_stacks' table is defined as INTEGER but should be NUMERIC/DECIMAL to support decimal prices.\n` +
        `Please update your database schema in Supabase:\n` +
        `ALTER TABLE product_stacks ALTER COLUMN price TYPE NUMERIC(10,2);\n` +
        `Original error: ${error.message}`
      );
    }
    throw new Error(error.message || "Failed to update product");
  }

  // Return normalized structure
  const updatedMetadata = data.metadata || {};
  const channels: ChannelConfig = updatedMetadata.channels || {
    depopEnabled: false,
    shopifyEnabled: false,
  };

  return {
    id: data.id,
    title: data.title || "",
    description: data.description || "",
    price: data.price,
    compareAtPrice: updatedMetadata.compareAtPrice || null,
    brand: updatedMetadata.brand || null,
    condition: updatedMetadata.condition || null,
    size: updatedMetadata.size || null,
    colour1: updatedMetadata.colour1 || null,
    colour2: updatedMetadata.colour2 || null,
    tags: updatedMetadata.tags || [],
    sku: updatedMetadata.sku || null,
    weight: updatedMetadata.weight || null,
    weightUnit: updatedMetadata.weightUnit || null,
    category: updatedMetadata.category || null,
    currency: data.currency,
    metadata: {
      ...updatedMetadata,
      channels,
    },
    created_at: data.created_at,
    updated_at: data.updated_at,
    owner_id: data.owner_id,
  };
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
    // Ensure price is stored as a number (not string)
    // Note: Database column should be NUMERIC/DECIMAL, not INTEGER, to support decimal prices
    if (updates.price !== null && updates.price !== undefined) {
      const priceValue = typeof updates.price === 'number' 
        ? updates.price 
        : parseFloat(String(updates.price));
      
      // Validate that it's a valid number
      if (isNaN(priceValue)) {
        throw new Error(`Invalid price value: ${updates.price}`);
      }
      
      updateData.price = priceValue;
    } else {
      updateData.price = null;
    }
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
 * Get all images from existing stacks with their features for similarity matching
 * Returns images grouped by stack_id
 */
export async function getExistingStackImages() {
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
    return [];
  }

  // Get all images from existing stacks
  const stackIds = stacks.map((s) => s.id);
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("*")
    .in("stack_id", stackIds)
    .order("created_at", { ascending: true });

  if (imagesError) {
    throw new Error(imagesError.message || "Failed to fetch stack images");
  }

  // Group images by stack_id
  const imagesByStack: Array<{
    stackId: string;
    images: Array<{
      id: string;
      features: number[];
      labels: Array<{ description: string; score: number }>;
    }>;
  }> = [];

  (images || []).forEach((img) => {
    if (img.stack_id && img.metadata?.features && img.metadata?.labels) {
      const stackId = String(img.stack_id);
      let stackGroup = imagesByStack.find((g) => g.stackId === stackId);
      
      if (!stackGroup) {
        stackGroup = { stackId, images: [] };
        imagesByStack.push(stackGroup);
      }
      
      stackGroup.images.push({
        id: img.id,
        features: img.metadata.features as number[],
        labels: img.metadata.labels as Array<{ description: string; score: number }>,
      });
    }
  });

  return imagesByStack;
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
    .select("storage_path, metadata")
    .eq("stack_id", stackId);

  if (imagesError) {
    console.warn("Failed to fetch images for deletion:", imagesError);
  }

  // Delete images from storage (both original and processed versions)
  if (images && images.length > 0) {
    const pathsToDelete = new Set<string>();
    
    images.forEach((img) => {
      // Add current storage path
      pathsToDelete.add(img.storage_path);
      
      // Add processed storage path if it exists
      const metadata = img.metadata || {};
      if (metadata.processed_storage_path) {
        pathsToDelete.add(metadata.processed_storage_path);
      }
      
      // Add original storage path if it exists (in case current path is processed)
      if (metadata.original_storage_path) {
        pathsToDelete.add(metadata.original_storage_path);
      }
    });
    
    const pathsArray = Array.from(pathsToDelete);
    if (pathsArray.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .remove(pathsArray);

      if (storageError) {
        console.warn("Failed to delete some images from storage:", storageError);
      }
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
    .select("storage_path, metadata")
    .in("stack_id", stackIds);

  if (imagesError) {
    console.warn("Failed to fetch images for deletion:", imagesError);
  }

  // Delete images from storage (both original and processed versions)
  if (images && images.length > 0) {
    const pathsToDelete = new Set<string>();
    
    images.forEach((img) => {
      // Add current storage path
      pathsToDelete.add(img.storage_path);
      
      // Add processed storage path if it exists
      const metadata = img.metadata || {};
      if (metadata.processed_storage_path) {
        pathsToDelete.add(metadata.processed_storage_path);
      }
      
      // Add original storage path if it exists (in case current path is processed)
      if (metadata.original_storage_path) {
        pathsToDelete.add(metadata.original_storage_path);
      }
    });
    
    const pathsArray = Array.from(pathsToDelete);
    if (pathsArray.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .remove(pathsArray);

      if (storageError) {
        console.warn("Failed to delete some images from storage:", storageError);
      }
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
    .select("storage_path, stack_id, metadata")
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

  // Delete from storage (both original and processed versions)
  const pathsToDelete = new Set<string>();
  pathsToDelete.add(image.storage_path);
  
  const metadata = image.metadata || {};
  if (metadata.processed_storage_path) {
    pathsToDelete.add(metadata.processed_storage_path);
  }
  if (metadata.original_storage_path) {
    pathsToDelete.add(metadata.original_storage_path);
  }
  
  const pathsArray = Array.from(pathsToDelete);
  const { error: storageError } = await supabase.storage
    .from("product-images")
    .remove(pathsArray);

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

  // Check if background was already removed - avoid reprocessing
  const metadata = image.metadata || {};
  
  // First, check if background is already removed and active
  if (metadata.background_removed === true && metadata.processed_storage_path) {
    // Check if the processed image file still exists in storage
    const pathParts = metadata.processed_storage_path.split("/");
    const folderPath = pathParts.slice(0, -1).join("/");
    const fileName = pathParts[pathParts.length - 1];
    
    const { data: fileList } = await supabase.storage
      .from("product-images")
      .list(folderPath, {
        search: fileName,
      });
    
    // If processed image exists and is already active, skip
    if (fileList && fileList.length > 0 && image.storage_path === metadata.processed_storage_path) {
      console.log("Background already removed for this image, skipping reprocessing");
      return image;
    }
  }
  
  // Check if a processed version exists in storage (even if not currently active)
  // Generate the expected processed file path
  const currentPath = image.storage_path;
  const pathParts = currentPath.split("/");
  const filename = pathParts[pathParts.length - 1];
  const lastDotIndex = filename.lastIndexOf(".");
  const nameWithoutExt = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const expectedProcessedPath = `${pathParts.slice(0, -1).join("/")}/${nameWithoutExt}_bg_removed.png`;
  
  // Check if processed file exists in storage
  const processedPathParts = expectedProcessedPath.split("/");
  const processedFolderPath = processedPathParts.slice(0, -1).join("/");
  const processedFileName = processedPathParts[processedPathParts.length - 1];
  
  const { data: processedFileList } = await supabase.storage
    .from("product-images")
    .list(processedFolderPath, {
      search: processedFileName,
    });
  
  // If processed file exists, restore it instead of reprocessing
  if (processedFileList && processedFileList.length > 0) {
    console.log("Found existing processed image in storage, restoring it");
    
    // Restore metadata
    if (!metadata.original_storage_path) {
      metadata.original_storage_path = currentPath;
    }
    metadata.background_removed = true;
    metadata.background_removed_at = metadata.background_removed_at || new Date().toISOString();
    metadata.processed_storage_path = expectedProcessedPath;
    
    // Update database to point to processed image
    const { data: restoredImage, error: restoreError } = await supabase
      .from("product_images")
      .update({
        storage_path: expectedProcessedPath,
        metadata: metadata,
      })
      .eq("id", imageId)
      .select()
      .single();
    
    if (restoreError) {
      throw new Error(restoreError.message || "Failed to restore processed image");
    }
    
    return restoredImage;
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

  // Call backend to process and upload image directly
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!backendUrl || backendUrl === "http://localhost:8000") {
    throw new Error(
      "Backend API URL not configured. " +
      "Please set NEXT_PUBLIC_API_URL environment variable to your backend URL " +
      "(e.g., https://your-backend.railway.app)"
    );
  }

  // Get original path (for undo)
  const originalPath = metadata.original_storage_path || image.storage_path;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Not authenticated. Please sign in.");
  }

  let response: Response;
  try {
    // Background removal can take 30-60 seconds, so set a longer timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
    
    // Backend handles download, processing, and upload - we just pass the info.
    // The bearer token is checked against user_id before the service role upload.
    response = await fetch(`${backendUrl}/api/background-removal/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        image_url: urlData.publicUrl,
        storage_path: originalPath,
        user_id: user.id,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error(
        `Request timed out after 2 minutes. Background removal is taking longer than expected. ` +
        `This might be due to a large image or slow processing. Please try again with a smaller image.`
      );
    }
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

  // Backend returns the new storage path directly (no base64!)
  const { processed_storage_path, original_storage_path } = await response.json();

  // Store original path in metadata for undo (only if not already stored)
  if (!metadata.original_storage_path) {
    metadata.original_storage_path = original_storage_path;
  }
  metadata.background_removed = true;
  metadata.background_removed_at = new Date().toISOString();
  metadata.processed_storage_path = processed_storage_path;

  // Update database record with new storage path
  const { data: updatedImage, error: updateError } = await supabase
    .from("product_images")
    .update({
      storage_path: processed_storage_path,
      metadata: metadata,
    })
    .eq("id", imageId)
    .select()
    .single();

  if (updateError) {
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
  
  // Keep processed_storage_path in metadata so we can restore it later without reprocessing
  // Don't delete the processed file from storage - keep it for potential reuse
  delete updatedMetadata.original_storage_path;
  delete updatedMetadata.background_removed;
  delete updatedMetadata.background_removed_at;
  // Keep processed_storage_path for potential future restoration

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

  // Don't delete the processed image from storage - keep it for potential reuse
  // When user clicks "Remove Background" again, we'll check if it exists and restore it

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

  // Get all images in the stack with metadata
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("id, storage_path, metadata")
    .eq("stack_id", stackId);

  if (imagesError) {
    throw new Error(imagesError.message || "Failed to fetch stack images");
  }

  if (!images || images.length === 0) {
    return { processed: 0, skipped: 0, failed: 0 };
  }

  // Process each image (skip already processed ones)
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const image of images) {
    // Skip if already processed
    if (image.metadata?.background_removed === true) {
      skipped++;
      continue;
    }
    
    try {
      await removeBackgroundFromImage(image.id);
      processed++;
    } catch (error) {
      console.error(`Failed to process image ${image.id}:`, error);
      failed++;
    }
  }

  return { processed, skipped, failed };
}
