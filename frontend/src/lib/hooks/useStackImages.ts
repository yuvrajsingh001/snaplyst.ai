import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStackImages } from "../api";
import { supabase } from "../supabaseClient";

/**
 * Hook to fetch images for a specific stack
 * Query key: ['stackImages', stackId]
 */
export function useStackImages(stackId: string | undefined) {
  return useQuery({
    queryKey: ["stackImages", stackId],
    queryFn: async () => {
      if (!stackId) throw new Error("Stack ID is required");
      return await getStackImages(stackId);
    },
    enabled: !!stackId,
    staleTime: 30 * 1000, // 30 seconds - refetch in background after this
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to fetch stack images with their public URLs
 * Query key: ['stackImagesWithUrls', stackId]
 */
export function useStackImagesWithUrls(stackId: string | undefined) {
  return useQuery({
    queryKey: ["stackImagesWithUrls", stackId],
    queryFn: async () => {
      if (!stackId) throw new Error("Stack ID is required");
      const images = await getStackImages(stackId);
      
      // Generate public URLs for each image
      const imagesWithUrls = images.map((img: any) => {
        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(img.storage_path);
        return {
          ...img,
          publicUrl: data.publicUrl,
        };
      });
      
      return imagesWithUrls;
    },
    enabled: !!stackId,
    staleTime: 30 * 1000, // 30 seconds - refetch in background after this
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to invalidate stack images cache
 */
export function useInvalidateStackImages() {
  const queryClient = useQueryClient();
  
  return (stackId: string | undefined) => {
    if (stackId) {
      queryClient.invalidateQueries({ queryKey: ["stackImages", stackId] });
      queryClient.invalidateQueries({ queryKey: ["stackImagesWithUrls", stackId] });
    }
  };
}

