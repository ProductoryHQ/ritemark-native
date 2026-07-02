import * as fs from 'fs';
import * as path from 'path';

interface DocumentUriLike {
  fsPath: string;
}

// pdfkit and docx can only decode PNG/JPEG. Any other format (SVG, GIF, BMP,
// TIFF, WebP) either crashes the encoder or renders as a broken image, so it
// must be skipped here rather than handed downstream. SVG rasterization
// (Sprint 90 Phase 2) plugs in ahead of this guard, converting SVG → PNG before
// it reaches tryLoadImageSource.
const DECODABLE_RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

export function tryLoadImageSource(imagePath: string, documentUri: DocumentUriLike): Buffer | null {
  try {
    let normalizedPath = imagePath.trim();

    if (normalizedPath.startsWith('data:image/')) {
      // Only accept raster formats pdfkit/docx can actually decode. GIF/BMP/TIFF
      // parse as valid data URLs but crash pdfkit — guard them out (issue #127 R3).
      const match = normalizedPath.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
      if (!match) {
        return null;
      }
      return Buffer.from(match[2], 'base64');
    }

    if (normalizedPath.startsWith('vscode-file://')) normalizedPath = normalizedPath.replace('vscode-file://', '');
    if (normalizedPath.startsWith('file://')) normalizedPath = normalizedPath.replace('file://', '');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return null;

    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(path.dirname(documentUri.fsPath), normalizedPath);

    // Skip file-referenced images the encoders can't render. Without this a
    // `.svg` (e.g. a draw.io diagram) is read as raw XML and thrown at pdfkit,
    // aborting the whole export (issue #127 R1).
    if (!DECODABLE_RASTER_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
      return null;
    }

    if (!fs.existsSync(absolutePath)) {
      return null;
    }
    return fs.readFileSync(absolutePath);
  } catch {
    return null;
  }
}
