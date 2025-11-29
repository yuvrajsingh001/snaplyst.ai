import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

/**
 * Hook to get a public URL for an image path
 * Query key: ['imageUrl', path]
 */
export function useImageUrl(path: string | undefined, useSignedUrl = false) {
  return useQuery({
    queryKey: ["imageUrl", path, useSignedUrl],
    queryFn: async () => {
      if (!path) return null;
      
      if (useSignedUrl) {
        const { data } = await supabase.storage
          .from("product-images")
          .createSignedUrl(path, 3600);
        return data?.signedUrl || null;
      } else {
        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        return data.publicUrl;
      }
    },
    enabled: !!path,
    staleTime: 30 * 60 * 1000, // 30 minutes - URLs are stable
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  });
}

/**
 * Hook to get multiple image URLs at once
 * Query key: ['imageUrls', paths]
 */
export function useImageUrls(paths: string[] | undefined, useSignedUrls = false) {
  return useQuery({
    queryKey: ["imageUrls", paths, useSignedUrls],
    queryFn: async () => {
      if (!paths || paths.length === 0) return [];
      
      if (useSignedUrls) {
        const urls = await Promise.all(
          paths.map(async (path) => {
            const { data } = await supabase.storage
              .from("product-images")
              .createSignedUrl(path, 3600);
            return data?.signedUrl || "";
          })
        );
        return urls.filter((url) => url !== "");
      } else {
        return paths.map((path) => {
          const { data } = supabase.storage
            .from("product-images")
            .getPublicUrl(path);
          return data.publicUrl;
        });
      }
    },
    enabled: !!paths && paths.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  });
}

