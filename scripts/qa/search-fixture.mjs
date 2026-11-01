#!/usr/bin/env node
/**
 * search-fixture.mjs - writes Sprint 148's large folder for the search index's measurements (M1, M3).
 *
 * Usage: node scripts/qa/search-fixture.mjs [--out /private/tmp/ritemark-search-fixture] [--scale 1]
 *
 * No client material: every word comes from a seeded generator over a made-up vocabulary (with Estonian
 * letters), and the Word and PDF files are made by the extension's own `docx` and `pdfkit`. The same seed
 * writes the same folder. At scale 1 it holds:
 *
 * - 10,000 Markdown files in nested folders (headings, paragraphs, lists, tables, comments);
 * - 300 Word files and 300 PDFs (1-40 pages), 200 CSV files, 20 scanned-style PDFs (no text);
 * - what search leaves out: `node_modules`, `.ritemark` (cards), `.claude`, `.git`, and a folder `.gitignore` ignores.
 *
 * Remove it after: `rm -rf <out>`. Writes only under --out, which must be under /private/tmp or the system temp folder.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const extension = path.resolve(here, '../../extensions/ritemark');
const require = createRequire(path.join(extension, 'package.json'));
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel } = require('docx');
const PDFDocument = require('pdfkit');

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
}

const out = path.resolve(arg('out', '/private/tmp/ritemark-search-fixture'));
const scale = Number(arg('scale', '1'));
const tmp = fs.realpathSync(os.tmpdir());
if (!out.startsWith('/private/tmp/') && !out.startsWith(`${tmp}${path.sep}`)) {
  console.error(`--out must be under /private/tmp or ${tmp}`);
  process.exit(2);
}

// ── A seeded generator ──────────────────────────────────────────────────────
let seed = 148;
function random() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

const COMMON = ('the of and to in is that for it with as was on be at by this had not are but from or have an they which one you were all we her she there would their will when who him been has more if no out so said what up its about into than them can only other new some could time these two may then do first any like now my such make over our even most me state after also made many before must through back years where much your way well down should because each just those people mr how too little good very great still being own here old get between both life under never day same another know while last might us however man came off since against go long used without take place think must').split(' ');
const SYLLABLES = ['ka', 'ma', 'ta', 'la', 'sa', 'va', 'ke', 'me', 'te', 'le', 'se', 'ki', 'mi', 'ti', 'li', 'si', 'ko', 'mo', 'to', 'lo', 'so', 'ku', 'mu', 'tu', 'lu', 'su', 'rä', 'mä', 'kä', 'tö', 'sö', 'lõ', 'kõ', 'rü', 'tü', 'ša', 'žu', 'har', 'bor', 'pen', 'dal', 'rin', 'gos', 'ver', 'nul', 'tri', 'ast', 'ond', 'eli', 'umi', 'ark', 'est', 'ing', 'tion', 'al', 'er', 'en', 'is'];
const VOCABULARY = [];
const seen = new Set(COMMON);
while (VOCABULARY.length < 30_000) {
  let word = '';
  const parts = between(1, 4);
  for (let i = 0; i < parts; i++) word += pick(SYLLABLES);
  if (word.length >= 3 && !seen.has(word)) {
    seen.add(word);
    VOCABULARY.push(word);
  }
}
// Zipf over the vocabulary: rank r drawn with weight 1/r.
const cumulative = [];
let total = 0;
for (let r = 1; r <= VOCABULARY.length; r++) {
  total += 1 / r;
  cumulative.push(total);
}
function zipfWord() {
  if (random() < 0.45) return pick(COMMON);
  const target = random() * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return VOCABULARY[lo];
}
function sentence(min = 6, max = 18) {
  const words = Array.from({ length: between(min, max) }, zipfWord);
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return `${words.join(' ')}.`;
}
const paragraph = () => Array.from({ length: between(2, 6) }, () => sentence()).join(' ');
const title = () => Array.from({ length: between(1, 4) }, zipfWord).join(' ').replace(/^./, (c) => c.toUpperCase());

function write(relative, data) {
  const target = path.join(out, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}

function markdown() {
  const lines = [`# ${title()}`, ''];
  const blocks = between(3, 12);
  for (let b = 0; b < blocks; b++) {
    const roll = random();
    if (roll < 0.6) lines.push(paragraph(), '');
    else if (roll < 0.75) lines.push(`## ${title()}`, '');
    else if (roll < 0.88) {
      for (let i = between(2, 6); i > 0; i--) lines.push(`- ${sentence(3, 10)}`);
      lines.push('');
    } else if (roll < 0.95) {
      lines.push(`| ${title()} | ${title()} |`, '| --- | --- |');
      for (let i = between(2, 5); i > 0; i--) lines.push(`| ${zipfWord()} | ${between(1, 9999)} |`);
      lines.push('');
    } else lines.push(`<!-- ${sentence(4, 10)} -->`, '');
  }
  return lines.join('\n');
}

function pdfBytes(pages, scanned) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ info: { Producer: 'search-fixture', Creator: 'search-fixture' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    for (let p = 0; p < pages; p++) {
      if (p) doc.addPage();
      if (scanned) {
        doc.rect(40, 40, 520, 700).fill('#9a9a9a');
        continue;
      }
      doc.fontSize(16).text(title());
      doc.moveDown();
      doc.fontSize(10);
      for (let i = between(2, 5); i > 0; i--) {
        doc.text(paragraph());
        doc.moveDown();
      }
    }
    doc.end();
  });
}

async function docxBytes() {
  const children = [new Paragraph({ text: title(), heading: HeadingLevel.HEADING_1 })];
  for (let i = between(3, 25); i > 0; i--) children.push(new Paragraph({ children: [new TextRun(paragraph())] }));
  if (random() < 0.4) {
    children.push(
      new Table({
        rows: Array.from({ length: between(2, 6) }, () => new TableRow({ children: [new TableCell({ children: [new Paragraph(zipfWord())] }), new TableCell({ children: [new Paragraph(sentence(2, 6))] })] })),
      }),
    );
  }
  const doc = new Document({ creator: 'search-fixture', sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function csv() {
  const rows = [['Name', 'Contact', 'Notes', 'Amount']];
  for (let i = between(50, 2000 * Math.min(1, scale)); i > 0; i--) rows.push([title(), `${zipfWord()} ${zipfWord()}`, sentence(3, 9), String(between(1, 99999))]);
  return rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')).join('\n');
}

async function main() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const started = Date.now();
  const count = (n) => Math.max(1, Math.round(n * scale));
  const folder = (i) => `area-${String(i % 50).padStart(2, '0')}/topic-${String(Math.floor(i / 50) % 10)}`;

  for (let i = 0; i < count(10_000); i++) write(`${folder(i)}/${title()} ${i}.md`, markdown());
  for (let i = 0; i < count(200); i++) write(`${folder(i * 7)}/table ${i}.csv`, csv());
  for (let i = 0; i < count(300); i++) write(`${folder(i * 3)}/letter ${i}.docx`, await docxBytes());
  for (let i = 0; i < count(300); i++) write(`${folder(i * 11)}/report ${i}.pdf`, await pdfBytes(random() < 0.1 ? between(20, 40) : between(1, 8), false));
  for (let i = 0; i < count(20); i++) write(`scans/scan ${i}.pdf`, await pdfBytes(between(1, 3), true));

  // What search leaves out.
  for (let i = 0; i < count(500); i++) write(`node_modules/pkg-${i % 20}/README ${i}.md`, markdown());
  for (let i = 0; i < count(100); i++) write(`.ritemark/tasks/${i}-card.md`, `---\nformat: task/1\n---\n# ${title()}\n`);
  for (let i = 0; i < count(100); i++) write(`.claude/notes ${i}.md`, markdown());
  write('.git/info/exclude', 'local-only/\n');
  for (let i = 0; i < count(50); i++) write(`local-only/draft ${i}.md`, markdown());
  write('.gitignore', 'build/\n*.log\n');
  for (let i = 0; i < count(500); i++) write(`build/out ${i}.md`, markdown());
  write('AGENTS.md', `# ${title()}\n\n${paragraph()}\n`);
  write('CLAUDE.md', '@AGENTS.md\n');

  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(target);
      else {
        files++;
        bytes += fs.statSync(target).size;
      }
    }
  };
  walk(out);
  console.log(`search fixture: ${files} files, ${(bytes / 1e6).toFixed(1)} MB in ${out} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
