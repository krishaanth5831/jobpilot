"use client";

import Image from "next/image";

// A full-bleed photographic section with light text over it.
//
// The overlay is deliberately NOT a flat dim across the whole photo. Dimming
// the entire frame is the easy way to guarantee contrast and it is also what
// makes a good photograph look grey and lifeless. Instead the photo runs at
// full brightness and the darkening is pooled where the words actually sit:
//
//   "pool" - an elliptical shadow behind centred copy. The edges of the frame
//            keep their colour, so the picture still reads as a picture.
//   "veil" - a light, even wash for bands whose content brings its own
//            backdrop (the floating screenshot, the step cards).
//
// Bands are dark in BOTH themes on purpose: the contrast guarantee should not
// depend on which photo gets dropped in, or on the visitor's theme.
//
// Photos live in /public/photos and are swapped by overwriting the file.

const OVERLAY = {
  pool:
    "radial-gradient(ellipse 78% 68% at 50% 50%, rgb(0 0 0 / 0.68) 0%, rgb(0 0 0 / 0.42) 48%, rgb(0 0 0 / 0.14) 78%, rgb(0 0 0 / 0.06) 100%)",
  veil: "linear-gradient(rgb(0 0 0 / 0.22), rgb(0 0 0 / 0.22))",
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
