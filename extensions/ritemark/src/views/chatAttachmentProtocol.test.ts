import assert from 'node:assert/strict';
import { CHAT_ATTACHMENT_EXTENSIONS, splitPickedFiles } from './chatAttachmentProtocol';

const officePaths = [
  '/project/Brief.DOCX', '/project/Archive.doc',
  '/project/Budget.xlsx', '/project/Costs.XLS',
  '/project/Slides.PPTX', '/project/Training.ppt',
];
for (const extension of ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'md', 'rtms', 'jpg', 'pdf']) {
  assert.ok(CHAT_ATTACHMENT_EXTENSIONS.includes(extension), `picker supports .${extension}`);
}

const inlineFiles = [
  { path: '/project/Photo.JPG', mimeType: 'image/jpeg' },
  { path: '/project/Brief.docx.pdf', mimeType: 'application/pdf' },
  { path: 'C:\\Project\\Notes.md', mimeType: '' },
  { path: '/project/Workshop.rtms', mimeType: '' },
];

assert.deepEqual(
  splitPickedFiles([inlineFiles[0].path, ...officePaths, ...inlineFiles.slice(1).map((file) => file.path)]),
  { officePaths, inlineFiles },
);
assert.deepEqual(splitPickedFiles([]), { officePaths: [], inlineFiles: [] });

console.log('chatAttachmentProtocol: passed');
