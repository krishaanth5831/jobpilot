# Landing page photographs

Four photographs, one per full-bleed band on the landing page. Swap one by
overwriting the file. No code change is needed: the filenames are the
contract.

| File | Where it appears | Aspect | Minimum width |
| --- | --- | --- | --- |
| `hero.jpg` | Behind the headline, top of the page | 16:9 or wider | 2400px |
| `verdict.jpg` | Behind the floating job-match screenshot | 21:9 | 2400px |
| `steps.jpg` | Behind "How it runs" | 21:9 | 2400px |
| `toolkit.jpg` | Behind "The rest of the application" | 21:9 | 2000px |

## Choosing images

Photos run at full brightness. Contrast is bought locally, by the plate or
the shadow behind each piece of text, not by dimming the frame, so a bright
photo is not just fine, it is the point. What matters is composition:

- Leave a calm, uncluttered region where the text sits. `hero.jpg` carries a
  large centred headline, so busy detail through the middle fights it.
- Wide landscapes, water, forest canopy, mist, and aerial terrain all work.
- Avoid anything with legible text, faces, or a recognisable logo in it.
- Horizontal images only. These are full-bleed bands, and a portrait crop will
  lose most of its subject.

## Before committing a real photo

These photographs are the page's main visual, so they are encoded for quality
rather than for the smallest possible file. Resize to **3840 wide** and encode
at quality 90 with full chroma. 3840 is the largest width `next/image` will
ever ask for, so anything wider is wasted and anything narrower gets upscaled
on a 4K or retina screen. Do not touch levels, curves, or saturation: resize
only, so what ships is the brightness of the original.

`sharp` is already a dependency, so from the project root:

```bash
node -e "require('sharp')('/path/to/original.jpg') \
  .resize(3840, null, {withoutEnlargement:true, kernel:'lanczos3'}) \
  .jpeg({quality:90, mozjpeg:true, progressive:true, chromaSubsampling:'4:4:4'}) \
  .toFile('public/photos/hero.jpg')"
```

Sources land around 1 to 1.7MB. What ships is much smaller: `next/image`
re-encodes to WebP or AVIF at the width the viewport actually needs, at
`quality={90}` set in `components/photo-band.js`. That 90 has to stay in the
`images.qualities` allowlist in `next.config.mjs`, because Next 16 forces
every image to 75 otherwise and it visibly softens them.

Only `hero.jpg` is loaded eagerly; the rest lazy-load as the page scrolls.

**If a swapped photo does not appear**, the optimizer has cached the old one.
Delete `.next/cache/images` and restart, and hard-reload the browser.

## Licensing

Use photographs you own or that carry a licence permitting commercial use
(Unsplash and Pexels both do). Keep a note of the source for each one.
