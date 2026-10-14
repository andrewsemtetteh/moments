import { Hono } from 'hono';

/**
 * The share-link domain (moments.vasemti.com): the files iOS and Android use
 * to open links in the app, and a small page for anyone without the app yet.
 * Public, no sign-in. Settings (wrangler vars / secrets):
 *   APPLE_TEAM_ID         10-char Apple Developer Team ID
 *   ANDROID_CERT_SHA256   signing cert fingerprint(s), comma-separated (EAS: `eas credentials`)
 *   APP_STORE_URL / PLAY_STORE_URL   store pages (optional until launch)
 */
const IOS_BUNDLE_ID = 'com.vasemti.moments';
const ANDROID_PACKAGE = 'com.vasemti.moments';

export const links = new Hono<{ Bindings: Env }>();

links.get('/.well-known/apple-app-site-association', (c) => {
  const teamId = c.env.APPLE_TEAM_ID;
  if (!teamId) return c.json({ error: 'APPLE_TEAM_ID is not set' }, 503);
  return c.json({
    applinks: {
      details: [{ appIDs: [`${teamId}.${IOS_BUNDLE_ID}`], components: [{ '/': '/i/*' }, { '/': '/r/*' }] }],
    },
  });
});

links.get('/.well-known/assetlinks.json', (c) => {
  const prints = (c.env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!prints.length) return c.json({ error: 'ANDROID_CERT_SHA256 is not set' }, 503);
  return c.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: prints },
    },
  ]);
});

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Opened without the app installed: show the code and where to get Moments. */
function landing(c: { env: Env }, kind: 'invite' | 'referral', rawCode: string) {
  const code = escape(rawCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase());
  const title = kind === 'invite' ? 'Your person invited you to Moments' : 'A couple invited you to Moments';
  const line =
    kind === 'invite'
      ? `Get the app, sign up, then enter this code to join their space:`
      : `Get the app and pair with your partner. You’ll both get 14 days of Plus free.`;
  const store = [
    c.env.APP_STORE_URL ? `<a class="btn" href="${escape(c.env.APP_STORE_URL)}">Download on the App Store</a>` : '',
    c.env.PLAY_STORE_URL ? `<a class="btn alt" href="${escape(c.env.PLAY_STORE_URL)}">Get it on Google Play</a>` : '',
  ].join('');
  const deepLink = `moments://${kind === 'invite' ? 'i' : 'r'}/${code}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light dark}
body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#fff;color:#141414;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
main{max-width:380px;text-align:center}
h1{font-size:28px;font-weight:900;letter-spacing:-.5px;margin:16px 0 8px}
p{font-size:16px;line-height:1.45;color:#444}
.code{display:inline-block;margin:12px 0 20px;padding:12px 20px;border:2px solid #141414;border-radius:16px;font-size:30px;font-weight:900;letter-spacing:6px}
.btn{display:block;margin:10px 0;padding:16px;border-radius:28px;background:#141414;color:#fff;text-decoration:none;font-weight:800}
.btn.alt{background:#fff;color:#141414;border:2px solid #141414}
.open{font-size:14px;color:#444}
@media (prefers-color-scheme:dark){body{background:#000;color:#fff}p,.open{color:#bbb}.code{border-color:#fff}.btn{background:#fff;color:#000}.btn.alt{background:#000;color:#fff;border-color:#fff}}
</style></head><body><main>
<svg width="64" height="64" viewBox="14 14 72 72" aria-hidden="true"><clipPath id="c"><rect width="100" height="61.5"/></clipPath><g transform="translate(0 -6.59)"><g clip-path="url(#c)"><path d="M50 72 C34 61 26 52 26 42 C26 34 32 29 39 29 C44 29 48 32 50 36 C52 32 56 29 61 29 C68 29 74 34 74 42 C74 52 66 61 50 72 Z" fill="#FF4D6D" transform="translate(50 56) scale(1.18) translate(-50 -50)"/></g><line x1="32.68" y1="66.35" x2="67.32" y2="66.35" stroke="#FF4D6D" stroke-width="3.4" stroke-linecap="round"/><line x1="39.66" y1="72.91" x2="60.34" y2="72.91" stroke="#FF4D6D" stroke-width="3.4" stroke-linecap="round"/><circle cx="50" cy="79.86" r="2.1" fill="#FF4D6D"/></g></svg>
<h1>${title}</h1>
<p>${line}</p>
${kind === 'invite' ? `<div class="code">${code}</div>` : ''}
${store || '<p><b>Coming soon to the App Store and Google Play.</b></p>'}
<p class="open">Already have Moments? <a href="${deepLink}">Open the app</a></p>
</main></body></html>`;
}

links.get('/i/:code', (c) => c.html(landing(c, 'invite', c.req.param('code'))));
links.get('/r/:code', (c) => c.html(landing(c, 'referral', c.req.param('code'))));
