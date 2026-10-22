import { LegalScreen } from '@/components/legal/LegalScreen';
import { SUPPORT_EMAIL } from '@/constants/links';
import { MIN_AGE } from '@/lib/birthday';

/** Shown at the top of both documents. Update it whenever either one changes. */
const UPDATED = 'Last updated: 19 October 2026.';

// LegalScreen reads each block as a heading when it doesn't end in . ! or ?, and as a
// paragraph when it does.

const TERMS = [
  UPDATED,
  'Agreement to these terms',
  'By creating an account or using Moments, you agree to these Terms of Service and to our Privacy Policy. If you don’t agree, please don’t use the app.',
  'What Moments is',
  'Moments is a private app for two people in a relationship. It includes shared moments (photos and videos), chat with voice notes, voice and video calls, moods, a daily question, games and live game nights, plans and shared lists, albums and places, streaks, trophies, widgets and reminders for the dates that matter to you.',
  'Who can use Moments',
  `You must be at least ${MIN_AGE} years old to use Moments, and older if the law where you live requires it for an app like this. By using Moments you confirm that you meet this age. If we learn that an account belongs to someone under ${MIN_AGE}, we will delete it.`,
  'Your account',
  'You sign in with Apple, Google or your email address. Keep your sign-in secure; you are responsible for what happens on your account. You stay signed in on a device until you sign out.',
  'Your shared space',
  'Each space is for exactly two people. Everything you add to your space (moments, messages, answers, plans, albums, places and your profile details) is visible to your partner, and nothing in it is public. Only invite someone you trust, and only share content you have the right to share.',
  'Location and calls',
  'Sharing your location with your partner is optional and can be turned off at any time in Settings or your phone’s settings. Calls are live between the two of you and are not recorded by us.',
  'Respect and safety',
  'Don’t use Moments to harass, threaten, impersonate or monitor anyone without their agreement, to share content that is illegal or that you don’t have the right to share, to try to get into another person’s space or account, or to spam, reverse engineer, overload or misuse the service. If you feel unsafe, you can end your shared space or delete your account at any time in Settings.',
  'Your content',
  'You own what you post. You give us permission to store, process and show it to you and your partner only so we can run Moments for you. We don’t use your content for advertising.',
  'Questions, games and suggestions',
  'Some questions, quizzes, games and date ideas are written with the help of AI. They are for fun and connection, and may occasionally be inaccurate or not to your taste. Moments is not therapy or professional advice.',
  'Moments Plus',
  'Moments Plus is an optional subscription, sold through the App Store or Google Play, and one subscription covers both partners in a space. Prices are shown before you buy. Free trials turn into a paid subscription at the end of the trial unless you cancel at least 24 hours before it ends. Subscriptions renew automatically until you cancel them in your App Store or Google Play account settings, where you can also manage them. Refunds are handled by Apple or Google under their policies.',
  'Referrals',
  'When you invite another couple and they join, both couples may get free days of Moments Plus. We may change or end this offer, and we may remove rewards that were earned by misuse.',
  'Ending your use',
  'You can end your shared space or delete your account at any time in Settings. Deleting your account permanently removes your account and your shared space, including its content, for both of you. We may suspend or close accounts that break these terms.',
  'The service',
  'We work hard to keep Moments running and your content safe, but the app is provided as it is and may sometimes be unavailable or change. As far as the law allows, we aren’t liable for indirect losses or for content created by users. Nothing in these terms limits rights you have under consumer law.',
  'Changes to these terms',
  'We may update these terms as Moments changes. If the changes are important, we will let you know in the app. Continuing to use Moments after that means you accept the new terms.',
  'Contact',
  `Questions about these terms: ${SUPPORT_EMAIL}.`,
].join('\n\n');

