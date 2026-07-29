"use client";

import Image from "next/image";

// A full-bleed photographic section with a dark scrim and light text.
//
// Bands are dark in BOTH themes on purpose. The page alternates quiet themed
// sections with these, and that alternation is what gives the page its
// contrast: text on a scrimmed photo has nowhere to wash out. Making the
// scrim theme-dependent would put the contrast back at the mercy of whichever
// photo is dropped in.
//
// Photos live in /public/photos and are swapped by overwriting the file. See
// public/photos/README.md for the slot list and aspect ratios.

export function PhotoBand({
  photo,
  alt = "",
  priority = false,
  // "heavy" for bands carrying a lot of text, "light" where the photo should
  // breathe and the content is a single line.
  scrim = "heavy",
  className = "",
  children,
}) {
  return (
    <section className={`relative isolate overflow-hidden ${className}`}>
      <Image
        src={`/photos/${photo}`}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            scrim === "heavy"
              ? "linear-gradient(180deg, rgb(14 12 10 / 0.72) 0%, rgb(14 12 10 / 0.58) 45%, rgb(14 12 10 / 0.78) 100%)"
              : "var(--scrim)",
        }}
      />
      {children}
    </section>
  );
}
