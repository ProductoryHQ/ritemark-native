export const TEXT_EXTENSIONS = ['md', 'rtms', 'txt', 'csv', 'json', 'xml', 'yaml', 'yml', 'toml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'py', 'sh', 'sql', 'log'];

const BINARY_MIME_TYPES = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['pdf', 'application/pdf'],
]);

const OFFICE_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt']);

export const CHAT_ATTACHMENT_EXTENSIONS = [...BINARY_MIME_TYPES.keys(), ...TEXT_EXTENSIONS, ...OFFICE_EXTENSIONS];

export function attachmentExtension(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';
}

export function splitPickedFiles(paths: readonly string[]) {
  const officePaths: string[] = [];
  const inlineFiles: { path: string; mimeType: string }[] = [];
  for (const path of paths) {
    const extension = attachmentExtension(path);
    if (OFFICE_EXTENSIONS.has(extension)) {
      officePaths.push(path);
    } else {
      // Text classification already falls back to the filename when MIME is empty.
      inlineFiles.push({ path, mimeType: BINARY_MIME_TYPES.get(extension) ?? '' });
    }
  }
  return { officePaths, inlineFiles };
}

export interface PickChatFilesMessage {
  type: 'chat:pick-files';
}

export interface PickedChatFile {
  name: string;
  mimeType: string;
  base64: string;
}

export interface ChatFilesPickedMessage {
  type: 'chat:files-picked';
  files: PickedChatFile[];
}
