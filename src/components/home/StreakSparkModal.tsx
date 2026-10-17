import { StreakCelebration } from '@/components/home/StreakCelebration';
import { getFirstName } from '@/lib/avatar-initial';
import { useRelationshipStore, useUIStore } from '@/stores';

/** The daily streak celebration (opened by StreakSparkSync when the streak goes up). */
export function StreakSparkModal() {
  const spark = useUIStore((s) => s.streakSpark);
  const closeStreakSpark = useUIStore((s) => s.closeStreakSpark);
  const partner = useRelationshipStore((s) => s.partner);

  if (!spark || spark.count <= 0) return null;
  const who = getFirstName(partner?.name) ?? 'your person';
  const message =
    spark.count <= 1
      ? `A new streak begins! Check in each day to keep it going.`
      : `You kept your flame alive for ${who}.\nSee you tomorrow.`;

  return (
    <StreakCelebration
      // A fresh celebration (and animation) for each new count.
      key={spark.count}
      count={spark.count}
      fromCount={spark.fromCount}
      message={message}
      onClose={closeStreakSpark}
    />
  );
}
