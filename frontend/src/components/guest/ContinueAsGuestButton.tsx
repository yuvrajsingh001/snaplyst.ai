"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { continueAsGuest } from "@/lib/guestSession";

export function ContinueAsGuestButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await continueAsGuest();
      if (result.status === "quota") {
        setError(
          "This network has already used its guest trials today. Create a free account to continue."
        );
        return;
      }
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a guest session");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900">or</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 font-medium text-black hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
      >
        {isLoading ? "Starting guest session..." : "Continue as guest"}
      </button>
      <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Try Snaplyst with 5 free credits. No account needed.
      </p>
      {error && (
        <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <p>{error}</p>
          <a href="/signup" className="mt-1 inline-block font-medium underline">
            Create a free account
          </a>
        </div>
      )}
    </div>
  );
}
