# Moments — Photo Carousel System

Daily photo-carousel posts for TikTok (Photo Mode), Instagram (carousel) and Pinterest (idea pins).
The goal is **volume without burnout**: every post is built from a reusable *format*, filled
with *variables*, and produced in weekly batches.

## How it works

```
Pillar (why people care)  →  Format (slide structure)  →  Variables (topic/season/budget)  →  Post
   7 pillars                    ~12 formats                    endless combos                1/day
```

- **Pillars** — the 7 themes we rotate through, one per weekday. See [pillars-and-formats.md](pillars-and-formats.md).
- **Formats** — fixed slide-by-slide recipes ("N date ideas for X", "questions to ask when Y"). Once a format is designed in Canva, every new post is just new text.
- **Hooks** — slide 1 is 80% of performance. Pick from [hooks.md](hooks.md), never improvise at 11pm.
- **Backlog** — the queue of planned posts lives in [backlog.md](backlog.md). Always keep 2+ weeks queued.
- **Posts** — one numbered folder per post (`1/`, `2/` …) holding its script, slide spec and final PNGs. New scripts start from [_template.md](_template.md).
- **Bulk** — CSVs in [bulk/](bulk/) feed Canva *Bulk Create*, so one format can turn into 10 posts in minutes.

## Folder layout

```
marketing/carousels/
├── README.md               ← you are here (the system)
├── pillars-and-formats.md  ← weekly rhythm + every reusable format
├── hooks.md                ← hook bank for slide 1
├── style-guide.md          ← sizes, fonts, colors, captions, hashtags, CTA rules
├── backlog.md              ← the content queue (status tracked here)
├── _template.md            ← copy into a new numbered folder as script.md
├── _tools/render.mjs       ← turns slideshow/<n>/post.json into PNG slides (headless Chrome)
├── _tools/fonts/           ← Inter (UI text); serif + script fonts come from assets/fonts
├── bulk/                   ← CSVs for Canva Bulk Create
│   └── questions-format.csv
└── slideshow/              ← posts by date: <year>/<MM - month>/<post number> - <day> (number prefixes keep everything in calendar order)
    └── 2026/
        ├── 10 - october/
        │   ├── 1 - 19th/       ← launch week: one folder per day, 5 posts inside
        │   │   ├── 1.1/        ← each post: caption.md, script.md, post.json, slides/, preview.png
        │   │   ├── 1.2/
        │   │   └── … 1.5/
        │   ├── 2 - 20th/2.1 …  (days 1–7 = Oct 19–25)
        │   ├── 8 - 26th/       ← from Oct 26: one post per day, the folder *is* the post
        │   └── …
        ├── 11 - november/
        └── 12 - december/
    └── 2027/01 - january … 12 - december/
```

Render a post by its number: `node marketing/carousels/_tools/render.mjs 1.1` (or several: `... 1.1 1.2 14`). New post = new folder `slideshow/<year>/<MM - month>/<n> - <day>` (e.g. `2026/11 - november/14 - 1st`). Multi-post days are a day folder with numbered posts inside (`1 - 19th/1.1` … `1.5`) — render with `render.mjs 1.2`.

## Weekly workflow (≈3 hours/week for 7 posts)

| When | Task | Time |
|---|---|---|
| Sunday | Pick next 7 rows from `backlog.md`, write `script.md` + `post.json` in the next numbered folders | 60 min |
| Sunday | Render with `_tools/render.mjs` (or Canva Bulk Create) → PNGs land in the post folder | 60 min |
| Sunday | Schedule (TikTok Studio / Meta Business Suite / Later) | 20 min |
| Daily | Reply to comments for 15 min after posting — comments boost reach | 15 min |
| Friday | Log views/saves/shares in `backlog.md`, double down on the top 2 formats | 15 min |

## The rules

1. **80/20 value vs. product.** 4 of 5 posts are pure value; Moments appears naturally on one slide or the last slide. 1 in 5 is openly about the app.
2. **Save- or send-worthy, every time.** Ask: *"Would someone save this or send it to their partner?"* If not, rewrite.
3. **One idea per slide, ≤ 20 words.** Big text, readable in 1 second.
4. **5–8 slides.** Enough to swipe, short enough to finish (completion rate matters).
5. **The last slide always has a CTA** — "send this to your person", "save for date night", or "we built an app for this → Moments".
6. **Repost winners.** A post that hits 2× average gets a remake 3–4 weeks later with a new hook.
7. **Same post, 3 platforms.** Post natively to TikTok, Instagram and Pinterest — don't share links across.

## Scaling up later

- **Multiple accounts:** once a format works, run a 2nd faceless account (e.g. an LDR-only page) reusing the same templates.
- **Pull from the app:** the app already contains hundreds of prompts — question packs, date ideas, games
  (`src/constants/activity-content.ts`, `date-ideas.ts`, `curated-experiences.ts`). Every pack is a ready-made carousel.
- **Automation:** if Canva Bulk Create becomes the bottleneck, render slides from the CSVs with an HTML template + a headless browser script.
