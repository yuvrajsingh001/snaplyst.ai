import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStacks, getStackHeaderImage } from "../api";
import { supabase } from "../supabaseClient";

export type StackWithHeader = {
  stack: any;
  headerImage: any;
};

/**
 * Hook to fetch all stacks for the current user
 * Query key: ['stacks', userId]
 */
export function useStacks(userId: string | undefined) {
  return useQuery({
    queryKey: ["stacks", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      return await getStacks();
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - refetch in background after this
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to fetch stacks with their header images
 * Query key: ['stacksWithHeaders', userId]
 */
export function useStacksWithHeaders(userId: string | undefined) {
  return useQuery({
    queryKey: ["stacksWithHeaders", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      const stacks = await getStacks();
      
      // Get header image for each stack
      const stacksWithHeaderImages = await Promise.all(
        stacks.map(async (stack) => {
          const headerImage = await getStackHeaderImage(stack.id);
          return { stack, headerImage };
        })
      );
      
      return stacksWithHeaderImages;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - refetch in background after this
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to invalidate stacks cache
 */
export function useInvalidateStacks() {
  const queryClient = useQueryClient();
  
  return (userId: string | undefined) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ["stacks", userId] });
      queryClient.invalidateQueries({ queryKey: ["stacksWithHeaders", userId] });
    }
  };
}

