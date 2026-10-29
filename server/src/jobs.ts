import { sendBirthdayHeadsUps } from './birthdays';
import { sendMoodCheckins, sendStreakRestoreReminders, sendStreakRiskReminders, settleBrokenStreaks } from './core';
import './env';

/**
 * The hourly per-couple jobs, in pages. One run used to load every couple and work through
 * them one by one; with enough couples it ran out of time partway and the rest got nothing. Now
 * the hourly cron only queues the first page of each job (JOBS_QUEUE); each page, once done,
 * queues the next, so the work is spread over many short runs that the queue retries on their
 * own. Without the queue (not created yet, local dev) the cron runs the pages itself.
 */
export type JobMessage = { job: JobName; after: string };

const JOBS = {
  'mood-checkins': (env: Env, ids: string[]) => sendMoodCheckins(env, ids),
  'streak-risk': (env: Env, ids: string[]) => sendStreakRiskReminders(env, ids),
  'streak-settle': (env: Env, ids: string[]) => settleBrokenStreaks(env, ids),
  'streak-restore': (env: Env, ids: string[]) => sendStreakRestoreReminders(env, ids),
  birthdays: (env: Env, ids: string[]) => sendBirthdayHeadsUps(env, new Date(), ids),
} satisfies Record<string, (env: Env, ids: string[]) => Promise<number>>;

type JobName = keyof typeof JOBS;

/** Couples per page: a few seconds of work, far inside a run's limits. */
const PAGE_SIZE = 200;

/** One page of a job: the couples after `after` (by id). The next page's start, or null when done. */
async function runPage(env: Env, job: JobName, after: string): Promise<string | null> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM relationships WHERE status = 'active' AND id > ?1 ORDER BY id LIMIT ?2`,
  )
    .bind(after, PAGE_SIZE)
    .all<{ id: string }>();
  const ids = results.map((r) => r.id);
  if (ids.length === 0) return null;
  await JOBS[job](env, ids);
  return ids.length === PAGE_SIZE ? ids[ids.length - 1] : null;
}

/** Hourly: start every job from its first page. */
export async function startHourlyJobs(env: Env): Promise<void> {
  const names = Object.keys(JOBS) as JobName[];
  const queue = env.JOBS_QUEUE;
  if (queue) {
    await queue.sendBatch(names.map((job) => ({ body: { job, after: '' } satisfies JobMessage })));
    return;
  }
  for (const job of names) {
    let after: string | null = '';
    try {
      while (after !== null) after = await runPage(env, job, after);
    } catch (e) {
      console.error(JSON.stringify({ event: 'job_failed', job, error: String(e) }));
    }
  }
}

/** The queue's side: run each page, queue the one after it. A failed page is tried again. */
export async function runJobPages(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    const { job, after } = msg.body;
    if (!(job in JOBS)) {
      msg.ack();
      continue;
    }
    try {
      const next = await runPage(env, job, after);
      if (next !== null) await env.JOBS_QUEUE?.send({ job, after: next } satisfies JobMessage);
      msg.ack();
    } catch (e) {
      console.error(JSON.stringify({ event: 'job_page_failed', job, after, error: String(e) }));
      msg.retry({ delaySeconds: 60 });
    }
  }
}
