import { LegalScreen } from '@/components/legal/LegalScreen';
import { SUPPORT_EMAIL } from '@/constants/links';

/** The Terms and Privacy pages: their own routes (/legal/...) and, over the paywall, its detour pages. */
export function TermsDocument({ onBack }: { onBack?: () => void }) {
  return (
    <LegalScreen title="Terms of Service" onBack={onBack}>
      {`Agreement to Terms\n\nBy using Moments, you agree to these Terms of Service. If you do not agree, you must stop using the application.\n\nService Description\n\nMoments is a private relationship platform for two people. It provides messaging, shared moments, activities, mood tracking, and calendar planning.\n\nEligibility\n\nYou must be at least 18 years old and legally allowed to use digital services in your region.\n\nRelationship Structure\n\nMoments is designed for exactly two users per relationship space. Data is shared only within your relationship and is never public.\n\nUser Responsibilities\n\nYou agree to use the app respectfully, not abuse or spam features, not attempt to access other relationships, and not reverse engineer or exploit the system.\n\nProhibited Uses\n\nYou may not use Moments for harassment, impersonation, unauthorized access, malware distribution, or large-scale data extraction.\n\nContent Ownership\n\nYou retain ownership of your messages, moments, journal entries, and media uploads. You grant your partner visibility within your shared relationship space.\n\nSubscriptions\n\nPaid features may be offered via in-app subscription. One subscription covers both partners in a relationship.\n\nTermination\n\nYou may delete your account at any time in Settings. We may suspend access for violations of these terms.\n\nContact\n\nQuestions about these terms: ${SUPPORT_EMAIL}`}
    </LegalScreen>
  );
}

export function PrivacyDocument({ onBack }: { onBack?: () => void }) {
  return (
    <LegalScreen title="Privacy Policy" onBack={onBack}>
      {`Overview\n\nMoments is a private app for two people in a relationship. We collect only what the app needs to work, and we never sell your data.\n\nData We Collect\n\nAccount: your email, the name or nickname you choose, and an optional profile photo.\n\nYour space: pairing details, your space name, anniversary date, streaks and settings.\n\nWhat you share: messages, voice notes, photos and videos, moods, answers, plans, albums and place names. Location only for moments you choose to pin.\n\nTechnical: device type, app version, basic usage events and crash reports.\n\nHow We Use Data\n\nTo run the app for you and your partner: delivering messages and moments, keeping your streak, sending notifications you turned on, and fixing crashes.\n\nAdvertising\n\nWe don't show ads, and your content is never used for advertising. If you allow tracking when asked, we only use it to measure which of our ads brought you to Moments.\n\nWho We Share With\n\nYour content is shared only with your partner in your space. We use trusted providers to run the app: Cloudflare (hosting and storage), Clerk (sign-in), Superwall (subscriptions and paywalls), Sentry (crash reports) and Expo (notifications). They process data only on our behalf.\n\nSecurity\n\nConnections are encrypted, and only the two members of a space can access its content.\n\nDeleting Your Account\n\nYou can delete your account at any time in Settings. This permanently deletes your account and your shared space, including its messages, moments and memories, for both of you.\n\nYour Rights\n\nYou can ask for a copy of your data, a correction, or deletion by emailing us.\n\nContact\n\nQuestions or requests: ${SUPPORT_EMAIL}`}
    </LegalScreen>
  );
}
