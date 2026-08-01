import { describe, expect, it } from 'vitest';

import {
  chatDraftForPrompt,
  isPromptComplete,
  isPromptExpired,
  myPromptResponse,
  partnerPromptResponse,
  promptAuthorLabel,
  promptHistoryStatus,
  promptPhase,
} from '@/lib/daily-prompt';
import type { DailyChallenge, Relationship, UserProfile } from '@/types/database';

const user1 = 'user-1';
const user2 = 'user-2';

const relationship: Relationship = {
  id: 'rel-1',
  user_1_id: user1,
  user_2_id: user2,
  status: 'active',
  created_at: '2026-06-01T00:00:00.000Z',
  invite_code: null,
  anniversary_date: null,
  streak_count: 0,
  relationship_name: null,
  distance_mode: false,
};

function challenge(overrides: Partial<DailyChallenge> = {}): DailyChallenge {
  return {
    id: 'chal-1',
    relationship_id: 'rel-1',
    prompt: 'What made you smile?',
    type: 'question',
    user_1_response: null,
    user_2_response: null,
    completed: false,
    challenge_date: '2026-08-01',
    created_at: '2026-08-01T08:00:00.000Z',
    ...overrides,
  } as DailyChallenge;
}

describe('myPromptResponse / partnerPromptResponse', () => {
  it('maps responses for user 1', () => {
    const c = challenge({ user_1_response: 'Coffee', user_2_response: 'Walk' });
    expect(myPromptResponse(c, user1, relationship)).toBe('Coffee');
    expect(partnerPromptResponse(c, user1, relationship)).toBe('Walk');
  });

  it('maps responses for user 2', () => {
    const c = challenge({ user_1_response: 'Coffee', user_2_response: 'Walk' });
    expect(myPromptResponse(c, user2, relationship)).toBe('Walk');
    expect(partnerPromptResponse(c, user2, relationship)).toBe('Coffee');
  });

  it('returns null without user or relationship', () => {
    const c = challenge({ user_1_response: 'Coffee' });
    expect(myPromptResponse(c, undefined, relationship)).toBeNull();
    expect(partnerPromptResponse(c, user1, null)).toBeNull();
  });
});

describe('promptPhase', () => {
  it('starts in answer when nobody has responded', () => {
    expect(promptPhase(challenge(), user1, relationship)).toBe('answer');
  });

  it('is waiting after I answer and partner has not', () => {
    const c = challenge({ user_1_response: 'Mine' });
    expect(promptPhase(c, user1, relationship)).toBe('waiting');
    expect(promptPhase(c, user2, relationship)).toBe('answer');
  });

  it('is waiting when partner answered first and I have not', () => {
    const c = challenge({ user_2_response: 'Theirs' });
    expect(promptPhase(c, user1, relationship)).toBe('answer');
    expect(promptPhase(c, user2, relationship)).toBe('waiting');
  });

  it('reveals when both answered', () => {
    const c = challenge({ user_1_response: 'A', user_2_response: 'B' });
    expect(promptPhase(c, user1, relationship)).toBe('reveal');
    expect(promptPhase(c, user2, relationship)).toBe('reveal');
  });

  it('returns skipped for skipped challenges', () => {
    expect(promptPhase(challenge({ type: 'skipped' }), user1, relationship)).toBe('skipped');
  });
});

describe('isPromptComplete', () => {
  it('is complete when both responses exist', () => {
    expect(
      isPromptComplete(challenge({ user_1_response: 'A', user_2_response: 'B' })),
    ).toBe(true);
  });

  it('is complete when completed flag is set', () => {
    expect(isPromptComplete(challenge({ completed: true }))).toBe(true);
  });

  it('is incomplete with one answer', () => {
    expect(isPromptComplete(challenge({ user_1_response: 'A' }))).toBe(false);
  });
});

describe('isPromptExpired', () => {
  it('is not expired within 48 hours', () => {
    const c = challenge({ created_at: '2026-08-01T08:00:00.000Z' });
    expect(isPromptExpired(c, new Date('2026-08-02T07:59:00.000Z'))).toBe(false);
  });

  it('expires unanswered prompts after 48 hours', () => {
    const c = challenge({ created_at: '2026-08-01T08:00:00.000Z' });
    expect(isPromptExpired(c, new Date('2026-08-03T08:01:00.000Z'))).toBe(true);
  });

  it('does not expire completed prompts', () => {
    const c = challenge({
      created_at: '2026-07-01T08:00:00.000Z',
      user_1_response: 'A',
      user_2_response: 'B',
    });
    expect(isPromptExpired(c, new Date('2026-08-01T08:00:00.000Z'))).toBe(false);
  });

  it('does not expire skipped prompts', () => {
    const c = challenge({ type: 'skipped', created_at: '2026-07-01T08:00:00.000Z' });
    expect(isPromptExpired(c, new Date('2026-08-01T08:00:00.000Z'))).toBe(false);
  });
});

describe('promptAuthorLabel / chatDraftForPrompt', () => {
  const me = { name: 'Taylor' } as UserProfile;
  const partner = { name: 'Jordan Lee' } as UserProfile;

  it('labels authors', () => {
    expect(promptAuthorLabel(true, me, partner)).toBe('Taylor');
    expect(promptAuthorLabel(false, me, partner)).toBe('Jordan Lee');
    expect(promptAuthorLabel(true, null, partner)).toBe('You');
    expect(promptAuthorLabel(false, me, null)).toBe('Partner');
  });

  it('builds a chat draft and clips long prompts', () => {
    expect(chatDraftForPrompt('Hello')).toContain('Hello');
    const long = 'x'.repeat(100);
    const draft = chatDraftForPrompt(long);
    expect(draft).toContain('…');
    expect(draft.length).toBeLessThan(long.length + 40);
  });
});

describe('promptHistoryStatus', () => {
  it('says waiting for partner after I answer', () => {
    expect(
      promptHistoryStatus(challenge({ user_1_response: 'Mine' }), user1, relationship, 'Jordan'),
    ).toBe("Waiting for Jordan's answer");
  });

  it('says partner is waiting when it is my turn', () => {
    expect(
      promptHistoryStatus(challenge({ user_2_response: 'Theirs' }), user1, relationship, 'Jordan'),
    ).toBe('Jordan is waiting for your answer');
  });

  it('says waiting for partner when user 2 answered', () => {
    expect(
      promptHistoryStatus(challenge({ user_2_response: 'Mine' }), user2, relationship, 'Taylor'),
    ).toBe("Waiting for Taylor's answer");
  });

  it('says both answered when complete', () => {
    expect(
      promptHistoryStatus(
        challenge({ user_1_response: 'A', user_2_response: 'B' }),
        user1,
        relationship,
        'Jordan',
      ),
    ).toBe('Both answered');
  });
});
