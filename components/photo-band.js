"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

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
  // Sits slightly above centre because that is where a headline's first line
  // lands, and the first line is the one that fails: the top of a landscape
  // is usually sky, which is the palest thing in the frame.
  pool:
    "radial-gradient(ellipse 74% 64% at 50% 44%, rgb(0 0 0 / 0.55) 0%, rgb(0 0 0 / 0.30) 50%, rgb(0 0 0 / 0.05) 82%, rgb(0 0 0 / 0) 100%)",
  veil: "linear-gradient(rgb(0 0 0 / 0.06), rgb(0 0 0 / 0.06))",
};

// Parallax geometry. The photo is rendered OVERSCAN percent taller than the
// band and pulled up by half of that, so it has slack above and below. TRAVEL
// is how far it slides, as a share of its own height, and must stay under
// OVERSCAN / 2 or an edge shows at the extremes:
//
//   travel off centre = TRAVEL% x (100 + OVERSCAN)% = 7.4% of band height
//   slack on each side = OVERSCAN / 2                = 12%  of band height
//
// The margin between those two is what stops a rounding error or an unusual
// band height from showing a seam, so keep it comfortable rather than exact.
const OVERSCAN = 24;
const TRAVEL = 6;

function BandPhoto({ photo, alt, priority, sectionRef }) {
  // 0 when the band's top reaches the bottom of the viewport, 1 when its
  // bottom leaves the top, so 0.5 is the band dead centre and the photo sits
  // at its neutral position there.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [`-${TRAVEL}%`, `${TRAVEL}%`]);

  return (
    <motion.div
      className="absolute inset-x-0 -z-20"
      style={{
        top: `-${OVERSCAN / 2}%`,
        height: `${100 + OVERSCAN}%`,
        y,
        willChange: "transform",
      }}
    >
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
        className="object-cover"
      />
    </motion.div>
  );
}

function StaticPhoto({ photo, alt, priority }) {
  return (
    <Image
      src={`/photos/${photo}`}
      alt={alt}
      fill
      priority={priority}
      quality={90}
      sizes="100vw"
      className="-z-20 object-cover"
    />
  );
}

export function PhotoBand({
  photo,
  alt = "",
  priority = false,
  scrim = "pool",
  className = "",
  children,
}) {
  const sectionRef = useRef(null);
  const reduce = useReducedMotion();

  return (
    <section ref={sectionRef} className={`relative isolate overflow-hidden ${className}`}>
      {reduce ? (
        <StaticPhoto photo={photo} alt={alt} priority={priority} />
      ) : (
        <BandPhoto photo={photo} alt={alt} priority={priority} sectionRef={sectionRef} />
      )}
      {/* The overlay does NOT move with the photo. If it did, the shadow behind
          the headline would drift off the words as the band scrolls, which is
          exactly the contrast the overlay exists to guarantee. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: OVERLAY[scrim] ?? OVERLAY.pool }}
      />
      {children}
    </section>
  );
}
