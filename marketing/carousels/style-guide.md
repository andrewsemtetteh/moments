# Carousel Style Guide

## Sizes

**One standard size for everything: 1080 × 1350 (4:5).** The same `slides/` folder is uploaded to
Instagram, TikTok Photo Mode (it supports 4:5) and Pinterest.

## The brand system

- **Fixed grid:** 88px margins. No series label on any slide — the cover headline carries the topic.
- **Logo only on the last slide:** the official lockup `assets/branding/moments-e8/logo/lockup-dark.svg`
  (mark + "Moments", never retyped) centered at the bottom of the save slide.
- **Surfaces:** solid night blue `#1F1B3A` (the app icon color) for every slide. Cover and save slides are
  text on the background; content slides are a white card on a fanned stack of two back cards.
- **Illustrations:** one real scene per post on the cover only, in context with the topic (`_tools/illustrations.mjs`,
  picked with `"illustration"` in post.json) — e.g. a couple asleep under one blanket for bedtime. Flat shapes with
  soft gradient shading in the theme palette (coral, white, night-blue tones), diverse couples. Universal topics: no country- or season-specific references (no fall/Halloween-only content). No floating particles/sparkles, no stock art, no emoji.
- **Captions** (`caption.md`) are where the personality goes: playful, emoji welcome, 3 short lines + 5 hashtags.
- **Arms:** always use `arm()` — starts *inside* the torso at (cx ± 34, 324) so the rounded sleeve never pokes out past the shoulder; elbows stay inside the body outline too, bends at the elbow, sleeve-colored upper arm, skin forearm, natural length. Never a single tube from the chest or the bottom edge. When seated at a table (writing, eating), the forearm rests on the table in front of the body — no bent arm sticking out past the body outline. Zoom-check hands with `_tools/zoom.mjs`. An arm that wraps around someone (hug) is drawn *before* that person so it passes behind them — only the hand peeks out. Tables get a solid front panel so bodies don't show underneath.
- **Figures:** build new people with `bust()` + `figureDefs()` in `_tools/illustrations.mjs` (short tucked neck, collar, hair, eyes/mouth/brow presets) so every cover stays consistent.
- **Figure anatomy:** draw the neck *before* the torso and long enough to tuck under it, then add a small
  skin-colored neckline opening on the torso so the neck flows into the collar. Keep the visible neck short
  (shoulders sit just below the chin). Bust figures fade out at the bottom instead of being cut flat.
- **Alignment:** label, cover and save slide are centered on the vertical axis. Question cards carry the
  count only in the card footer (no number at the top). The save slide is a bookmark icon, text and the logo.
- **Voice:** the brand speaks *to* the reader ("you", "couples"), never as a couple ("we", "our relationship").
- **Save line matches the post:** "Save this *for {moment}*" (tonight / your next date night / your next visit).
- **Accent:** official coral `#FF4D6D` (slightly deeper `#E8395B` on white cards).
- **Type:** DM Serif Display for headlines (the app’s display serif), italic in the accent color for the
  1–3 words that carry the emotion. Inter for labels and small text.
- **No emoji, no stickers, no gradients, no stock graphics.** Typography and color do the work.
- **Every post changes three things, chosen to fit the topic** (set in `post.json`):
  - `theme`: one of the app's brand themes — `night`, `blue`, `coral`, `violet`, `cream`, `sunny`, `blush`, plus secondary/candy palettes `electric`, `mint`, `ink`, `lilac`, `peach`, `sky`
    (`_tools/render.mjs` → `THEMES`, sourced from `src/constants/design-system.ts`). Don't repeat the
    previous post's theme.
  - `cardStyle`: the content-card design — `stack` (fanned deck), `ticket` (boarding pass), `sticky` (sticky-note to-do), `versus` (A/B split, used by `choice` slides), `polaroid` (used by `idea` slides, art in `POLAROID_ART`), `tracker` (habit tracker with streak), `receipt` (printed receipt with torn edge), `chat` (text-message screen), `postcard` (landscape postcard with stamp), `notebook` (lined notebook page). Long lists use `list` slides (`strips`, 3 items per slide, colors from the theme `palette`). Invent a new
    style when a topic suggests one (e.g. chat bubbles, polaroids, menu cards, receipts, calendar pages)
    and add it to `CARD_STYLES`.
  - `illustration`: a new cover scene for the topic (`_tools/illustrations.mjs`).
