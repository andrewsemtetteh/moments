import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class RateLimitError extends Error {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

type RateLimitScope = {
  functionName: string;
  userId?: string;
  relationshipId?: string;
};

function buildBucketKey(scope: RateLimitScope): string {
  if (scope.relationshipId) {
    return `${scope.functionName}:relationship:${scope.relationshipId}`;
  }
  if (scope.userId) {
    return `${scope.functionName}:user:${scope.userId}`;
  }
  return scope.functionName;
}

export async function enforceRateLimit(
  scope: RateLimitScope,
  maxHits: number,
  windowSeconds: number,
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_bucket_key: buildBucketKey(scope),
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('rate limit check failed:', error.message);
    throw new Error('Rate limit check failed');
  }

  if (!data) {
    throw new RateLimitError();
  }
}

/** Shared limits aligned with SECURITY.md abuse prevention goals. */
export const RATE_LIMITS = {
  generateActivity: { maxHits: 20, windowSeconds: 86_400 },
  generateDailyChallenge: { maxHits: 12, windowSeconds: 3_600 },
  generateQuizLive: { maxHits: 15, windowSeconds: 3_600 },
  updateMood: { maxHits: 60, windowSeconds: 3_600 },
  sendPushNotification: { maxHits: 120, windowSeconds: 3_600 },
} as const;
