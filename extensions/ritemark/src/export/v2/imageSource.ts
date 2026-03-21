import * as fs from 'fs';
import * as path from 'path';

interface DocumentUriLike {
  fsPath: string;
}

export function tryLoadImageSource(imagePath: string, documentUri: DocumentUriLike): Buffer | null {
  try {
    let normalizedPath = imagePath.trim();

    if (normalizedPath.startsWith('data:image/')) {
      const match = normalizedPath.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
      if (!match) {
        return null;
      }
      return Buffer.from(match[1], 'base64');
    }

    if (normalizedPath.startsWith('vscode-file://')) normalizedPath = normalizedPath.replace('vscode-file://', '');
    if (normalizedPath.startsWith('file://')) normalizedPath = normalizedPath.replace('file://', '');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return null;

    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(path.dirname(documentUri.fsPath), normalizedPath);

    if (!fs.existsSync(absolutePath)) {
      return null;
    }
    return fs.readFileSync(absolutePath);
  } catch {
    return null;
  }
}