const PRIVACY = [
  UPDATED,
  'Overview',
  'Moments is a private app for two people in a relationship. We collect what the app needs to work for you and your partner. We never sell your data, and we don’t show ads.',
  'Account and profile',
  'Your email address and sign-in details (through Apple, Google or email), the name or nickname you choose, and an optional profile photo. Optionally, your birthday (your partner sees it, gets a countdown and a reminder the day before, and you both get a celebration on the day) and your gender (used to personalise the app; “Prefer not to say” is always an option).',
  'Your shared space',
  'Your pairing and invite code, space name, the date you got together, relationship type, the goals you picked, theme and settings, streaks, trophies and game progress.',
  'What you share',
  'Moments, photos, videos, messages, voice notes, moods, answers to questions, game answers, plans, shared lists, albums and places. If you share a contact in chat, only the contact you pick is sent. All of this is visible to your partner and no one else.',
  'Location',
  'Only if you allow it. Places you pin to a moment are saved with it. If you turn on location sharing, your location is updated while the app is open, so your partner can see where you are and how far apart you are; it stops when the app is in the background, and you can turn it off at any time.',
  'Calls',
  'Voice and video calls connect your phones directly where possible, and through Cloudflare’s relay servers when they can’t. Calls are encrypted and are never recorded or stored.',
  'Camera, microphone and photos',
  'Used only when you take or pick a photo or video, record a voice note or make a call.',
  'Notifications, widgets and reminders',
  'Your notification token and notification settings, so we can tell you when your partner sends something, and your timezone, so streaks, reminders and birthday notices happen on your local day. Widgets can show things like your latest moment or your days together on your Home and Lock Screen.',
  'Usage, feedback and crashes',
  'Basic events about how the app is used (for example, that a game was played or a screen was opened), feedback you send us, and crash reports with your account ID, device type and app version. Usage events are linked only to your account ID and never include your messages, moments, notes or anything else you type. We use these to fix problems and improve Moments.',
  'Advertising and tracking',
  'We don’t show ads, and your content is never used for advertising. On iPhone, if you allow tracking when asked, it is only used to measure which of our own ads brought you to Moments. You can change this any time in your phone’s settings.',
  'AI features',
  'Questions, quizzes, games and date ideas are created with the help of AI providers (OpenAI and Google). We send them only what’s needed to create the content, such as a quiz topic you type. Your messages, photos, moments and profile are never sent to them.',
  'Who we share with',
  'Your content is shared only with your partner. We use trusted providers that process data on our behalf: Cloudflare (hosting, storage, database and call relays), Clerk (sign-in), Superwall with Apple and Google (subscriptions and payments), Sentry (crash reports), PostHog (app usage analytics), Expo (push notifications) and OpenAI and Google (AI-written content, as above). We may also share information if the law requires it.',
  'Payments',
  'Subscriptions are paid through the App Store or Google Play. We never see your card details; we only learn whether your subscription is active.',
  'Security',
  'Connections are encrypted, private photos and videos are served through signed links that expire, and only the two members of a space can access its content.',
  'How long we keep it',
  'We keep your data while your account is active. When you delete your account, your account and your shared space, including its messages, moments and memories, are permanently deleted for both of you. Backups are cleared within 30 days after that.',
  'Age',
  `Moments is only for people aged ${MIN_AGE} and over. We don’t knowingly collect data from anyone younger; if we learn we have, we delete it.`,
  'Your rights',
  'You can see and change most of your information in the app, and delete your account in Settings at any time. You can also ask us for a copy of your data, a correction or deletion, or object to how we use it, by emailing us. Depending on where you live, you may also be able to complain to your local data protection authority.',
  'Changes to this policy',
  'If we change how we use your data in an important way, we will tell you in the app before it applies.',
  'Contact',
  `Questions or requests: ${SUPPORT_EMAIL}.`,
].join('\n\n');

/** The Terms and Privacy pages: their own routes (/legal/...) and, over the paywall, its detour pages. */
export function TermsDocument({ onBack }: { onBack?: () => void }) {
  return (
    <LegalScreen title="Terms of Service" onBack={onBack}>
      {TERMS}
    </LegalScreen>
  );
}

export function PrivacyDocument({ onBack }: { onBack?: () => void }) {
  return (
    <LegalScreen title="Privacy Policy" onBack={onBack}>
      {PRIVACY}
    </LegalScreen>
  );
}
