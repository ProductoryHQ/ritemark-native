#!/usr/bin/env node
// Sprint 145, R1 revision (#588): the base check. While `scripts/qa/stale-write-check.mjs --attach` runs in a
// workspace, record every version of every `stale-*.md` file that appears on disk (the check's first text, each of
// Ritemark's saves, the writer's copy), then compare the writer's copy with each earlier version paragraph by
// paragraph.
//
//   node base-versions.mjs watch <workspace> <out.json>      (until killed; polls every 50 ms)
//   node base-versions.mjs report <out.json>
//
// "Paragraph" is a block between blank lines, compared as logical text (line endings and a byte order mark are
// not content). The writer in S1 changes line 1 of the copy it read, so its copy should differ from the save it
// read in exactly one paragraph, and from the person's newest save in that one plus the paragraph typed after.
import fs from 'node:fs';
import path from 'node:path';

const [mode, a, b] = process.argv.slice(2);
const logical = (text) => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const paragraphs = (text) => logical(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

if (mode === 'watch') {
  const versions = {};
  const save = () => fs.writeFileSync(b, JSON.stringify(versions, null, 1));
  setInterval(() => {
    for (const name of fs.readdirSync(a).filter((n) => /^stale-.*\.md$/.test(n))) {
      let text;
      try { text = fs.readFileSync(path.join(a, name), 'utf8'); } catch { continue; }
      const list = (versions[name] ??= []);
      if (list.length === 0 || list[list.length - 1].text !== text) {
        list.push({ at: Date.now(), text });
        save();
      }
    }
  }, 50);
} else if (mode === 'report') {
  const versions = JSON.parse(fs.readFileSync(a, 'utf8'));
  const rows = [];
  for (const [name, list] of Object.entries(versions)) {
    const writerIndex = list.findIndex((v) => v.text.includes('edited by the writer'));
    if (writerIndex < 0) continue;
    const writer = paragraphs(list[writerIndex].text);
    const earlier = list.slice(0, writerIndex).map((v, index) => {
      const mine = paragraphs(v.text);
      const length = Math.max(mine.length, writer.length);
      const differing = [];
      for (let i = 0; i < length; i++) if (mine[i] !== writer[i]) differing.push(i + 1);
      return { version: index, paragraphs: mine.length, differingParagraphs: differing };
    });
    rows.push({ file: name, versionsBeforeTheWrite: writerIndex, writerParagraphs: writer.length, earlier });
  }
  console.log(JSON.stringify(rows, null, 1));
}
