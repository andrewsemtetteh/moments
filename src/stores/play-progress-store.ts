import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { isMissingTableError } from '@/lib/network-error';
import {
  applyAward,
  emptyProgress,
  normalizeProgress,
  titleForLevel,
  todayKey,
  type AwardInput,
  type AwardResult,
  type BadgeDef,
  type CoupleProgress,
  type QuestDef,
} from '@/lib/play-progress';
import { backend } from '@/lib/backend';

export type Celebration =
  | { id: string; kind: 'xp'; amount: number; label: string }
  | { id: string; kind: 'level'; level: number; title: string }
  | { id: string; kind: 'badge'; badge: BadgeDef }
  | { id: string; kind: 'quest'; quest: QuestDef };

interface PlayProgressState {
  relationshipId: string | null;
  progress: CoupleProgress | null;
  /** True once the remote table is known to be missing (migration not applied): stay local-only. */
  localOnly: boolean;
  celebrations: Celebration[];
  load: (relationshipId: string) => Promise<void>;
  award: (relationshipId: string, input: AwardInput, label?: string) => Promise<AwardResult | null>;
  dismissCelebration: (id: string) => void;
  clear: () => void;
}

const localKey = (relationshipId: string) => `moments_play_progress_${relationshipId}`;

async function readLocal(relationshipId: string): Promise<CoupleProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(localKey(relationshipId));
    return raw ? normalizeProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function writeLocal(relationshipId: string, progress: CoupleProgress) {
  try {
    await AsyncStorage.setItem(localKey(relationshipId), JSON.stringify(progress));
  } catch {
    // cache only — ignore
  }
}

type RemoteRead =
  | { ok: true; progress: CoupleProgress | null }
  | { ok: false; missing: boolean };

async function readRemote(relationshipId: string): Promise<RemoteRead> {
  const { data, error } = await backend
    .from('couple_progress')
    .select('*')
    .eq('relationship_id', relationshipId)
    .maybeSingle();
  if (error) return { ok: false, missing: isMissingTableError(error) };
  return { ok: true, progress: data ? normalizeProgress(data) : null };
}

async function writeRemote(relationshipId: string, progress: CoupleProgress): Promise<'ok' | 'missing' | 'failed'> {
  const { error } = await backend.from('couple_progress').upsert(
    {
      relationship_id: relationshipId,
      xp: progress.xp,
      stats: progress.stats,
      badges: progress.badges,
      play_streak: progress.playStreak,
      best_streak: progress.bestStreak,
      last_play_date: progress.lastPlayDate,
      quests: progress.quests,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'relationship_id' },
  );
  if (!error) return 'ok';
  return isMissingTableError(error) ? 'missing' : 'failed';
}

let chain: Promise<unknown> = Promise.resolve();
let subscription: { relationshipId: string; remove: () => void } | null = null;
let idCounter = 0;
const nextId = () => `c${Date.now()}_${idCounter++}`;

function celebrationsFor(result: AwardResult, label?: string): Celebration[] {
  const out: Celebration[] = [];
  if (result.gainedXp > 0) {
    out.push({ id: nextId(), kind: 'xp', amount: result.gainedXp, label: label ?? 'Nice play' });
  }
  for (const quest of result.completedQuests) out.push({ id: nextId(), kind: 'quest', quest });
  for (const badge of result.newBadges) out.push({ id: nextId(), kind: 'badge', badge });
  if (result.levelAfter > result.levelBefore) {
    out.push({
      id: nextId(),
      kind: 'level',
      level: result.levelAfter,
      title: titleForLevel(result.levelAfter),
    });
  }
  return out;
}

export const usePlayProgressStore = create<PlayProgressState>((set, get) => ({
  relationshipId: null,
  progress: null,
  localOnly: false,
  celebrations: [],

  load: async (relationshipId) => {
    if (get().relationshipId === relationshipId && get().progress) return;
    set({ relationshipId });

    const cached = await readLocal(relationshipId);
    if (cached && get().relationshipId === relationshipId) set({ progress: cached });

    const remote = await readRemote(relationshipId);
    if (get().relationshipId !== relationshipId) return;

    if (remote.ok) {
      const merged = remote.progress ?? cached ?? emptyProgress(todayKey());
      set({ progress: merged, localOnly: false });
      void writeLocal(relationshipId, merged);
      // Seed the shared row from any offline-earned progress.
      if (!remote.progress && cached && cached.xp > 0) void writeRemote(relationshipId, cached);
    } else {
      set({ progress: cached ?? emptyProgress(todayKey()), localOnly: remote.missing });
    }

    if (!subscription || subscription.relationshipId !== relationshipId) {
      subscription?.remove();
      const channel = backend
        .channel(`couple_progress:${relationshipId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'couple_progress', filter: `relationship_id=eq.${relationshipId}` },
          (payload) => {
            const row = (payload as { new?: unknown }).new;
            if (row && typeof row === 'object' && 'xp' in row) {
              const next = normalizeProgress(row);
              set({ progress: next });
              void writeLocal(relationshipId, next);
            }
          },
        )
        .subscribe();
      subscription = { relationshipId, remove: () => void backend.removeChannel(channel) };
    }
  },

  award: (relationshipId, input, label) => {
    const run = async (): Promise<AwardResult | null> => {
      if (get().relationshipId !== relationshipId || !get().progress) await get().load(relationshipId);

      // Re-read the shared row first so two phones awarding at once don't clobber each other.
      let base = get().progress ?? emptyProgress(todayKey());
      if (!get().localOnly) {
        const remote = await readRemote(relationshipId);
        if (remote.ok && remote.progress) base = remote.progress;
      }

      const result = applyAward(base, input);
      const celebrations = celebrationsFor(result, label);
      set((s) => ({ progress: result.progress, celebrations: [...s.celebrations, ...celebrations] }));
      void writeLocal(relationshipId, result.progress);

      if (!get().localOnly) {
        const status = await writeRemote(relationshipId, result.progress);
        if (status === 'missing') set({ localOnly: true });
      }
      return result;
    };

    const next = chain.then(run, run);
    chain = next.catch(() => null);
    return next.catch(() => null);
  },

  dismissCelebration: (id) => set((s) => ({ celebrations: s.celebrations.filter((c) => c.id !== id) })),

  clear: () => {
    subscription?.remove();
    subscription = null;
    set({ relationshipId: null, progress: null, celebrations: [], localOnly: false });
  },
}));
