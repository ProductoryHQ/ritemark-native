/** Sprint 173 S5–S7. Run: npx tsx src/documents/powerpointMarkdown.test.ts */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { makeTempDir } from '../testing/tempDir';
import { readAsMarkdown } from './readAsMarkdown';
import { readProjectDocument } from './readProjectDocument';

const schema = 'http://schemas.openxmlformats.org';
const office = schema + '/officeDocument/2006/relationships';
const namespaces = `xmlns:p="${schema}/presentationml/2006/main" xmlns:a="${schema}/drawingml/2006/main" xmlns:r="${office}"`;
const pause = async () => undefined;
const slideParts = [3, 1, 6, 4, 2, 5];
const relationships = (contents: string) =>
  `<Relationships xmlns="${schema}/package/2006/relationships">${contents}</Relationships>`;
const text = (contents: string) => `<a:p><a:r><a:t>${contents}</a:t></a:r></a:p>`;
const shape = (contents: string, placeholder?: string) => `<p:sp>${placeholder !== undefined ? `<p:nvSpPr><p:nvPr><p:ph${placeholder ? ` type="${placeholder}"` : ' idx="1"'}/></p:nvPr></p:nvSpPr>` : ''}<p:txBody>${text(contents)}</p:txBody></p:sp>`;
const tree = (contents: string) => `<p:cSld><p:spTree>${contents}</p:spTree></p:cSld>`;
const cell = (contents: string) => `<a:tc><a:txBody>${text(contents)}</a:txBody></a:tc>`;
const table = `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr>${cell('Region')}${cell('Days')}</a:tr><a:tr>${cell('North | East')}${cell('5')}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;

async function fixture(notesParts: Array<number | null>): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<Types xmlns="${schema}/package/2006/content-types"/>`);
  zip.file('ppt/presentation.xml', `<p:presentation ${namespaces}><p:sldIdLst>${slideParts.map((part, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${part}"/>`).join('')}</p:sldIdLst></p:presentation>`);
  // Store relationship records and slide files in filename order, independently of display order.
  const sorted = [...slideParts].sort((a, b) => a - b);
  zip.file('ppt/_rels/presentation.xml.rels', relationships(sorted.map((part) =>
    `<Relationship Id="rId${part}" Type="${office}/slide" Target="slides/slide${part}.xml"/>`).join('')));
  for (const part of sorted) {
    const index = slideParts.indexOf(part);
    const slide = index + 1;
    zip.file(`ppt/slides/slide${part}.xml`, `<p:sld ${namespaces}${slide === 6 ? ' show="0"' : ''}>${tree(shape(`Slide ${slide} &amp; its text`) + (slide === 3 ? table : ''))}</p:sld>`);
    const notesPart = notesParts[index];
    const layout = `<Relationship Id="rId1" Type="${office}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`;
    const notes = notesPart == null ? '' :
      `<Relationship Id="rId2" Type="${office}/notesSlide" Target="../notesSlides/notesSlide${notesPart}.xml"/>`;
    zip.file(`ppt/slides/_rels/slide${part}.xml.rels`, relationships(layout + notes));
    if (notesPart != null) {
      const placeholders = shape('Ignored thumbnail', 'sldImg') + shape(`Speaker notes for slide ${slide}.`, slide === 6 ? '' : 'body') + shape('Ignored page number', 'sldNum');
      zip.file(`ppt/notesSlides/notesSlide${notesPart}.xml`, `<p:notes ${namespaces}>${tree(placeholders)}</p:notes>`);
    }
  }
  return zip.generateAsync({ type: 'uint8array' });
}

function expectedSlide(slide: number, hasNotes: boolean): string {
  const body = slide === 3 ? '\n\n| Region | Days |\n| --- | --- |\n| North \\| East | 5 |' : '';
  const notes = hasNotes ? `Notes:\n\nSpeaker notes for slide ${slide}.` : 'Notes: none';
  return `## Slide ${slide}${slide === 6 ? ' (hidden)' : ''}\n\nSlide ${slide} & its text${body}\n\n${notes}`;
}

async function main() {
  const project = makeTempDir('rm-powerpoint-read-');
  const cases = [
    { name: 'Slide 5 has no notes.pptx', notes: [1, 2, 3, 4, null, 5] }, // S5
    { name: 'Notes out of order.pptx', notes: [5, 4, 1, 3, null, 2] }, // S6
    { name: 'No speaker notes.pptx', notes: [null, null, null, null, null, null] }, // S7
  ];
  for (const { name, notes } of cases) {
    const bytes = await fixture(notes);
    const path = join(project, name);
    await writeFile(path, bytes);
    const read = (from?: number, to?: number) => readProjectDocument({ path: name, from, to }, [project], pause);
    const result = await read();
    assert.equal(result.kind, 'powerpoint');
    assert.equal(result.text, [
      `${name} · PowerPoint · 6 slides · whole text`,
      ...notes.map((part, index) => expectedSlide(index + 1, part !== null)),
    ].join('\n\n'));
    assert.deepEqual(await readFile(path), Buffer.from(bytes));
    assert.equal((await read(5, 6)).text, [
      `${name} · PowerPoint · 6 slides · slides 5–6`, expectedSlide(5, false), expectedSlide(6, notes[5] !== null),
    ].join('\n\n'));
    assert.equal((await read(7)).isError, true);
    const lookup = async (page: number, text: string) =>
      (await readProjectDocument({ path: name, passage: { page, text } }, [project], pause)).location;
    assert.deepEqual(await lookup(5, 'slide 5 & its text'), { page: 5, text: 'Slide 5 & its text', occurrence: 0 });
    assert.equal(await lookup(5, 'Speaker notes for slide 4.'), undefined);
    const cut = await readAsMarkdown(bytes, name, 'powerpoint', {}, pause, expectedSlide(1, notes[0] !== null).length);
    assert.equal(cut.text, [
      `${name} · PowerPoint · 6 slides · cut after slide 1 of 6`,
      expectedSlide(1, notes[0] !== null), 'Text was cut after slide 1 of 6.',
    ].join('\n\n'));
  }
  console.log('documents/powerpointMarkdown: S5–S7, slide order, tables, ranges and cut text passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
