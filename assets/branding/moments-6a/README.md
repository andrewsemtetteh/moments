# Moments logo: 6A "A moment rising" (night)

> **Replaced by the official logo, E8: see [../moments-e8](../moments-e8/README.md).** Kept for reference; the app no longer uses these files.

A deep coral heart (`#FF4D6D`) rising over a white horizon on night blue
(`#1F1B3A`), with two reflection lines, centred in the tile.

## Source files (SVG)

| File | What it is |
| --- | --- |
| [icon-square.svg](icon-square.svg) | App icon, square and full bleed. iOS rounds the corners itself. |
| [icon-rounded.svg](icon-rounded.svg) | Rounded-corner icon for previews (same as `../logo-options/6a-night.svg`). |
| [mark-for-dark-bg.svg](mark-for-dark-bg.svg) | Just the mark, transparent, white horizon. Use on dark backgrounds. |
| [mark-for-light-bg.svg](mark-for-light-bg.svg) | Just the mark, transparent, night-blue horizon. Use on light backgrounds. |
| [android-foreground.svg](android-foreground.svg) | Android adaptive icon foreground: transparent, mark inside the safe zone. |

## Images (PNG, in `png/`)

| Files | Background | Use |
| --- | --- | --- |
| `app-icon-1024.png` … `app-icon-29.png` | Opaque, no alpha channel | App Store and `app.json` `icon` (1024), iOS sizes 180/120/87/80/60/58/40/29 |
| `icon-rounded-transparent-{1024,512,256,128}.png` | Transparent corners | Website, pitch decks, socials, press |
| `mark-transparent-for-dark-bg-{2048,1024,512}.png` | Transparent | Mark on dark screens/photos |
| `mark-transparent-for-light-bg-{2048,1024,512}.png` | Transparent | Mark on white/light pages, splash on light |
| `android-adaptive-foreground-1024.png` | Transparent | `app.json` `android.adaptiveIcon.foregroundImage` (background colour `#1F1B3A`) |
| `social-profile-dark-{1080,400}.png` | Black, mark centred | Social profile picture; still fits when cropped to a circle (source: [social-profile-dark.svg](social-profile-dark.svg)) |

## In the app

- `<LogoMark />` (`src/components/ui/Logo.tsx`) draws this mark as a vector.
  Its horizon follows the theme's text colour, so it's ink on light themes
  and white on dark ones. `on="light"` / `on="dark"` force a version.
- The share-card pill (`ShareBrand`) always uses the dark-horizon version,
  because the pill is white.
- `assets/images/moments-mark-on-light.png` / `moments-mark-on-dark.png` are
  the transparent rasters (`MOMENTS_MARK_ON_*_PNG` in `src/constants/brand-assets.ts`).
- Splash screen (`app.json`): the light version on white, and in dark mode the
  dark version on black. The app icon itself is still the old one.

Apple rejects App Store icons that contain an alpha channel, so the `app-icon`
files are saved as plain RGB.

The PNGs were rendered from the SVGs with resvg, so to change the logo, edit the
SVGs and re-render.
