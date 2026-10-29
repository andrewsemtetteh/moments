/**
 * The Moments home-screen widgets (iOS). Built into the app by
 * @bacons/apple-targets at prebuild / EAS Build time; not available in Expo Go.
 * Data comes from the app through the shared App Group (src/lib/widget-data.ts).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'MomentsWidgets',
  // containerBackground and the Lock Screen widgets need iOS 17.
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
      'group.com.vasemti.moments',
    ],
  },
  colors: {
    $accent: '#FF4D6D',
    $widgetBackground: '#FFFFFF',
  },
  // The streak page's sticker art (made by scripts/widget-stickers.mjs): Image("StickerFlame") in Swift.
  images: {
    StickerFlame: './stickers/sticker-flame.png',
    StickerFlameOut: './stickers/sticker-flame-out.png',
    StickerHeart: './stickers/sticker-heart.png',
  },
});
