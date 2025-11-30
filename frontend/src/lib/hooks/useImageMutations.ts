import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteImage, createProductImage, uploadToSupabaseStorage, removeBackgroundFromImage, undoBackgroundRemoval, removeBackgroundFromStack } from "../api";
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

/**
 * Hook for removing background from an image
 */
export function useRemoveBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeBackgroundFromImage,
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
 * Hook for undoing background removal
 */
export function useUndoBackgroundRemoval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: undoBackgroundRemoval,
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
 * Hook for removing background from all images in a stack
 */
export function useRemoveBackgroundFromStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeBackgroundFromStack,
    onSuccess: async (data, stackId) => {
      // Invalidate all image-related queries
      queryClient.invalidateQueries({ queryKey: ["stackImages", stackId] });
      queryClient.invalidateQueries({ queryKey: ["stackImagesWithUrls", stackId] });
      
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

