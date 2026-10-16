"use client";

import { GUEST_STARTING_CREDITS } from "@/lib/guestCredits";

export function GuestSignupPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-signup-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
        <h2 id="guest-signup-title" className="text-xl font-semibold text-black dark:text-zinc-50">
          You&apos;re out of guest credits
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Guest visits include {GUEST_STARTING_CREDITS} credits. Each photo analysis and each
          background removal uses one. Create a free account and you can keep going — signing up
          from this session keeps the photos you already tried.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href="/signup"
            className="rounded-md bg-black px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Create a free account
          </a>
          <a
            href="/login"
            className="rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-black hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            I already have an account
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
