import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStack } from "../api";

/**
 * Hook to fetch a single stack by ID
 * Query key: ['stack', stackId]
 */
export function useStack(stackId: string | undefined) {
  return useQuery({
    queryKey: ["stack", stackId],
    queryFn: async () => {
      if (!stackId) throw new Error("Stack ID is required");
      return await getStack(stackId);
    },
    enabled: !!stackId,
    staleTime: 30 * 1000, // 30 seconds - refetch in background after this
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to invalidate a specific stack cache
 */
export function useInvalidateStack() {
  const queryClient = useQueryClient();
  
  return (stackId: string | undefined) => {
    if (stackId) {
      queryClient.invalidateQueries({ queryKey: ["stack", stackId] });
    }
  };
}

