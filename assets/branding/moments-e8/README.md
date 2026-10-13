# Moments official logo (E8)

A solid coral heart (`#FF4D6D`) whose lower half is drawn as two straight lines
that taper to a dot. The lines' ends sit on the heart's own outline and every
gap is equal, so the whole mark still reads as one heart. The app icon puts it
on night blue (`#1F1B3A`).

The mark is all coral with no white parts, so one transparent version works on
light and dark backgrounds.

## Source files (SVG)

| File | What it is |
| --- | --- |
| [icon-square.svg](icon-square.svg) | App icon, square and full bleed. iOS rounds the corners itself. |
| [icon-rounded.svg](icon-rounded.svg) | Rounded-corner icon for previews. |
| [mark-transparent.svg](mark-transparent.svg) | Just the mark, transparent background. |
| [social-black.svg](social-black.svg) | Social profile picture, pure black. |
| [social-white.svg](social-white.svg) | Social profile picture, pure white. |
| [android-foreground.svg](android-foreground.svg) | Android adaptive icon foreground (transparent, mark in the safe zone). |

## Images (PNG, in `png/`)

| Files | Background | Use |
| --- | --- | --- |
| `app-icon-1024.png` … `app-icon-29.png` | Night blue, no alpha channel | App Store (1024) and iOS sizes 180/120/87/80/60/58/40/29 |
| `icon-rounded-transparent-{1024,512,256,128}.png` | Transparent corners | Website, decks, press |
| `mark-transparent-{2048,1024,512,256}.png` | Transparent | The logo anywhere: light or dark pages, photos, merch |
| `social-black-{1080,400}.png` | Pure black `#000000` | Social profile picture (safe for circle crops) |
| `social-white-{1080,400}.png` | Pure white `#FFFFFF` | Social profile picture (safe for circle crops) |
| `android-adaptive-foreground-1024.png` | Transparent | Android adaptive icon (background `#1F1B3A`) |

Apple rejects App Store icons with an alpha channel, so the app icon and
social files are saved as plain RGB.

## In the app

- `<LogoMark />` (`src/components/ui/Logo.tsx`) draws this mark as a vector;
  below 40 px it switches to a one-line version so it stays clear.
- `<Wordmark />` (`src/components/ui/Wordmark.tsx`) is the lockup: the mark
  beside "Moments" in heavy sans. It appears on the launch screen (animated:
  the mark rises in, then gently beats), on login and create-account, and in
  the Home/Play top bar before you pair.
- Share cards (`ShareBrand`) show the mark in their "Moments" pill.
- Android notifications use `assets/images/notification-icon.png`, a white
  silhouette of the mark, tinted coral (`expo-notifications` in `app.json`).
- `assets/images/moments-logo.png` / `.svg`: the transparent mark
  (`MOMENTS_LOGO_PNG` / `MOMENTS_LOGO_SVG` in `src/constants/brand-assets.ts`).
- `assets/images/app-icon.png` and `app-icon-android-foreground.png`: the app
  icon in `app.json`. The splash screen shows the mark on white, or on black
  in dark mode.

## Geometry

In a 100-unit box: the heart is cut flat at y 61.5; the lines are 3.4 thick;
the dot has radius 2.1. The gaps from the cut to line 1, line 1 to line 2, and
line 2 to the dot are all 3.15.
