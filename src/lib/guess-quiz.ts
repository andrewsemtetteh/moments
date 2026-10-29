/**
 * A question put to your partner by name, for guessing their answer: "Sam, dream first-date redo?",
 * "Sam, what makes you feel most loved?". The first letter goes lower case, except "I" and capitals.
 */
export function askPartner(name: string, text: string): string {
  const keepCase = /^I(\b|[’'])/.test(text) || /^[A-Z]{2}/.test(text);
  return `${name}, ${keepCase ? text : text.charAt(0).toLowerCase() + text.slice(1)}`;
}
