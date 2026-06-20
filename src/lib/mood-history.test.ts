import { describe, expect, it } from 'vitest';

import {
  buildDailyActivity,
  buildMoodCounts,
  buildMoodHistorySummary,
  buildMoodTimeline,
  buildPartnerWeeklyFromLogs,
  filterMoodLogs,
  indexLogsByLocalDay,
  mapRpcOverview,
} from '@/lib/mood-history';
import type { MoodLog } from '@/types/database';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const PARTNER_ID = '22222222-2222-2222-2222-222222222222';
const REL_ID = '33333333-3333-3333-3333-333333333333';

function moodLog(
  mood: string,
  createdAt: string,
  userId: string = USER_ID,
  id = `log-${mood}-${createdAt}`,
): MoodLog {
  return {
    id,
    relationship_id: REL_ID,
    user_id: userId,
    mood: mood as MoodLog['mood'],
    created_at: createdAt,
  };
}

describe('filterMoodLogs', () => {
  const logs = [
    moodLog('happy', '2026-06-15T10:00:00.000Z', USER_ID),
    moodLog('calm', '2026-06-15T11:00:00.000Z', PARTNER_ID),
  ];

  it('returns all logs for both filter', () => {
    expect(filterMoodLogs(logs, 'all', USER_ID, PARTNER_ID)).toHaveLength(2);
  });

  it('returns only current user logs', () => {
    expect(filterMoodLogs(logs, 'me', USER_ID, PARTNER_ID)).toHaveLength(1);
  });

  it('returns only partner logs', () => {
    expect(filterMoodLogs(logs, 'partner', USER_ID, PARTNER_ID)).toHaveLength(1);
  });
});

describe('buildMoodCounts', () => {
  it('sorts moods by frequency and computes share', () => {
    const logs = [
      moodLog('happy', '2026-06-15T10:00:00.000Z'),
      moodLog('happy', '2026-06-15T11:00:00.000Z'),
      moodLog('calm', '2026-06-15T12:00:00.000Z'),
    ];

    const counts = buildMoodCounts(logs);
    expect(counts[0]).toEqual({ mood: 'happy', count: 2, share: 2 / 3 });
    expect(counts[1]).toEqual({ mood: 'calm', count: 1, share: 1 / 3 });
  });
});

describe('buildDailyActivity', () => {
  it('groups logs by local day and picks dominant mood', () => {
    const today = new Date();
    const iso = today.toISOString();
    const logs = [
      moodLog('happy', iso),
      moodLog('happy', iso),
      moodLog('calm', iso),
    ];

    const buckets = buildDailyActivity(logs, 14);
    const todayBucket = buckets[buckets.length - 1];
    expect(todayBucket.count).toBe(3);
    expect(todayBucket.dominantMood).toBe('happy');
  });
});

describe('buildMoodTimeline', () => {
  it('groups entries by day with display names', () => {
    const logs = [
      moodLog('happy', '2026-06-15T10:00:00.000Z', USER_ID, 'a'),
      moodLog('calm', '2026-06-15T18:00:00.000Z', PARTNER_ID, 'b'),
    ];

    const sections = buildMoodTimeline(logs, USER_ID, 'Alex Partner');
    expect(sections).toHaveLength(1);
    expect(sections[0].entries).toHaveLength(2);
    expect(sections[0].entries[0].displayName).toBe('Alex');
    expect(sections[0].entries[1].displayName).toBe('Me');
  });
});

describe('buildMoodHistorySummary', () => {
  it('returns total and top mood', () => {
    const summary = buildMoodHistorySummary([
      moodLog('stressed', '2026-06-15T10:00:00.000Z'),
      moodLog('stressed', '2026-06-15T11:00:00.000Z'),
      moodLog('calm', '2026-06-15T12:00:00.000Z'),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.topMood).toBe('stressed');
    expect(summary.topMoodCount).toBe(2);
  });
});

describe('buildPartnerWeeklyFromLogs', () => {
  it('builds side-by-side weekly counts', () => {
    const rows = buildPartnerWeeklyFromLogs(
      [
        moodLog('happy', new Date().toISOString(), USER_ID),
        moodLog('calm', new Date().toISOString(), PARTNER_ID),
      ],
      USER_ID,
      PARTNER_ID,
      4,
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[rows.length - 1].youCount).toBe(1);
    expect(rows[rows.length - 1].partnerCount).toBe(1);
  });
});

describe('mapRpcOverview', () => {
  it('maps rpc payload into client overview shape', () => {
    const overview = mapRpcOverview(
      {
        summary: { total: 5, top_mood: 'happy', top_mood_count: 3 },
        counts: [{ mood: 'happy', log_count: 3 }],
        daily: [{ day_date: '2026-06-15', log_count: 2, dominant_mood: 'happy' }],
        weekly: [
          {
            week_start: '2026-06-09',
            user_id: USER_ID,
            log_count: 2,
            top_mood: 'happy',
          },
          {
            week_start: '2026-06-09',
            user_id: PARTNER_ID,
            log_count: 1,
            top_mood: 'calm',
          },
        ],
      },
      USER_ID,
      PARTNER_ID,
    );

    expect(overview.summary.total).toBe(5);
    expect(overview.counts[0].count).toBe(3);
    expect(overview.daily[0].count).toBe(2);
    expect(overview.partnerWeekly.length).toBeGreaterThan(0);
  });
});

describe('indexLogsByLocalDay', () => {
  it('indexes logs by yyyy-MM-dd key', () => {
    const map = indexLogsByLocalDay([moodLog('happy', '2026-06-15T10:00:00.000Z')]);
    expect(map.get('2026-06-15')).toHaveLength(1);
  });
});
