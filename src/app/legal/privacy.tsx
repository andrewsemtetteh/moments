import { LegalScreen } from '@/components/legal/LegalScreen';
import { SUPPORT_EMAIL } from '@/constants/links';

export default function PrivacyScreen() {
  return (
    <LegalScreen title="Privacy Policy">
      {`Overview\n\nMoments is a private app for two people in a relationship. We collect only what the app needs to work, and we never sell your data.\n\nData We Collect\n\nAccount: your email, the name or nickname you choose, and an optional profile photo.\n\nYour space: pairing details, your space name, anniversary date, streaks and settings.\n\nWhat you share: messages, voice notes, photos and videos, moods, answers, plans, albums and place names. Location only for moments you choose to pin.\n\nTechnical: device type, app version, basic usage events and crash reports.\n\nHow We Use Data\n\nTo run the app for you and your partner: delivering messages and moments, keeping your streak, sending notifications you turned on, and fixing crashes.\n\nAdvertising\n\nWe don't show ads, and your content is never used for advertising. If you allow tracking when asked, we only use it to measure which of our ads brought you to Moments.\n\nWho We Share With\n\nYour content is shared only with your partner in your space. We use trusted providers to run the app: Cloudflare (hosting and storage), Clerk (sign-in), Superwall (subscriptions and paywalls), Sentry (crash reports) and Expo (notifications). They process data only on our behalf.\n\nSecurity\n\nConnections are encrypted, and only the two members of a space can access its content.\n\nDeleting Your Account\n\nYou can delete your account at any time in Settings. This permanently deletes your account and your shared space, including its messages, moments and memories, for both of you.\n\nYour Rights\n\nYou can ask for a copy of your data, a correction, or deletion by emailing us.\n\nContact\n\nQuestions or requests: ${SUPPORT_EMAIL}`}
    </LegalScreen>
  );
}
