# Landing page photographs

The four files here are **placeholders**. Overwrite them with real photographs
and the landing page picks them up. No code change is needed: the filenames
are the contract.

| File | Where it appears | Aspect | Minimum width |
| --- | --- | --- | --- |
| `hero.jpg` | Behind the headline, top of the page | 16:9 or wider | 2400px |
| `verdict.jpg` | Behind the floating job-match screenshot | 21:9 | 2400px |
| `steps.jpg` | Behind "How it runs" | 21:9 | 2400px |
| `free.jpg` | Behind "Free right now." | 21:9 | 2000px |

## Choosing images

Every band gets a dark scrim over the photo and sets its text in near-white,
so contrast is handled for you and a bright photo is fine. What matters is
composition:

- Leave a calm, uncluttered region where the text sits. `hero.jpg` carries a
  large centred headline, so busy detail through the middle fights it.
- Wide landscapes, water, forest canopy, mist, and aerial terrain all work.
- Avoid anything with legible text, faces, or a recognisable logo in it.
- Horizontal images only. These are full-bleed bands, and a portrait crop will
  lose most of its subject.

## Before committing a real photo

Keep each file to roughly 200-300KB. `sharp` is already a dependency, so from
the project root:

```bash
node -e "require('sharp')('/path/to/original.jpg').resize(2400).jpeg({quality:78,mozjpeg:true}).toFile('public/photos/hero.jpg')"
```

Only `hero.jpg` is loaded eagerly; the rest lazy-load as the page scrolls.

## Licensing

Use photographs you own or that carry a licence permitting commercial use
(Unsplash and Pexels both do). Keep a note of the source for each one.
