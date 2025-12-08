import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProductWithChannels } from "../api";
import type { ProductCore, ChannelConfig } from "../types/product";

/**
 * Hook for updating a product with channel configuration
 */
export function useUpdateProductWithChannels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      updates,
    }: {
      productId: string | number;
      updates: Partial<ProductCore & { channels: ChannelConfig; currency?: string }>;
    }) => updateProductWithChannels(productId, updates),
    onSuccess: async (data, variables) => {
      // Invalidate product queries
      queryClient.invalidateQueries({ queryKey: ["product", variables.productId] });
      queryClient.invalidateQueries({ queryKey: ["stack", variables.productId] });
      
      // Invalidate stacks list
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

