import { localContent, sanitizeContent, type LocalContent } from '@/lib/game-room/content';
import type { LiveGameKind, Vibe } from '@/lib/game-room/types';
import { backend } from '@/lib/backend';

const AI_TIMEOUT_MS = 12_000;

export interface GameContentRequest {
  relationshipId: string;
  game: LiveGameKind;
  vibe: Vibe;
  count: number;
  topic?: string;
  names?: string[];
}

export interface GameContentResult extends LocalContent {
  source: 'ai' | 'local';
}

/**
 * AI-generated rounds for a live room (via the `generate-game-content` edge function), tuned to
 * the couple's vibe. Never throws: on timeout, rate-limit, or malformed output it falls back to
 * the bundled banks so the room always starts.
 */
export async function fetchGameContent(input: GameContentRequest): Promise<GameContentResult> {
  const fallback = (): GameContentResult => ({
    ...localContent(input.game, input.vibe, input.count),
    source: 'local',
  });

  // Nothing to generate for games where the players supply the content.
  if (input.game === 'twoTruths') return { items: [], pool: null, source: 'local' };

  try {
    const request = backend.functions.invoke('generate-game-content', {
      body: {
        relationship_id: input.relationshipId,
        game: input.game,
        vibe: input.vibe,
        count: input.count,
        topic: input.topic ?? '',
        names: input.names ?? [],
      },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS),
    );
    const { data, error } = await Promise.race([request, timeout]);
    if (error) {
      // Free, or the trial's AI games are used up: say so once, then play our own rounds.
      void import('@/lib/plus').then(({ handlePlusError }) => handlePlusError(error));
      return fallback();
    }
    const clean = sanitizeContent(input.game, data);
    if (!clean) return fallback();

    // Top up if the model returned fewer rounds than requested.
    if (clean.items.length > 0 && clean.items.length < input.count) {
      const extra = localContent(input.game, input.vibe, input.count - clean.items.length).items;
      return { items: [...clean.items, ...extra], pool: clean.pool, source: 'ai' };
    }
    return { ...clean, source: 'ai' };
  } catch {
    return fallback();
  }
}
