import type { Relationship, UserProfile } from '@/types/database';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

class MomentsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new MomentsApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }

  return (await res.json()) as T;
}

export async function fetchMyProfile(token: string): Promise<UserProfile | null> {
  try {
    return await apiFetch<UserProfile>('/me', token);
  } catch (e) {
    if (e instanceof MomentsApiError && e.status === 404) return null;
    throw e;
  }
}

export async function createProfile(
  token: string,
  profile: { email: string; name?: string | null },
): Promise<UserProfile> {
  return apiFetch<UserProfile>('/users', token, { method: 'POST', body: profile });
}

/** My referral code and how many couples I've brought in. */
export async function getMyReferral(token: string): Promise<{ code: string; credited: number; days: number }> {
  return apiFetch('/me/referral', token);
}

/** Remember who invited me (from their link); credited when I pair with my partner. */
export async function claimReferral(token: string, code: string): Promise<{ ok: boolean; already: boolean }> {
  return apiFetch('/referrals/claim', token, { method: 'POST', body: { code } });
}

/** Permanently deletes the account: shared spaces close, all data, media and the sign-in go. */
export async function deleteMyAccount(token: string): Promise<void> {
  await apiFetch<{ ok: boolean }>('/me', token, { method: 'DELETE' });
}

export async function updateMyProfile(token: string, updates: Partial<UserProfile>): Promise<UserProfile> {
  return apiFetch<UserProfile>('/me', token, { method: 'PATCH', body: updates });
}

const AVATAR_CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

/** Uploads a local image URI (from expo-image-picker) as the caller's avatar; returns the updated profile. */
export async function uploadMyAvatar(token: string, localUri: string): Promise<UserProfile> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = AVATAR_CONTENT_TYPE_BY_EXT[ext] ?? 'image/jpeg';
  const blob = await (await fetch(localUri)).blob();

  const res = await fetch(`${API_URL}/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: blob,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new MomentsApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }

  return (await res.json()) as UserProfile;
}

export async function fetchMyRelationship(
  token: string,
): Promise<{ relationship: Relationship | null; partner: UserProfile | null }> {
  return apiFetch('/me/relationship', token);
}

export async function createRelationship(
  token: string,
  options?: { relationship_name?: string; anniversary_date?: string | null; relationship_type?: string | null },
): Promise<Relationship> {
  return apiFetch<Relationship>('/relationships', token, { method: 'POST', body: options ?? {} });
}

export async function ensureInviteCode(token: string, relationshipId: string): Promise<string> {
  const data = await apiFetch<{ invite_code: string }>(`/relationships/${relationshipId}/invite-code`, token, {
    method: 'POST',
  });
  return data.invite_code;
}

export async function joinRelationshipByInvite(
  token: string,
  inviteCode: string,
): Promise<{ relationship: Relationship; partner: UserProfile | null }> {
  return apiFetch('/relationships/join', token, { method: 'POST', body: { inviteCode } });
}

export async function updateRelationship(
  token: string,
  relationshipId: string,
  updates: Partial<Relationship>,
): Promise<Relationship> {
  return apiFetch<Relationship>(`/relationships/${relationshipId}`, token, { method: 'PATCH', body: updates });
}
