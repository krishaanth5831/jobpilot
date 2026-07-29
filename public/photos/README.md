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
Next 16 keeps **two** image caches and clearing one is not enough:

```bash
rm -rf .next/cache/images .next/dev/cache/images
```

`.next/cache/images` serves `next build` / `next start`; `.next/dev/cache/images`
serves `next dev`. Restart the server after deleting them.

Then hard-reload the browser with Ctrl+Shift+R. A normal reload is not enough:
the optimized URL is `/_next/image?url=/photos/hero.jpg&w=1920&q=90`, which is
byte-identical before and after a swap because only the file's *contents*
changed. The browser has no way to know and will serve its cached copy.

Sanity check that does not depend on any cache, comparing what the optimizer
sends against what is on disk:

```bash
curl -s -H 'accept: image/webp' \
  'http://localhost:3000/_next/image?url=%2Fphotos%2Fhero.jpg&w=1920&q=90' -o /tmp/served.webp
node -e "const s=require('sharp');(async()=>{const m=x=>x.channels.slice(0,3).map(c=>c.mean.toFixed(0)).join('/');
  console.log('served',m(await s('/tmp/served.webp').stats()),'disk',m(await s('public/photos/hero.jpg').stats()))})()"
```

Fetching `/photos/hero.jpg` directly proves nothing: that is the raw static
file, and the page never loads it.

## Licensing

Use photographs you own or that carry a licence permitting commercial use
(Unsplash and Pexels both do). Keep a note of the source for each one.

Current set, all Unsplash (free for commercial use, no attribution required):

| File | Subject | Unsplash id |
| --- | --- | --- |
| `hero.jpg` | Mountain ridges above a sea of cloud, blue hour | `photo-1548679847-1d4ff48016c7` |
| `verdict.jpg` | Braided glacial river from above, blue and gold | `photo-1543157446-a57c71334d95` |
| `steps.jpg` | Fog through a conifer forest | `photo-1489471289653-9358c5993932` |
| `toolkit.jpg` | Terraced rice fields from above | `photo-1480996408299-fc0e830b5db1` |

Fetch any of them again with
`https://images.unsplash.com/<id>?w=3840&q=95&fm=jpg&fit=max`.

**Check the aspect ratio before you commit to a candidate.** Search-result
thumbnails are cover-cropped to a landscape cell, which hides portrait images
completely. These are full-bleed bands: anything under about 1.4:1 loses most
of its subject.
