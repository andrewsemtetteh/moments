import { StreakFlame } from '@/components/home/StreakFlame';

type LayeredFlameIconProps = {
  size: number;
};

/** The streak flame (kept under its old name for existing callers). */
export function LayeredFlameIcon({ size }: LayeredFlameIconProps) {
  return <StreakFlame size={size} tone="active" />;
}
