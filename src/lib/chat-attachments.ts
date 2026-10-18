const ATTACHMENT_PREFIX = '⟦ma⟧';

export type ChatAttachment =
  | { type: 'location'; label: string; latitude: number; longitude: number }
  | { type: 'contact'; name: string; email?: string; phone?: string }
  | { type: 'file'; name: string; url: string; mimeType?: string }
  /** Posted when you've both answered every question in a Play pack. */
  | { type: 'play_result'; packId: string; title: string; area: string; count: number }
  /** A daily quest finished or a trophy unlocked, posted for you both. */
  | {
      type: 'achievement';
      kind: 'quest' | 'trophy';
      /** The trophy or quest id, so tapping the card opens that exact one (older cards lack it). */
      id?: string;
      emoji: string;
      title: string;
      sub: string;
    }
  /** A message about a plan, sent from the plan's page: the plan as a card, the words under it. */
  | {
      type: 'plan';
      planId: string;
      title: string;
      /** When the plan is (ISO). */
      at: string;
      location?: string;
      reply?: string;
    }
  /** A reply or reaction to your partner's answer in a Play pack (Paired-style). */
  | {
      type: 'play_answer';
      packId: string;
      packTitle: string;
      question: string;
      answer: string;
      answerBy: string;
      reply?: string;
      reaction?: string;
    };

export function encodeAttachment(attachment: ChatAttachment): string {
  return ATTACHMENT_PREFIX + JSON.stringify(attachment);
}

export function parseAttachment(content: string | null | undefined): ChatAttachment | null {
  if (!content?.startsWith(ATTACHMENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(ATTACHMENT_PREFIX.length)) as ChatAttachment;
    if (!parsed?.type) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAttachmentPreviewText(attachment: ChatAttachment): string {
  switch (attachment.type) {
    case 'location':
      return `📍 ${attachment.label}`;
    case 'contact':
      return `👤 ${attachment.name}`;
    case 'file':
      return `📎 ${attachment.name}`;
    case 'play_result':
      return `🎮 You both finished “${attachment.title}”`;
    case 'achievement':
      return attachment.kind === 'quest' ? `${attachment.emoji} Quest complete: ${attachment.title}` : `🏆 Trophy unlocked: ${attachment.title}`;
    case 'plan':
      return attachment.reply ? `📅 ${attachment.reply}` : `📅 ${attachment.title}`;
    case 'play_answer':
      return attachment.reaction
        ? `${attachment.reaction} on “${attachment.question}”`
        : `💬 ${attachment.reply ?? attachment.question}`;
  }
}
