import { createRelationship, ensureInviteCode, updateRelationship } from '@/lib/moments-api';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { getOnboardingDraft } from '@/lib/onboarding-v2';
import { useRelationshipStore } from '@/stores';
import type { Relationship } from '@/types/database';

type GetToken = () => Promise<string | null>;

let pending: Promise<Relationship> | null = null;

/**
 * Makes the couple's space (and its invite code) once, in the background.
 *
 * Onboarding starts this a couple of steps before the invite screen, so the
 * network round trip happens while they're picking a theme and widgets, and
 * the code is usually there the moment the invite screen opens. Calling it
 * again returns the same promise; a failure clears it so the next call retries.
 */
export function ensureOnboardingSpace(userId: string, getToken: GetToken): Promise<Relationship> {
  if (pending) return pending;
  pending = (async () => {
    const token = await getToken();
    if (!token) throw new Error('Not signed in');
    const store = useRelationshipStore.getState();
    let rel = store.relationship && store.relationship.status !== 'ended' ? store.relationship : null;
    if (!rel) {
      const draft = await getOnboardingDraft(userId);
      rel = await createRelationship(token, {
        relationship_name: draft.spaceName?.trim() || 'Our space',
        anniversary_date: draft.anniversaryDate ?? null,
        relationship_type: draft.relationshipType ?? null,
      });
      await markRelationshipOnboardingDone(userId);
    }
    const invite = rel.invite_code ?? (await ensureInviteCode(token, rel.id));
    const withCode = { ...rel, invite_code: invite };
    useRelationshipStore.getState().setRelationship(withCode);
    return withCode;
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/** Starts making the space without waiting (errors are retried on the invite screen). */
export function prewarmOnboardingSpace(userId: string | null | undefined, getToken: GetToken) {
  if (!userId || useRelationshipStore.getState().partner) return;
  ensureOnboardingSpace(userId, getToken).catch(() => undefined);
}

/**
 * The space may have been made before they went back and changed an answer:
 * bring its name, date and type in line with the latest answers (quietly).
 */
export async function syncSpaceWithDraft(userId: string, rel: Relationship, getToken: GetToken) {
  const draft = await getOnboardingDraft(userId);
  const updates: Partial<Relationship> = {};
  const name = draft.spaceName?.trim();
  if (name && name !== rel.relationship_name) updates.relationship_name = name;
  if (draft.anniversaryDate !== undefined && (draft.anniversaryDate ?? null) !== (rel.anniversary_date ?? null)) {
    updates.anniversary_date = draft.anniversaryDate ?? null;
  }
  if (draft.relationshipType !== undefined && (draft.relationshipType ?? null) !== (rel.relationship_type ?? null)) {
    updates.relationship_type = draft.relationshipType ?? null;
  }
  if (Object.keys(updates).length === 0) return;
  const token = await getToken();
  if (!token) return;
  const updated = await updateRelationship(token, rel.id, updates);
  useRelationshipStore.getState().setRelationship({ ...updated, invite_code: updated.invite_code ?? rel.invite_code });
}
