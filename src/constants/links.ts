/**
 * The web domain for share links. Links open the app when it's installed
 * (universal / app links: needs this domain's apple-app-site-association and
 * assetlinks.json, plus associatedDomains in app.json), and fall back to the
 * App Store page otherwise (the server serves those files and pages).
 */
export const LINK_DOMAIN = 'moments.vasemti.com';

/**
 * The App Store id (the number in apps.apple.com/app/id<this>), from App Store Connect
 * once the app is listed. Rating opens the App Store's review screen with it.
 */
export const APP_STORE_ID = process.env.EXPO_PUBLIC_APP_STORE_ID?.trim() || null;

/** The Android package (app.json `android.package`), for the Play Store page. */
export const ANDROID_PACKAGE = 'com.vasemti.moments';

/** Where people reach us (support, privacy requests, feedback). */
export const SUPPORT_EMAIL = 'vasemti@gmail.com';

/** Join my space: opens the app at the join step with the code filled in. */
export const inviteLink = (code: string) => `https://${LINK_DOMAIN}/i/${code}`;
/** Another couple's referral: both couples get Plus when they pair. */
export const referralLink = (code: string) => `https://${LINK_DOMAIN}/r/${code}`;
