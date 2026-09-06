import { Icon, type IconSize } from '../ui/Icon';
import { isConversationIdentityColorSlot } from '../../../../src/conversations/identityColor';

export function conversationTone(identityColorSlot: number): string {
  const slot = isConversationIdentityColorSlot(identityColorSlot) ? identityColorSlot : 0;
  return `var(--r-conversation-${slot})`;
}

export function ConversationBubbleIcon({ identityColorSlot, size = 16, className }: {
  identityColorSlot: number;
  size?: IconSize;
  className?: string;
}) {
  return (
    <span className={`inline-flex shrink-0 ${className ?? ''}`} style={{ color: conversationTone(identityColorSlot) }}>
      <Icon name="chat-circle" size={size} weight="duotone" tone="inherit" />
    </span>
  );
}
