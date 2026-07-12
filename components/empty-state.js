"use client";

import Link from "next/link";
import { InView } from "@/components/motion-primitives/in-view";

// Grayscale blob-scatter backdrop + one-liner + CTA.
export function EmptyState({ title, description, cta, href }) {
  return (
    <InView className="relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60 dark:invert"
        style={{ backgroundImage: "url(/backgrounds/empty-blobs.svg)" }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="max-w-sm text-sm text-neutral-500">{description}</p>}
        {cta && href && (
          <Link
            href={href}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-80 dark:bg-white dark:text-black"
          >
            {cta}
          </Link>
        )}
      </div>
    </InView>
  );
}
