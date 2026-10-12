Dynamic Island style in-app notifications.

Adapted from https://github.com/rit3zh/expo-dynamic-notifications (MIT, see LICENSE).
Changes from upstream: imports made relative, the card body uses the app's theme and icon set
(instead of iOS-only SF Symbols) so it works on Android too, and the demo/mock code is left out.
The app-facing wiring lives in src/components/layout/DynamicIslandHost.tsx.
