const ATTACHMENT_PREFIX = '⟦ma⟧';

export type ChatAttachment =
  | { type: 'location'; label: string; latitude: number; longitude: number }
  | { type: 'contact'; name: string; email?: string; phone?: string }
  | { type: 'file'; name: string; url: string; mimeType?: string };

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
  }
}
