import { LegalScreen } from '@/components/legal/LegalScreen';

export default function PrivacyScreen() {
  return (
    <LegalScreen title="Privacy Policy">
      {`Overview\n\nMoments is a private relationship application for two people. We prioritize privacy, emotional safety, and data minimization.\n\nData We Collect\n\nAccount data: email, display name, optional profile image.\n\nRelationship data: pairing information, relationship name, status, and streaks.\n\nUser-generated content: messages, moments, mood logs, calendar events, and activity data.\n\nTechnical data: device type, aggregated usage analytics, and crash reports.\n\nHow We Use Data\n\nWe use data to enable communication, store shared memories, generate activities, maintain streaks, and improve app stability.\n\nWe do NOT use data for ads, third-party profiling, or external marketing networks.\n\nData Sharing\n\nWe do not sell user data. Data is shared only between the two users in a relationship and with service providers required to operate the app (e.g. hosting, analytics).\n\nSecurity\n\nWe use industry-standard security including encrypted connections, row-level access controls, and private media storage.\n\nYour Rights\n\nYou may export your data or delete your account at any time from Settings.`}
    </LegalScreen>
  );
}
