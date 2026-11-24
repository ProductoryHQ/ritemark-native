import { attachmentExtension, TEXT_EXTENSIONS, type PickedChatFile } from '../../../../src/views/chatAttachmentProtocol';
import type { AttachmentKind } from './types';

export function classifyFile(file: Pick<File, 'type' | 'name'>): AttachmentKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/xml' ||
    file.type === 'application/yaml' ||
    TEXT_EXTENSIONS.includes(attachmentExtension(file.name))
  ) {
    return 'text';
  }
  return null;
}

export function rebuildPickedFile({ name, mimeType, base64 }: PickedChatFile): File {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new File([bytes], name, { type: mimeType });
}
