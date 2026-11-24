import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { limitLine } from '../../webview/src/components/publish/publishSheetCopy';
import { previewKey } from './keyPreview';
import { keyPauseDetail, outsidePauseDetail } from './deckLiveCopy';
import { isInside } from '../browser/localPage';
import type { LiveIssue } from '../publish/liveUpdate';
import { scanText } from '../publish/secretScan';
import type { GatheredPlan } from '../publish/types';
import { parseDeck, slideDataOf } from './deckFormat';
import { lexBlockSlide, picturePathOf } from './blocks/slideRenderer';
import { picturePaths, type BuiltPage } from './page/pageFile';
import { lexHandout, pictureFile } from './page/pageHtml';
import { marked } from 'marked';
import { parse } from 'node-html-parser';

const ABSOLUTE_FILE = /^(?:[\\/]|[a-z]:|file:)/i;

/** Show a path without exposing a machine's home directory in the menu or record. */
export function liveFileDisplay(file: string, project: string, home: string): string {
  const platform = /^[a-z]:|^\\\\/i.test(file) ? 'win32' : process.platform;
  const paths = platform === 'win32' ? path.win32 : path;
  const relative = (base: string) => paths.relative(base, file).replace(/\\/g, '/');
  if (isInside(file, project, platform)) return relative(project);
  if (isInside(file, home, platform)) return `~/${relative(home)}`;
  return `…/${paths.basename(file)}`;
}

/** Attach a slide, source position and masked preview to a pause. */
export async function locateLiveIssues(deckPath: string, text: string, built: BuiltPage) {
  const folder = await fs.promises.realpath(path.dirname(deckPath));
  text = text.replace(/^\uFEFF/, '');
  const sources = parseDeck(text).slides
    .map((slide, index) => ({ ...slide, index: index + 1 }))
    .filter(slide => !slideDataOf(slide.kind, slide.body).skip);
  const add = async (value: string, from: 'slide' | 'handout', slide?: number) => {
    const file = pictureFile(value, from);
    const absolute = ABSOLUTE_FILE.test(file);
    let local = path.resolve(folder, file);
    if (/^file:/i.test(file)) {
      try { local = fileURLToPath(file); } catch { /* Keep the reference for its display name. */ }
    } else if (/^[a-z]:|^\\\\/i.test(file)) {
      local = path.win32.normalize(file);
    }
    const real = absolute ? local : await fs.promises.realpath(local).catch(() => local);
    return { slide, file: local, absolute, outside: absolute || !isInside(real, folder) };
  };
  const jobs: ReturnType<typeof add>[] = [];
  const handout = (markdown: string, slide?: number) => {
    marked.walkTokens(lexHandout(markdown), token => {
      if (token.type === 'image' && ABSOLUTE_FILE.test(token.href)) jobs.push(add(token.href, 'handout', slide));
    });
  };
  for (const [i, slide] of built.deck.slides.entries()) {
    const number = sources[i]?.index ?? i + 1;
    for (const picture of picturePaths({ ...built.deck, slides: [slide], preamble: '' })) {
      jobs.push(add(picture.path, picture.from, number));
    }
    if (slide.data.image && ABSOLUTE_FILE.test(slide.data.image.trim())) jobs.push(add(slide.data.image, 'slide', number));
    if (slide.data.markdown) marked.walkTokens(lexBlockSlide(slide.data.markdown), token => {
      if (token.type !== 'image') return;
      const value = picturePathOf(token.href);
      if (ABSOLUTE_FILE.test(value)) jobs.push(add(value, 'slide', number));
    });
    handout(slide.handout, number);
  }
  for (const picture of picturePaths({ ...built.deck, slides: [] })) jobs.push(add(picture.path, picture.from));
  handout(built.deck.preamble);
  const pictures = await Promise.all(jobs);
  return (plan: GatheredPlan, issue?: LiveIssue): LiveIssue | undefined => {
    if (issue?.kind === 'key') {
      const hit = plan.keyHits.find(item => item.realPath === plan.pagePath);
      if (!hit) return { ...issue, detail: keyPauseDetail() };
      const page = parse(built.html);
      const index = built.deck.slides.findIndex((_, i) => {
        const parts = [page.getElementById(`s${i + 1}`), page.getElementById(`t${i + 1}`)];
        return parts.some(part => part && scanText(part.outerHTML).some(match => match.rule === hit.rule));
      });
      const source = sources[index];
      const part = source ? text.slice(source.start, source.handoutEnd) : text.slice(0, sources[0]?.start ?? text.length);
      const match = scanText(part).find(item => item.rule === hit.rule);
      const line = match && part.split('\n')[match.line - 1];
      const keyPreview = line && match ? previewKey(line.slice(match.column, match.endColumn)) : undefined;
      return {
        ...issue, slide: source?.index, detail: keyPauseDetail(source?.index),
        keyPreview,
        location: source && match && {
          line: text.slice(0, source.start).split('\n').length + match.line - 1,
          column: match.column, endColumn: match.endColumn,
        },
      };
    }
    if (issue?.kind === 'limits') {
      const tooBig = new Set(plan.tooBig.map(file => path.resolve(plan.projectFolder, file.projectPath)));
      const picture = pictures.find(item => tooBig.has(item.file));
      const files = plan.tooBig.map(file => ({ name: path.basename(file.projectPath), size: file.size }));
      return { ...issue, slide: picture?.slide, detail: limitLine(files, plan.tooMany) ?? issue.detail };
    }
    const absolute = pictures.find(item => item.absolute);
    if (issue?.kind === 'outside' || (!issue && absolute)) {
      const picture = issue ? pictures.find(item => item.outside) : absolute;
      const home = homedir();
      const display = (file: string) => liveFileDisplay(file, plan.projectFolder, home);
      const files = [
        ...pictures.filter(item => item.outside).map(item => display(item.file)),
        ...(issue?.outsideFiles ?? []).map(file => display(path.resolve(plan.projectFolder, file))),
      ];
      const outsideFiles = [...new Set(files)];
      return {
        kind: 'outside', slide: picture?.slide, outsideFiles,
        scope: absolute ? undefined : issue?.scope,
        detail: outsidePauseDetail(picture?.slide, outsideFiles),
      };
    }
    if (issue?.kind === 'picture') {
      const picture = pictures.find(item => plan.leftOut.some(row =>
        row.reason === 'uncleanable' && path.resolve(plan.projectFolder, row.display) === item.file));
      if (picture) return { ...issue, slide: picture.slide };
    }
    return issue;
  };
}
