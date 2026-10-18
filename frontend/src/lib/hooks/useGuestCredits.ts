"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { isAnonymousUser } from "../guestCredits";
import type { User } from "@supabase/supabase-js";

export function guestCreditsQueryKey(userId: string | undefined) {
  return ["guestCredits", userId] as const;
}

async function fetchGuestCredits(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("guest_credits")
    .select("credits_remaining")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || typeof data.credits_remaining !== "number") {
    return null;
  }
  return data.credits_remaining;
}

export function useGuestCredits(user: User | null) {
  const queryClient = useQueryClient();
  const isGuest = isAnonymousUser(user);
  const query = useQuery({
    queryKey: guestCreditsQueryKey(user?.id),
    enabled: Boolean(user?.id && isGuest),
    queryFn: () => fetchGuestCredits(user?.id ?? ""),
  });

  const setCredits = (nextCredits: number | null) => {
    if (!user?.id) return;
    queryClient.setQueryData(guestCreditsQueryKey(user.id), nextCredits);
  };

  return {
    isGuest,
    credits: isGuest ? (query.data ?? null) : null,
    isLoading: isGuest && query.isLoading,
    setCredits,
    refresh: () => query.refetch(),
  };
}
