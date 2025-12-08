"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Redirect from /stack/[id] to /products/[id]
 * This maintains backward compatibility while consolidating to a single editor page
 */
export default function StackDetailPageRedirect() {
  const router = useRouter();
  const params = useParams();
  const stackId = params?.id as string;

  useEffect(() => {
    if (stackId) {
      router.replace(`/products/${stackId}`);
    }
  }, [stackId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-zinc-600 dark:text-zinc-400">Redirecting...</div>
    </div>
  );
}
