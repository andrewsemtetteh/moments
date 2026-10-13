/** Email checks for the sign-up and password screens, with plain-language messages. */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Common slips in the big email domains, and what was meant. */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'icloud.co': 'icloud.com',
  'iclod.com': 'icloud.com',
};

/** What's wrong with the email, in plain words (null when it looks fine). */
export function emailProblem(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Enter your email.';
  if (!e.includes('@')) return 'An email needs an @, like name@example.com.';
  if (e.indexOf('@') !== e.lastIndexOf('@')) return 'An email can only have one @.';
  const [local, domain] = e.split('@');
  if (!local) return 'Add the part before the @.';
  if (!domain) return 'Add the part after the @, like gmail.com.';
  if (!EMAIL_PATTERN.test(e)) return 'That doesn’t look like an email. Check it for typos.';
  return null;
}

/** "you@gmial.com" → "you@gmail.com" (null if nothing to suggest). */
export function emailSuggestion(email: string): string | null {
  const [local, domain] = email.trim().toLowerCase().split('@');
  const fix = domain ? DOMAIN_TYPOS[domain] : undefined;
  return local && fix ? `${local}@${fix}` : null;
}
