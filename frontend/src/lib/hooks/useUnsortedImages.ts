import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUnsortedImages } from "../api";
import { supabase } from "../supabaseClient";

/**
 * Hook to fetch unsorted images (images without a stack_id)
 * Query key: ['unsortedImages', userId]
 */
export function useUnsortedImages(userId: string | undefined) {
  return useQuery({
    queryKey: ["unsortedImages", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      return await getUnsortedImages();
    },
    enabled: !!userId,
    staleTime: 15 * 1000, // 15 seconds - unsorted images change more frequently
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
  });
}

/**
 * Hook to fetch unsorted images with signed URLs
 * Query key: ['unsortedImagesWithUrls', userId]
 */
export function useUnsortedImagesWithUrls(userId: string | undefined) {
  return useQuery({
    queryKey: ["unsortedImagesWithUrls", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      const images = await getUnsortedImages();
      
      // Create signed URLs for unsorted images
      const imagesWithUrls = await Promise.all(
        images.map(async (img) => {
          const { data } = await supabase.storage
            .from("product-images")
            .createSignedUrl(img.storage_path, 3600);
          return {
            ...img,
            signedUrl: data?.signedUrl || "",
          };
        })
      );
      
      return imagesWithUrls.filter((img) => img.signedUrl !== "");
    },
    enabled: !!userId,
    staleTime: 15 * 1000, // 15 seconds - unsorted images change more frequently
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
  });
}

/**
 * Hook to invalidate unsorted images cache
 */
export function useInvalidateUnsortedImages() {
  const queryClient = useQueryClient();
  
  return (userId: string | undefined) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ["unsortedImages", userId] });
      queryClient.invalidateQueries({ queryKey: ["unsortedImagesWithUrls", userId] });
    }
  };
}

