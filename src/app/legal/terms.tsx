import { LegalScreen } from '@/components/legal/LegalScreen';

export default function TermsScreen() {
  return (
    <LegalScreen title="Terms of Service">
      {`Agreement to Terms\n\nBy using Moments, you agree to these Terms of Service. If you do not agree, you must stop using the application.\n\nService Description\n\nMoments is a private relationship platform for two people. It provides messaging, shared moments, activities, journaling, mood tracking, and calendar planning.\n\nEligibility\n\nYou must be at least 18 years old and legally allowed to use digital services in your region.\n\nRelationship Structure\n\nMoments is designed for exactly two users per relationship space. Data is shared only within your relationship and is never public.\n\nUser Responsibilities\n\nYou agree to use the app respectfully, not abuse or spam features, not attempt to access other relationships, and not reverse engineer or exploit the system.\n\nProhibited Uses\n\nYou may not use Moments for harassment, impersonation, unauthorized access, malware distribution, or large-scale data extraction.\n\nContent Ownership\n\nYou retain ownership of your messages, moments, journal entries, and media uploads. You grant your partner visibility within your shared relationship space.\n\nSubscriptions\n\nPaid features may be offered via in-app subscription. One subscription covers both partners in a relationship.\n\nTermination\n\nYou may delete your account at any time. We may suspend access for violations of these terms.`}
    </LegalScreen>
  );
}
