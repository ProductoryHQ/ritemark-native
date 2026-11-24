import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { OFFICE_PREVIEW_LIMITS } from '../officePreview/officePackageCheck';
import { DEFAULT_SEARCH_LIMITS } from '../search/protocol';
import { cloudState, oneDriveRootsFromEnv } from '../search/worker/cloudFiles';
import { samePath } from '../utils/pathIdentity';
import type { DocumentReadRequest, DocumentReadResult } from './documentRead';
import { resolveProjectDocument } from './projectPath';
import { documentTooLarge, readAsMarkdown } from './readAsMarkdown';

// At most one rendered result stays in this worker. Every call still resolves
// the path and confirms access to the current file before using the result.
let lastRead: { key: string; result: DocumentReadResult } | undefined;

const outside = { text: 'Choose a file inside the project folder. Ritemark can only read project documents.', isError: true };

export async function readProjectDocument(
  request: DocumentReadRequest,
  roots: readonly string[],
  pause: () => Promise<void>,
  platform = process.platform,
): Promise<DocumentReadResult> {
  const resolved = await resolveProjectDocument(request.path, roots);
  if (!resolved.ok) {
    return resolved.reason === 'outside' ? outside : { text: 'The file could not be found or opened. Check its location and permissions in the project folder.' };
  }

  const target = resolved.path;
  const name = path.basename(target).replace(/[\r\n\u2028\u2029]/g, ' ');
  const extension = path.extname(target).toLowerCase();
  const unavailable = { text: `Couldn't open ${name}. Check that the file is still in the project and that you can open it.` };
  try {
    const before = await lstat(target);
    if (!before.isFile()) return { text: 'Choose a Word (.docx), PDF, or PowerPoint (.pptx) file inside the project folder.' };
    if (extension === '.doc') {
      return { text: `${name} is an older Word format. Open it in Word and save a .docx copy.` };
    }
    if (extension === '.ppt') {
      return { text: `${name} is an older PowerPoint format. Open it in PowerPoint and save a .pptx copy.` };
    }
    if (extension !== '.docx' && extension !== '.pdf' && extension !== '.pptx') {
      return { text: 'This tool reads Word (.docx), PDF, and PowerPoint (.pptx) files. You can open Markdown files in the Ritemark editor.' };
    }

    const kind = extension === '.docx' ? 'word' : extension === '.pdf' ? 'pdf' : 'powerpoint';
    if (kind === 'word' && (request.from !== undefined || request.to !== undefined)) {
      return { text: 'Read a Word document by passing its path alone.', isError: true };
    }
    const maxBytes = kind === 'powerpoint' ? OFFICE_PREVIEW_LIMITS.maxFileBytes
      : kind === 'word' ? DEFAULT_SEARCH_LIMITS.docxBytes : DEFAULT_SEARCH_LIMITS.pdfBytes;
    const oneDriveRoots = oneDriveRootsFromEnv(process.env);
    const cloud = cloudState(resolved.candidate, before, platform, oneDriveRoots)
      ?? cloudState(target, before, platform, oneDriveRoots);
    if (cloud === 'online-only') {
      return { kind, text: `${name} is kept online only. Download it yourself or save a local copy in the project, then try again.` };
    }
    if (cloud === 'cloud-folder') {
      return { kind, text: `${name} is in a OneDrive folder where files may be kept online only. Save a copy in a local project folder outside OneDrive, then try again.` };
    }
    if (before.size > maxBytes) return documentTooLarge(name, kind);

    // A file may change between resolution and open. Check the open handle and
    // the current canonical path before reading, and never read beyond the cap.
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
    const handle = await open(target, flags);
    let bytes: Uint8Array;
    let key: string;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) return unavailable;
      if (!samePath(await realpath(target), target)) return outside;
      const current = await lstat(target);
      if (!current.isFile() || current.dev !== stat.dev || current.ino !== stat.ino) return unavailable;
      if (stat.size > maxBytes) return documentTooLarge(name, kind);
      key = JSON.stringify([target, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs, request.from, request.to]);
      if (lastRead?.key === key) return lastRead.result;

      const buffer = new Uint8Array(stat.size);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (bytesRead === 0) return unavailable;
        offset += bytesRead;
      }
      const after = await handle.stat();
      if (after.size > maxBytes) return documentTooLarge(name, kind);
      if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) return unavailable;
      bytes = buffer;
    } finally {
      await handle.close();
    }
    const result = await readAsMarkdown(bytes, name, kind, request, pause);
    lastRead = { key, result };
    return result;
  } catch {
    return unavailable;
  }
}
