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

/**
 * The line under the big number on the milestone celebration. The number is
 * already shown, so these never spell it out again ("50" + "days of showing up").
 */
export function streakMilestoneHeadline(days: number): string {
  if (days === 7) return 'One week together';
  if (days === 15) return 'Two weeks strong';
  if (days === 30) return 'A full month';
  if (days === 50) return 'days of showing up';
  if (days === 75) return 'days and counting';
  if (days === 100) return 'Century streak';
  if (days === 150) return 'days strong';
  if (days === 200) return 'days together';
  if (days === 250) return 'days of you two';
  if (days === 300) return 'days strong';
  if (days === 365) return 'One year together';
  if (days === 400) return 'days and counting';
  if (days === 500) return 'days strong';
  if (days >= 1000 && days % 500 === 0) return 'days, legendary';
  if (days % 100 === 0) return 'days strong';
  return 'day streak';
}

export function streakMilestoneCheer(days: number): string {
  if (days >= 365) return 'A whole year of showing up for each other 👑';
  if (days >= 100) return 'Legendary streak. You two are unstoppable 🔥';
  if (days >= 50) return "You're on fire! Keep it going 🔥";
  if (days >= 30) return 'A month of consistency together 🔥';
  if (days >= 15) return "Two weeks strong. Don't stop now 🔥";
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
