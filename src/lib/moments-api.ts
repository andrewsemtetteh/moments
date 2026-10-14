import type { Relationship, UserProfile } from '@/types/database';
import { prepareImageForUpload, readUriAsArrayBuffer } from '@/lib/prepare-image';

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

/** A couple's shared document (albums, place names) and its version. */
export type CoupleDoc<T> = { data: T | null; version: number };

export async function getCoupleDoc<T>(token: string, relationshipId: string, kind: string): Promise<CoupleDoc<T>> {
  return apiFetch(`/relationships/${relationshipId}/docs/${kind}`, token);
}

/**
 * Saves the document if `version` is still the latest. If the other phone
 * saved first, returns { conflict: true } with the latest copy instead of throwing.
 */
export async function putCoupleDoc<T>(
  token: string,
  relationshipId: string,
  kind: string,
  data: T,
  version: number,
): Promise<CoupleDoc<T> & { conflict?: boolean }> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');
  const res = await fetch(`${API_URL}/relationships/${relationshipId}/docs/${kind}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, version }),
  });
  const body = (await res.json().catch(() => ({}))) as CoupleDoc<T> & { error?: string };
  if (res.status === 409) return { data: body.data, version: body.version, conflict: true };
  if (!res.ok) throw new MomentsApiError(res.status, body.error ?? res.statusText);
  return { data: body.data, version: body.version };
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

/** Uploads a local image URI (from expo-image-picker) as the caller's avatar; returns the updated profile. */
export async function uploadMyAvatar(token: string, localUri: string): Promise<UserProfile> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

  // Always a real JPEG: picked photos can be HEIC or PNG whatever their file name says,
  // and a Blob body can override the Content-Type header (the "Unsupported image type" error).
  const image = await prepareImageForUpload(localUri, { maxSide: 1024 });
  const body = await readUriAsArrayBuffer(image.uri);

  const res = await fetch(`${API_URL}/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': image.contentType },
    body,
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
