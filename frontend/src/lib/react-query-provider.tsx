"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 5 minutes before considering it stale
            staleTime: 5 * 60 * 1000,
            // Keep data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Refetch on window focus for fresh data (background refetching)
            refetchOnWindowFocus: true,
            // Refetch when reconnecting to network
            refetchOnReconnect: true,
            // Don't refetch on mount if data is fresh (use cache)
            refetchOnMount: false,
            // Retry failed requests once
            retry: 1,
            // Background refetching: refetch in background when data becomes stale
            refetchInterval: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

