"use client";

import Image from "next/image";

// A full-bleed photographic section with light text over it.
//
// The overlay is deliberately NOT a flat dim across the whole photo. Dimming
// the entire frame is the easy way to guarantee contrast and it is also what
// makes a good photograph look grey and lifeless. Instead the photo runs at
// full brightness and the darkening is pooled where the words actually sit:
//
//   "pool" - a soft elliptical shadow behind centred copy, fading to nothing
//            well before the edges, so the picture still reads as a picture.
//   "veil" - barely there. It only takes the edge off bands whose content
//            already brings its own backdrop (the floating screenshot, the
//            smoked-glass cards), which is where the contrast actually comes
//            from. Raise a card's plate before you ever raise this.
//
// Bands are dark in BOTH themes on purpose: the contrast guarantee should not
// depend on which photo gets dropped in, or on the visitor's theme.
//
// Photos live in /public/photos and are swapped by overwriting the file.

const OVERLAY = {
  pool:
    "radial-gradient(ellipse 72% 62% at 50% 50%, rgb(0 0 0 / 0.42) 0%, rgb(0 0 0 / 0.22) 50%, rgb(0 0 0 / 0.04) 80%, rgb(0 0 0 / 0) 100%)",
  veil: "linear-gradient(rgb(0 0 0 / 0.06), rgb(0 0 0 / 0.06))",
};

export function PhotoBand({
  photo,
  alt = "",
  priority = false,
  scrim = "pool",
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
        // 90 rather than the Next 16 default of 75: these photographs are the
        // page's main visual and 75 softens them noticeably. Allowlisted in
        // next.config.mjs.
        quality={90}
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: OVERLAY[scrim] ?? OVERLAY.pool }}
      />
      {children}
    </section>
  );
}