- **Visibility:** every element must read clearly on its background. Fix contrast by changing the color, never
  by adding boxes/pills: on colorful themes the logo heart takes the theme highlight (`logoMark`, e.g. yellow
  on blue), and illustration details that sit on the background (like the plane) use the highlight (`pop`).
- **Clarity first:** question/prompt cards show the prompt and nothing else that isn't needed — no filler labels ("Capsule 01", "Mile 12", "Track 01"). Keep a label only when it carries meaning (an award, a time, a room). Big type, strong contrast.
- **Learn from winners:** 1.1 and 1.5 perform best — one idea per card, relatable/emotional, simple stack or flag cards.
- **No gradients:** every background, card and illustration fill is a flat color. (Hard-edged patterns like ruled lines, dots and stripes are fine.)
- **Mix in long lists:** regularly do big list posts (15 date ideas, 30 truth or dare, 30 questions) using `list` strips, three items per slide.
- **Research first:** before planning new posts, search the web for current couple-content trends and question/date lists for inspiration, then rewrite in the brand voice.
- **Never changes:** fonts, 4:5 size, centered cover + save slide, outline bookmark + lockup on the save slide,
  one italic accent phrase per headline, no emoji on slides.

| Post | Theme | Card style | Illustration |
|---|---|---|---|
| 1.1 Before bed | night | stack | couple asleep, window + lamp |
| 1.2 15 ways to say I love you | coral | `notes` love-jar paper notes (torn edges, fold) | pulling a note from the love jar |
| 1.3 Never admit | blush | `file` confidential case files (stamp, redaction) | her in his hoodie, him with the empty hanger |
| 1.4 Finish the sentence | violet | `blank` fill-in index cards with a pencil | writing in one shared notebook |
| 1.5 Green flags | mint | `flag` waving green flag cards | his umbrella tilted over her |
| 2.1 Long distance | blue | ticket (boarding pass, "Seat: next to you") | video call across time zones |
| 2.2 Never have I ever (×16) | electric | `checks` scorecard with Me/You tick circles | both holding up fingers |
| 2.3 Bucket list (×16) | cream | `stamps` passport pages with inked visa stamps | holding an unfolded map |
| 2.4 Before moving in | night | `box` kraft moving boxes with shipping labels | carrying one box together |
| 2.5 Instead of "calm down" | peach | `swap` red-pen strikethrough → better phrase | scribbled-out bubble vs. heart bubble |
| 3.1 Acts of service | coral | sticky (taped to-do notes, ticked box, "love, me") | coffee hand-off on the couch |
| 3.2 Couples bingo | sunny | `bingo` 4×4 L·O·V·E cards with FREE square | a high five |
| 3.3 When they're stressed | sky | `teabag` tea bags with string + tag | a back hug, mug in hand |
| 3.4 Anniversary questions | ink | `film` film-strip frames | cake with one candle, bunting |
| 3.5 Say vs. mean | lilac | `dict` dictionary entries | reading the couples dictionary |
| 4.1 This or That | violet | versus (A/B split card, "or" badge; slide type `choice`) | couple holding A/B voting paddles |
| 4.2 Weekly check-in | mint | `weather` forecast cards | mugs under a sun and cloud |
| 4.3 More romantic than flowers | night | `exhibit` gallery frame + museum label | pointing at a framed heart |
| 4.4 Mystery date night | blush | `envelopes` → `letters` wax-sealed envelopes | each holding an envelope |
| 4.5 How to apologize | electric | `manual` assembly instructions | offering a bouquet |
| 5.1 Cozy date ideas | cream | polaroid (illustrated photo, "date no. X" stamp; slide type `idea`) | under one blanket by a blanket fort |
| 5.2 How well do you know me | coral | `scratch` quiz answer sheets (guess / answer / point) | quiz card up, him thinking |
| 5.3 Things happy couples stopped doing | blue | `signs` road signs (stop → go) | a U-turn sign between them |
| 5.4 Phone-free dinner | ink | `fortune` fortune cookies + paper slip | cracking fortune cookies |
| 5.5 Myths busted | sunny | `news` newspaper clipping + BUSTED stamp | reading the newspaper |
| 6.1 Habits of couples who last | sunny | tracker (habit + 7-day ticks + streak) | brushing teeth side by side at the mirror |
| 7.1 Exhausted dates | blush | receipt ("The lazy date", effort/cost/time, torn edge) | collapsed on the sofa with takeout |
| 8 Fall in love again | night | chat (sent text bubble, partner typing) | slow-dancing in the kitchen |
| 9 Long distance dates | violet | postcard (perforated stamp, postmark, handwritten address) | split-screen dinner, day/night |
| 10 Dating your best friend | coral | notebook (ruled page, punch holes, doodled heart) | sharing wired earphones, laughing |
| 11 Would you rather (×18) | electric | `list` strips (3 candy game cards per slide) | card game, "?" card held up |
| 12 Truth or dare (×12) | ink | `pair` playing cards (cream Truth + coral Dare, corner indices) | DARE card up, him covering his mouth |
| 13 Get to know you (×30) | mint | `menu` conversation menu (6 courses, gold double rule) | top-down, head to head on a picnic blanket |
| 14 Free dates (×10) | peach | `coupons` love coupons (cut line, scissors, FREE stub) | tandem bike, side view |
| 15 After an argument | sky | `calm` reset cards (breathing orb, step name, tip) | making up with a pinky promise |
| 16 Long distance truths (×8) | lilac | `tags` luggage tags (hole + string, "handle with care") | first hug at arrivals |
| 17 Attachment styles | cream | `folder` color-tabbed file folders, one per style | arms crossed, faces turned away |
| 18 Grade your relationship | sunny | `report` school report card (A–D, teacher's note) | holding up a red A+ report card |

## Design principles (from research on what performs)

- **One idea per slide**, readable at a glance; text sits in the middle of the screen.
- **Every slide must stand alone** — TikTok can show any slide first, so each card carries the series chip and count.
- **Curiosity gap on the cover** ("the last one always gets them") and **escalating depth** — light questions first, the most emotional last.
- **Clean, minimal, premium** — conversation-card aesthetic, not busy Canva templates.
- **Pre-launch CTA = save.** The last slide is always "Save this for …" with a bookmark icon — saves are
  the strongest ranking signal and build an audience before the app is out. After launch, switch to
  "Search “Moments” on the App Store".

## Look & feel

- **Two template families** to keep the feed varied:
  - *Text-on-photo*: cozy couple stock/lifestyle photo (hands, coffee, blankets, city lights), dark overlay, big text. Best for date ideas, LDR, psychology.
  - *Clean brand card*: solid warm background, large type, small E8 logo. Best for questions, This or That, challenges.
- **Colors**: use the app's palette from `src/constants/theme.ts` (warm rose `#A83E52`, peach `#F0A090`, amber `#E0A868`, cream `#EFE4D3`) so posts feel like the app.
- **Type**: one bold display font for headlines, one clean sans for body. Headline ≥ 80px, body ≥ 48px.
- **Logo**: small E8 mark (`assets/branding/moments-e8`) bottom corner of every slide. Never big.
- **Slide counter** (e.g. "3/7") top right — boosts swipe-through.
- **Swipe cue** on slide 1: "→" or "swipe for #1".

## Photos

- Free sources: Unsplash, Pexels. Avoid faces looking at camera — hands, silhouettes, backs, objects feel more "you".
- Never use photos of real public figures or other brands' screenshots.
- App screenshots only on F9/F10/F11 slides — framed in a phone mockup.

## Captions

```
{1-line hook restated or a question}
{1–2 lines of value or context}
{CTA: save / send / comment}
{3–5 hashtags}
```

## Hashtags (rotate, 3–5 per post)

- Core: `#couplegoals #relationshiptips #couples #dateideas`
- LDR: `#longdistancerelationship #ldr #ldrcouple`
- Psych: `#lovelanguages #attachmentstyle #healthyrelationships`
- Seasonal: `#falldates #cuffingseason #valentinesday`

## CTA rules

- Value posts → "Save this" / "Send to your person" (no app mention needed)
- Soft-sell → last slide: "We made Moments for this ✨" + app icon
- Direct-sell (Sundays) → "Moments — free on the App Store. Link in bio."
- Always have the App Store link in bio on every platform.

## Music (TikTok)

Add a trending sound to every photo post — it noticeably helps distribution. Pick from TikTok's "trending" tab on the day of posting.

### Oct 24–31 extra posts (`k` cards — one shared layout, `variant` sets the object design; covers use `duo()` couple + object)

| Post | Theme | Variant | Cover object |
|---|---|---|---|
| 6.2 Rainy day dates for couples who love staying in | sky | `rain` | window |
| 6.3 Couple pet names, ranked | coral | `podium` | podium |
| 6.4 Bored? Roll a question | violet | `dice` | dice |
| 6.5 Signs you've been together a long time | night | `badge` | trophy |
| 7.2 Which love language are you? | lilac | `bubble` | clipboard |
| 7.3 Little love notes to leave around the house | cream | `napkin` | mugnote |
| 7.4 Couple goals that aren't on social media | electric | `stars` | bigstar |
| 7.5 Questions for a deep night talk | ink | `depth` | moonstars |
| 8.2 Movie night rules every couple needs | sunny | `clapper` | popcorn |
| 8.3 Texts to send your partner today | blue | `lock` | phone |
| 8.4 Ways to make a normal day feel special | mint | `seeds` | flowerpot |
| 8.5 How to stop arguing about chores | peach | `wheel` | spinner |
| 9.2 Questions to ask your partner about their childhood | coral | `cassette` | tape |
| 9.3 Red flags you might be ignoring in yourself | cream | `hazard` | warning |
| 9.4 The 7-day tiny surprise challenge | blush | `advent` | gift |
| 9.5 How to keep the spark after years together | ink | `matches` | match |
| 10.2 Rate these date ideas from 1 to 10 | electric | `rating` | ratecard |
| 10.3 Questions about the future (no pressure) | lilac | `capsule` | jar |
| 10.4 Inside jokes every couple has | sunny | `comic` | haha |
| 10.5 How to support your partner's dreams | night | `mission` | rocket |
| 11.2 The 60-second hot seat | peach | `stopwatch` | stopwatch |
| 11.3 Little rituals happy couples have | sky | `clock` | clock |
| 11.4 Date ideas for homebodies | mint | `house` | house |
| 11.5 What your sleeping position says about you two | violet | `bed` | bed |
| 12.2 Compliments that hit different | blush | `rosette` | rosette |
| 12.3 Questions to ask on a road trip | sunny | `plate` | car |
| 12.4 How to be a better listener | night | `wave` | headphones |
| 12.5 Signs you're living like roommates | coral | `thermo` | thermometer |
| 13.2 Date ideas for introverts | lilac | `hanger` | doorhanger |
| 13.3 Questions to rekindle romance | ink | `candle` | candle |
| 13.4 What couples argue about most (and the fix) | blue | `boxing` | gloves |
| 13.5 Small promises to make each other | cream | `contract` | scroll |
