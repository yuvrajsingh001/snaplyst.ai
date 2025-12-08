import { useQuery } from "@tanstack/react-query";
import { getProductWithChannels } from "../api";
import type { ProductStackWithChannels } from "../types/product";

/**
 * Hook to fetch a product with channel configuration
 * Query key: ['product', productId]
 */
export function useProduct(productId: string | undefined) {
  return useQuery<ProductStackWithChannels>({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) throw new Error("Product ID is required");
      return await getProductWithChannels(productId);
    },
    enabled: !!productId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

