import type { IconName } from '@/components/ui/Icon';

/** Where people can follow Moments. Update the handles here when the accounts are live. */
export const SOCIAL_LINKS: { key: string; label: string; icon: IconName; url: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/vasemti' },
  { key: 'x', label: 'X', icon: 'xLogo', url: 'https://x.com/vasemti' },
  { key: 'tiktok', label: 'TikTok', icon: 'tiktok', url: 'https://www.tiktok.com/@vasemti' },
  { key: 'youtube', label: 'YouTube', icon: 'youtube', url: 'https://www.youtube.com/@vasemti' },
];

export const SUPPORT_EMAIL = 'vasemti@gmail.com';
