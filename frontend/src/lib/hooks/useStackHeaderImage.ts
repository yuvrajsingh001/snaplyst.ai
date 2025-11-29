import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStackHeaderImage } from "../api";
import { supabase } from "../supabaseClient";

/**
 * Hook to fetch the header image for a stack
 * Query key: ['stackHeaderImage', stackId]
 */
export function useStackHeaderImage(stackId: string | undefined) {
  return useQuery({
    queryKey: ["stackHeaderImage", stackId],
    queryFn: async () => {
      if (!stackId) return null;
      return await getStackHeaderImage(stackId);
    },
    enabled: !!stackId,
    staleTime: 1 * 60 * 1000, // 1 minute - header images don't change often but still refetch
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to fetch stack header image with URL
 * Query key: ['stackHeaderImageWithUrl', stackId]
 */
export function useStackHeaderImageWithUrl(stackId: string | undefined) {
  return useQuery({
    queryKey: ["stackHeaderImageWithUrl", stackId],
    queryFn: async () => {
      if (!stackId) return null;
      const headerImage = await getStackHeaderImage(stackId);
      
      if (!headerImage) return null;
      
      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(headerImage.storage_path);
      
      return {
        ...headerImage,
        publicUrl: data.publicUrl,
      };
    },
    enabled: !!stackId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to invalidate stack header image cache
 */
export function useInvalidateStackHeaderImage() {
  const queryClient = useQueryClient();
  
  return (stackId: string | undefined) => {
    if (stackId) {
      queryClient.invalidateQueries({ queryKey: ["stackHeaderImage", stackId] });
      queryClient.invalidateQueries({ queryKey: ["stackHeaderImageWithUrl", stackId] });
    }
  };
}

