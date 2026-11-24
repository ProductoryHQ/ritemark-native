import * as fs from 'node:fs';
import * as path from 'node:path';
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

/** Attach a slide and source position to an existing guard without copying text to the record. */
export async function locateLiveIssues(deckPath: string, text: string, built: BuiltPage) {
  const folder = await fs.promises.realpath(path.dirname(deckPath));
  const sources = parseDeck(text.replace(/^\uFEFF/, '')).slides
    .map((slide, index) => ({ ...slide, index: index + 1 }))
    .filter(slide => !slideDataOf(slide.kind, slide.body).skip);
  const pictures: { slide?: number; file: string; outside: boolean; absolute: boolean }[] = [];
  const add = async (value: string, from: 'slide' | 'handout', slide?: number) => {
    const file = pictureFile(value, from);
    const absolute = ABSOLUTE_FILE.test(file);
    const local = path.resolve(folder, file);
    const real = absolute ? local : await fs.promises.realpath(local).catch(() => local);
    pictures.push({ slide, file: local, absolute, outside: absolute || !isInside(real, folder) });
  };
  const jobs: Promise<void>[] = [];
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
  handout(built.deck.preamble);
  await Promise.all(jobs);
  return (plan: GatheredPlan, issue?: LiveIssue): LiveIssue | undefined => {
    if (issue?.kind === 'key') {
      const hit = plan.keyHits.find(item => item.realPath === plan.pagePath);
      if (!hit) return issue;
      const page = parse(built.html);
      const index = built.deck.slides.findIndex((_, i) => {
        const parts = [page.getElementById(`s${i + 1}`), page.getElementById(`t${i + 1}`)];
        return parts.some(part => part && scanText(part.outerHTML).some(match => match.rule === hit.rule));
      });
      const source = sources[index];
      if (!source) return issue;
      const match = scanText(text.slice(source.start, source.handoutEnd)).find(item => item.rule === hit.rule);
      return {
        ...issue, slide: source.index, detail: `Slide ${source.index}'s text has what looks like a key.`,
        location: match && {
          line: text.slice(0, source.start).split('\n').length + match.line - 1,
          column: match.column, endColumn: match.endColumn,
        },
      };
    }
    const picture = pictures.find(item => ((!issue || issue.kind === 'outside') && item.absolute) ||
      (issue?.kind === 'outside' && item.outside) ||
      (issue?.kind === 'limits' && plan.tooBig.some(file => path.resolve(plan.projectFolder, file.projectPath) === item.file)) ||
      (issue?.kind === 'picture' && plan.leftOut.some(row => row.reason === 'uncleanable' && path.resolve(plan.projectFolder, row.display) === item.file)));
    if (!picture) return issue;
    if (picture.absolute || issue?.kind === 'outside') {
      return {
        kind: 'outside', slide: picture.slide,
        outsideFiles: picture.absolute ? undefined : issue?.outsideFiles,
        scope: picture.absolute ? undefined : issue?.scope,
        detail: issue?.kind === 'outside' && !issue.scope ? issue.detail : picture.slide
          ? `Slide ${picture.slide} shows a picture from outside the deck's folder.`
          : "The handout shows a picture from outside the deck's folder.",
      };
    }
    return issue && { ...issue, slide: picture.slide };
  };
}
