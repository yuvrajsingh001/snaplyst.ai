import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteImage, createProductImage, uploadToSupabaseStorage } from "../api";
import type { User } from "@supabase/supabase-js";

/**
 * Hook for deleting an image
 */
export function useDeleteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteImage,
    onSuccess: async (data, imageId) => {
      // Invalidate all image-related queries
      queryClient.invalidateQueries({ queryKey: ["unsortedImages"] });
      queryClient.invalidateQueries({ queryKey: ["unsortedImagesWithUrls"] });
      queryClient.invalidateQueries({ queryKey: ["stackImages"] });
      queryClient.invalidateQueries({ queryKey: ["stackImagesWithUrls"] });
      
      const {
        data: { user },
      } = await import("../supabaseClient").then((m) => m.supabase.auth.getUser());
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["stacks", user.id] });
        queryClient.invalidateQueries({ queryKey: ["stacksWithHeaders", user.id] });
      }
    },
  });
}

/**
 * Hook for uploading an image to storage
 */
export function useUploadImage() {
  return useMutation({
    mutationFn: ({ file, path }: { file: File; path: string }) =>
      uploadToSupabaseStorage(file, path),
  });
}

/**
 * Hook for creating a product image record
 */
export function useCreateProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProductImage,
    onSuccess: async () => {
      const {
        data: { user },
      } = await import("../supabaseClient").then((m) => m.supabase.auth.getUser());
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["unsortedImages", user.id] });
        queryClient.invalidateQueries({ queryKey: ["unsortedImagesWithUrls", user.id] });
      }
    },
  });
}

