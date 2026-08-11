"use client";

import Link from "next/link";
import { InView } from "@/components/motion-primitives/in-view";
import { buttonClass } from "@/components/ui/button";

// Blob-scatter backdrop + one-liner + CTA. Shared by five screens, so its
// drift was inherited five times over.
export function EmptyState({ title, description, cta, href }) {
  return (
    <InView className="relative overflow-hidden rounded-2xl border border-line bg-surface">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 dark:invert"
        style={{ backgroundImage: "url(/backgrounds/empty-blobs.svg)" }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && (
          <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>
        )}
        {cta && href && (
          <Link href={href} className={buttonClass("primary", "md", "mt-3")}>
            {cta}
          </Link>
        )}
      </div>
    </InView>
  );
}
