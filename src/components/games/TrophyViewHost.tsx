import { ShareCardModal } from '@/components/share/ShareCardModal';
import { TrophyShareCard } from '@/components/share/TrophyShareCard';
import { BADGES } from '@/lib/play-progress';
import { useUIStore } from '@/stores';

/**
 * A trophy, opened from anywhere that mentions one (the "Trophy unlocked" card in
 * chat, its notification): the achievement card itself, ready to share. Mounted
 * once with the app's other overlays.
 */
export function TrophyViewHost() {
  const ref = useUIStore((s) => s.trophyView);
  const close = useUIStore((s) => s.closeTrophy);
  // By id; older chat cards only carried the title.
  const badge = ref ? (BADGES.find((b) => b.id === ref) ?? BADGES.find((b) => b.title === ref)) : null;

  return (
    <ShareCardModal visible={!!badge} onClose={close} title="Share your trophy">
      {badge ? <TrophyShareCard icon={badge.icon} title={badge.title} hint={badge.hint} /> : null}
    </ShareCardModal>
  );
}
