import type { DailyChallenge, Relationship, UserProfile } from '@/types/database';

export type PromptPhase = 'answer' | 'waiting' | 'reveal' | 'skipped';

/** Which response column belongs to this user. Throws if they aren't on the relationship. */
export function challengeResponseField(
  relationship: Relationship,
  userId: string,
): 'user_1_response' | 'user_2_response' {
  if (relationship.user_1_id === userId) return 'user_1_response';
  if (relationship.user_2_id === userId) return 'user_2_response';
  throw new Error('You are not a member of this relationship.');
}

export function myPromptResponse(
  challenge: DailyChallenge,
  userId: string | undefined,
  relationship: Relationship | null | undefined,
): string | null {
  if (!userId || !relationship) return null;
  try {
    return challenge[challengeResponseField(relationship, userId)];
  } catch {
    return null;
  }
}

export function partnerPromptResponse(
  challenge: DailyChallenge,
  userId: string | undefined,
  relationship: Relationship | null | undefined,
): string | null {
  if (!userId || !relationship) return null;
  try {
    const mine = challengeResponseField(relationship, userId);
    return mine === 'user_1_response' ? challenge.user_2_response : challenge.user_1_response;
  } catch {
    return null;
  }
}

export function promptPhase(
  challenge: DailyChallenge,
  userId: string | undefined,
  relationship: Relationship | null | undefined,
): PromptPhase {
  if (challenge.type === 'skipped') return 'skipped';
  const mine = myPromptResponse(challenge, userId, relationship);
  const theirs = partnerPromptResponse(challenge, userId, relationship);
  if (mine && theirs) return 'reveal';
  if (mine) return 'waiting';
  return 'answer';
}

export function isPromptComplete(challenge: DailyChallenge): boolean {
  return Boolean(challenge.user_1_response && challenge.user_2_response) || challenge.completed;
}

/** Soft expiry: unanswered (or half-answered) prompts older than 48h leave "today". */
export function isPromptExpired(challenge: DailyChallenge, now = new Date()): boolean {
  if (isPromptComplete(challenge) || challenge.type === 'skipped') return false;
  const created = new Date(challenge.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created > 48 * 60 * 60 * 1000;
}

export function promptAuthorLabel(
  isMe: boolean,
  user: UserProfile | null | undefined,
  partner: UserProfile | null | undefined,
): string {
  if (isMe) return user?.name?.trim() || 'You';
  return partner?.name?.trim() || 'Partner';
}

/** Status line for history list / detail when answers aren't fully revealed yet. */
export function promptHistoryStatus(
  challenge: DailyChallenge,
  userId: string | undefined,
  relationship: Relationship | null | undefined,
  partnerName?: string | null,
): string {
  if (isPromptComplete(challenge)) return 'Both answered';

  const mine = myPromptResponse(challenge, userId, relationship);
  const theirs = partnerPromptResponse(challenge, userId, relationship);
  const partner = partnerName?.trim() || 'Your partner';

  if (mine && !theirs) return `Waiting for ${partner}'s answer`;
  if (!mine && theirs) return `${partner} is waiting for your answer`;
  return 'Unanswered';
}

export function chatDraftForPrompt(prompt: string): string {
  const clipped = prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt;
  return `About today's question — "${clipped}"\n\n`;
}
