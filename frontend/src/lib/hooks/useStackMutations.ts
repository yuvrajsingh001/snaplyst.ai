import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createStack,
  updateStack,
  deleteStack,
  deleteAllStacks,
  assignImageToStack,
} from "../api";
import type { User } from "@supabase/supabase-js";

/**
 * Hook for creating a new stack
 */
export function useCreateStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStack,
    onSuccess: async (data, variables, context) => {
      // Invalidate stacks queries to refetch
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
 * Hook for updating a stack
 */
export function useUpdateStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stackId, updates }: { stackId: string | number; updates: Parameters<typeof updateStack>[1] }) =>
      updateStack(stackId, updates),
    onSuccess: async (data, variables) => {
      // Invalidate specific stack and stacks list
      queryClient.invalidateQueries({ queryKey: ["stack", variables.stackId] });
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
 * Hook for deleting a stack
 */
export function useDeleteStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStack,
    onSuccess: async (data, stackId) => {
      // Remove from cache and invalidate
      queryClient.removeQueries({ queryKey: ["stack", stackId] });
      queryClient.removeQueries({ queryKey: ["stackImages", stackId] });
      queryClient.removeQueries({ queryKey: ["stackImagesWithUrls", stackId] });
      queryClient.removeQueries({ queryKey: ["stackHeaderImage", stackId] });
      queryClient.removeQueries({ queryKey: ["stackHeaderImageWithUrl", stackId] });

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
 * Hook for deleting all stacks
 */
export function useDeleteAllStacks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAllStacks,
    onSuccess: async () => {
      // Clear all stack-related queries
      queryClient.removeQueries({ queryKey: ["stacks"] });
      queryClient.removeQueries({ queryKey: ["stacksWithHeaders"] });
      queryClient.removeQueries({ queryKey: ["stack"] });
      queryClient.removeQueries({ queryKey: ["stackImages"] });
      queryClient.removeQueries({ queryKey: ["stackHeaderImage"] });
    },
  });
}

/**
 * Hook for assigning an image to a stack
 */
export function useAssignImageToStack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, stackId }: { imageId: string | number; stackId: string | number }) =>
      assignImageToStack(imageId, stackId),
    onSuccess: async (data, variables) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: ["stackImages", variables.stackId] });
      queryClient.invalidateQueries({ queryKey: ["stackImagesWithUrls", variables.stackId] });
      queryClient.invalidateQueries({ queryKey: ["stackHeaderImage", variables.stackId] });
      
      const {
        data: { user },
      } = await import("../supabaseClient").then((m) => m.supabase.auth.getUser());
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["unsortedImages", user.id] });
        queryClient.invalidateQueries({ queryKey: ["unsortedImagesWithUrls", user.id] });
        queryClient.invalidateQueries({ queryKey: ["stacks", user.id] });
        queryClient.invalidateQueries({ queryKey: ["stacksWithHeaders", user.id] });
      }
    },
  });
}

