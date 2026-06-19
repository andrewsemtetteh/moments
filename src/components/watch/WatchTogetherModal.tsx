import { useState } from 'react';
import { Modal } from 'react-native';

import { WatchHub } from '@/components/watch/WatchHub';
import { WatchRoom } from '@/components/watch/WatchRoom';
import { WatchScheduleView } from '@/components/watch/WatchScheduleView';
import { WatchStartView } from '@/components/watch/WatchStartView';
import { WatchlistView } from '@/components/watch/WatchlistView';
import { useActiveWatchSession, useRealtimeSubscription } from '@/hooks/queries';
import { useUIStore } from '@/stores';

export function WatchTogetherModal() {
  const visible = useUIStore((s) => s.showWatchTogether);
  const closeWatchTogether = useUIStore((s) => s.closeWatchTogether);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeWatchTogether}>
      {visible ? <WatchTogetherContent onClose={closeWatchTogether} /> : null}
    </Modal>
  );
}

type HubView = 'hub' | 'start' | 'watchlist' | 'schedule';

function WatchTogetherContent({ onClose }: { onClose: () => void }) {
  const initialView = useUIStore((s) => s.watchInitialView);
  const [view, setView] = useState<HubView>(initialView);

  const { data: session } = useActiveWatchSession();
  useRealtimeSubscription('watch_sessions');
  useRealtimeSubscription('watch_watchlist');
  useRealtimeSubscription('watch_messages');

  // A live (non-scheduled) session takes over the whole modal as the watch room.
  const liveSession = session && session.status !== 'scheduled' ? session : null;

  if (liveSession) {
    return (
      <WatchRoom
        session={liveSession}
        onClose={onClose}
        onEnded={onClose}
      />
    );
  }

  switch (view) {
    case 'start':
      return <WatchStartView onClose={onClose} onBack={() => setView('hub')} />;
    case 'watchlist':
      return <WatchlistView onClose={onClose} onBack={() => setView('hub')} />;
    case 'schedule':
      return <WatchScheduleView onClose={onClose} onBack={() => setView('hub')} />;
    default:
      return <WatchHub onClose={onClose} onNavigate={setView} />;
  }
}
