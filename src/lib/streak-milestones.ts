/** Fixed streak counts that trigger a celebration modal. */
export const STREAK_MILESTONE_DAYS = [
  7, 15, 30, 50, 75, 100, 150, 200, 250, 300, 365, 400, 500,
] as const;

export function isStreakMilestone(days: number): boolean {
  if (days < 7) return false;
  if ((STREAK_MILESTONE_DAYS as readonly number[]).includes(days)) return true;
  if (days > 500 && days % 100 === 0) return true;
  return false;
}

export function streakMilestoneHeadline(days: number): string {
  if (days === 7) return 'One week together';
  if (days === 15) return 'Two weeks strong';
  if (days === 30) return 'A full month';
  if (days === 50) return 'Fifty days of showing up';
  if (days === 75) return 'Seventy-five days';
  if (days === 100) return 'Century streak';
  if (days === 150) return 'A hundred and fifty days';
  if (days === 200) return 'Two hundred days';
  if (days === 250) return 'Two hundred fifty days';
  if (days === 300) return 'Three hundred days';
  if (days === 365) return 'One year together';
  if (days === 400) return 'Four hundred days';
  if (days === 500) return 'Five hundred days';
  if (days >= 1000 && days % 500 === 0) return `${days} days — legendary`;
  if (days % 100 === 0) return `${days} days strong`;
  return `${days} day milestone`;
}

export function streakMilestoneCheer(days: number): string {
  if (days >= 365) return 'A whole year of showing up for each other 👑';
  if (days >= 100) return 'Legendary streak — you two are unstoppable 🔥';
  if (days >= 50) return "You're on fire! Keep it going 🔥";
  if (days >= 30) return 'A month of consistency together 🔥';
  if (days >= 15) return "Two weeks strong — don't stop now 🔥";
  if (days >= 7) return "You're on fire! 🔥";
  return 'Keep showing up for each other';
}

export function streakMilestoneLabel(_days: number): string {
  return 'Day Streak';
}

export function streakMilestoneStatusMessage(partnerName?: string | null): string {
  const partner = partnerName?.trim().split(/\s+/)[0] ?? 'your partner';
  return `You and ${partner} kept the flame alive.`;
}
