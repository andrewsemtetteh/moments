/**
 * The web domain for share links. Links open the app when it's installed
 * (universal / app links: needs this domain's apple-app-site-association and
 * assetlinks.json, plus associatedDomains in app.json), and fall back to the
 * App Store page otherwise (the server serves those files and pages).
 */
export const LINK_DOMAIN = 'moments.vasemti.com';

/** Where people reach us (support, privacy requests, feedback). */
export const SUPPORT_EMAIL = 'vasemti@gmail.com';

/** Join my space: opens the app at the join step with the code filled in. */
export const inviteLink = (code: string) => `https://${LINK_DOMAIN}/i/${code}`;
/** Another couple's referral: both couples get Plus when they pair. */
export const referralLink = (code: string) => `https://${LINK_DOMAIN}/r/${code}`;
