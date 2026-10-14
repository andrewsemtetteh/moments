/** Invite codes are 8 characters (the Worker makes them), shown split in half: `ABCD-EFGH`. */
export const INVITE_CODE_LENGTH = 8;

/** Letters and digits only, upper case: what the server stores and matches. */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** `ABCD1234` -> `ABCD-1234`. Partial input splits at the same spot as you type. */
export function formatInviteCode(raw: string | null | undefined): string {
  const code = normalizeInviteCode(raw ?? '').slice(0, INVITE_CODE_LENGTH);
  const half = INVITE_CODE_LENGTH / 2;
  return code.length > half ? `${code.slice(0, half)}-${code.slice(half)}` : code;
}
