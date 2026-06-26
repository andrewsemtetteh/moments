const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Strip control characters from any text input. */
export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, '');
}

/** Email field — no whitespace, safe charset, max RFC-friendly length. */
export function sanitizeEmailInput(value: string): string {
  return stripControlChars(value).replace(/\s/g, '').slice(0, 254);
}

/** Display name — collapse whitespace, limit length. */
export function sanitizeNameInput(value: string): string {
  return stripControlChars(value).replace(/\s+/g, ' ').slice(0, 80);
}

/** Password — strip control chars only; preserve intentional spaces. */
export function sanitizePasswordInput(value: string): string {
  return stripControlChars(value).slice(0, 128);
}

/** OTP / numeric codes — digits only. */
export function sanitizeOtpInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}
