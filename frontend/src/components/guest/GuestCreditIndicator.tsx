"use client";

import { guestCreditsLabel } from "@/lib/guestCredits";

export function GuestCreditIndicator({
  credits,
  onEmptyClick,
}: {
  credits: number | null;
  onEmptyClick?: () => void;
}) {
  if (credits === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        Guest session
      </span>
    );
  }

  const empty = credits <= 0;
  const className = empty
    ? "inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
    : "inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";

  if (empty) {
    return (
      <button type="button" onClick={onEmptyClick} className={className}>
        {guestCreditsLabel(0)} · Sign up to continue
      </button>
    );
  }

  return <span className={className}>{guestCreditsLabel(credits)}</span>;
}
