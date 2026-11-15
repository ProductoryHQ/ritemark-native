/**
 * Sprint 159 (technical plan §6): the handout page's HTML. The same deck gives the same bytes; every shown slide and
 * section is there; every prompt has Copy and an exercise's steps have ticks; the page loads nothing from the web; the
 * gather finds only the pictures the shown slides use; the script builds no file names; and no private test word is
 * in the bytes.
 *
 * Run: npx tsx src/decks/page/pageHtml.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { BUILT_IN_THEME } from '../deckTheme';
import { cssReferences, pageReferences, scriptBuildsReferences } from '../../publish/references';
import { scanText } from '../../publish/secretScan';
import { PAGE_FONTS } from './pageFile';
import { DIGEST_META, encodePath, handoutHtml, pageHtml, sanitizeHtml, type PageAssets } from './pageHtml';
import { PAGE_SCRIPT } from './pageScript';
import { deckDigest, publicDeck } from './publicDeck';
import { PRIVATE_DECK, PRIVATE_WORDS, PUBLIC_WORDS } from './testing/privateDeck';

const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};
const there = new Set(['images/which-stays.png']);
const pictureUrl = (picture: string) => (there.has(picture) ? encodePath(picture) : null);

const deck = publicDeck(PRIVATE_DECK, { folderName: 'Harbour Logistics', deckName: 'AI assistants and agents', theme: BUILT_IN_THEME });
const digest = deckDigest(deck);
const html = pageHtml(deck, assets, { digest, pictureUrl });
const root = parse(html);

// The same deck, the same bytes.
assert.equal(pageHtml(deck, assets, { digest, pictureUrl }), html);

// No private test word reaches the page's bytes.
for (const [place, word] of Object.entries(PRIVATE_WORDS)) {
  assert.ok(!html.toLowerCase().includes(word.toLowerCase()), `${place}: "${word}" must not be on the page`);
}
// And the public words do (the handout's prose, as HTML, with its entities).
for (const word of PUBLIC_WORDS) assert.ok(html.includes(word.replace(/'/g, '&#39;')), `"${word}" is on the page`);

// The head: the generator, the digest, the title; nothing of Ritemark in what a reader sees.
assert.match(html, /^<!doctype html>\n<html lang="en">/);
assert.ok(html.includes('<meta name="generator" content="Ritemark">'));
assert.ok(html.includes(`<meta name="${DIGEST_META}" content="${digest}">`));
assert.equal(root.querySelector('title')!.text, 'Harbour title');
assert.ok(!root.querySelector('body')!.text.includes('Ritemark'), 'nothing of Ritemark on the page');
assert.equal(root.querySelector('.who b')!.text, 'Harbour Logistics');
assert.equal(root.querySelector('body')!.getAttribute('class'), 'bl', 'the deck\'s look (Borderless) holds');

// Every shown slide is drawn once, in order, the first one on; each has its part in the text.
const layers = root.querySelectorAll('.slidebox > .layer');
assert.equal(layers.length, deck.slides.length);
assert.deepEqual(layers.map(layer => layer.getAttribute('data-title')), ['Harbour title', 'Why agents?', 'Build an assistant for one task', 'Assistant or agent?', 'Read the room']);
assert.equal(layers.filter(layer => layer.classList.contains('on')).length, 1);
assert.ok(layers[0].classList.contains('on'));
assert.ok(layers.every(layer => layer.querySelector('.deck-slide.is-borderless .deck-sl')), 'each layer holds the deck view\'s slide');
const parts = root.querySelectorAll('#text .part');
assert.deepEqual(parts.map(part => part.getAttribute('id')), ['s1', 's2', 's3', 's4', 's5']);
assert.deepEqual(parts.map(part => part.getAttribute('data-i')), ['0', '1', '2', '3', '4']);
assert.equal(root.querySelector('#pos')!.text, '1 / 5');

// A Section is the grey band with "Section N" over its title; the other parts say "Slide N", an exercise marked.
const band = root.querySelector('#s2')!;
assert.ok(band.classList.contains('sect'));
assert.equal(band.querySelector('.eyebrow')!.text, 'Section 1');
assert.equal(band.querySelector('h2')!.text, 'Why agents?');
assert.equal(root.querySelector('#s3 .lab')!.text, 'Slide 3Exercise');
assert.equal(root.querySelector('#s1 .lab')!.text, 'Slide 1');

// Contents: every part by its title, the exercise marked, with a tick for when it is done.
const goers = root.querySelectorAll('#toc [data-go]');
assert.deepEqual(goers.map(button => button.querySelector('.n')!.text), ['1', '2', '3', '4', '5']);
assert.ok(root.querySelector('#toc')!.hasAttribute('hidden'));
assert.ok(goers[2].querySelector('.tag') && goers[2].querySelector('.done svg'));
assert.ok(goers[1].querySelector('.sec'), 'a section is bold in Contents');

// The text before the first slide is at the top of the text, as in the deck view's handout.
assert.equal(root.querySelector('#text > .pre')!.text.trim(), 'Before the first slide: PREAMBLEPUBLIC, for everyone.');

// Every prompt has Copy; the label before it is the prompt's label; an exercise's numbered steps have ticks.
const prompts = root.querySelectorAll('.prompt');
assert.equal(prompts.length, root.querySelectorAll('pre').length, 'every code block is a prompt');
assert.equal(prompts.length, 2);
for (const prompt of prompts) assert.ok(prompt.querySelector('button.copy'), 'with Copy');
assert.equal(root.querySelector('#s3 .k')!.text, 'PROMPT');
const steps = root.querySelectorAll('#s3 ol.steps > li.step input[type="checkbox"][data-tick]');
assert.equal(steps.length, 2);
assert.notEqual(steps[0].getAttribute('data-tick'), steps[1].getAttribute('data-tick'));
assert.match(root.querySelector('#text')!.getAttribute('data-store')!, /^ritemark-ticks-[0-9a-f]{12}$/);
// A prompt that shows a comment shows it as words.
assert.ok(html.includes('&lt;!-- a prompt that shows a comment stays as written --&gt;'));

// The page loads nothing from the web: its own references are its pictures, relative to it, and its CSS only data.
const references = pageReferences(html);
const loads = references.refs.filter(ref => ref.as !== 'link').map(ref => ref.value);
assert.deepEqual(loads, ['images/which-stays.png'], 'the gather finds the picture a shown part uses, and nothing else');
for (const css of references.inlineCss) {
  for (const ref of cssReferences(css)) assert.match(ref.value, /^data:font\/woff2;base64,/, `the CSS loads only its fonts, inline: ${ref.value.slice(0, 40)}`);
}
assert.ok(!/(?:src|href)="(?:https?:)?\/\//i.test(html.replace(/<a href="https:\/\/[^"]*" target="_blank" rel="noopener noreferrer">/g, '')), 'no remote address but the handout\'s own web links');
assert.ok(!/@import|<link\b/i.test(html), 'no stylesheet from elsewhere');
assert.equal(references.inlineScripts.length, 1);
assert.equal(references.builtAttribute, false);
assert.equal(scriptBuildsReferences(PAGE_SCRIPT), false, 'the script builds no file names');
assert.ok(references.inlineScripts.every(script => !scriptBuildsReferences(script)));
assert.ok(!PAGE_SCRIPT.includes('</script'), 'the script never closes its own tag');

// Nothing key-shaped in the page's own parts: with the fonts inlined, 2.2's scan stays quiet.
assert.deepEqual(scanText(html), []);

// The handout's Markdown: raw HTML is escaped; web links stay links; links to project files are plain names; a picture
// stays a relative path, a missing one its words, a web one a link (the page loads nothing from elsewhere).
{
  const render = (markdown: string, exercise = false) => handoutHtml(markdown, { partKey: 'k', exercise, pictureUrl });
  assert.equal(render('<script>alert("x")</script>\n\nText'), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>\n<p>Text</p>\n');
  assert.equal(render('<!-- only a note -->\n\nText'), '<p>Text</p>\n');
  assert.ok(!render('Hi <img src=x onerror=alert(1)> there').includes('<img'));
  assert.ok(render('a <span style="x">b</span>').includes('&lt;span style=&quot;x&quot;&gt;'));
  assert.equal(render('See [the guide](https://example.com/guide?a=1&b=2).'), '<p>See <a href="https://example.com/guide?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">the guide</a>.</p>\n');
  const local = render('Open [Exercise files A](../Shared/Exercise%20files%20A/) and [the brief](brief.md).');
  assert.ok(!local.includes('Shared') && !local.includes('brief.md') && !local.includes('href'), local);
  assert.deepEqual(parse(local).querySelectorAll('.file').map(file => file.text), ['Exercise files A', 'the brief']);
  assert.ok(!render('[x](javascript:alert(1)) [y](file:///etc/passwd) [z](vscode://x)').includes('href'));
  assert.equal(render('![A chart](images/which-stays.png)'), '<p><img src="images/which-stays.png" alt="A chart" loading="lazy"></p>\n');
  assert.equal(render('![Gone](images/missing.png)'), '<p><span class="nopic">Gone</span></p>\n');
  assert.ok(!render('![Far](https://example.com/a.png)').includes('<img'));
  assert.ok(!render('![](/Users/someone/a.png)').includes('Users'));
  // The deck view's private fences, if one reached here, still draw nothing; comments and marks go here too.
  assert.equal(render('```notes\nsecret\n```'), '');
  assert.equal(render('> ```notes\n> secret\n> ```'), '<blockquote>\n</blockquote>\n');
  assert.equal(render('a <mark data-comment="secret">word</mark> <!-- secret -->'), '<p>a word </p>\n');
  assert.equal(sanitizeHtml('<!-- x --><mark data-comment="n">w</mark><b>'), 'w&lt;b&gt;');
  // Headings sit under the part's own title.
  assert.equal(render('## Welcome'), '<h3>Welcome</h3>\n');
  // Ticks: a task list anywhere, and an exercise's numbered steps; a list elsewhere stays a list.
  assert.equal(parse(render('- [ ] one\n- [x] two')).querySelectorAll('ul.steps input[data-tick]').length, 2);
  assert.ok(parse(render('- [x] two')).querySelector('input')!.hasAttribute('checked'));
  assert.equal(parse(render('1. a\n2. b')).querySelectorAll('input').length, 0);
  assert.equal(parse(render('1. a\n2. b', true)).querySelectorAll('ol.steps input').length, 2);
  // The same step twice gets two ids; the same words give the same id again (a tick survives an update).
  const twice = parse(render('- [ ] same\n- [ ] same')).querySelectorAll('input').map(input => input.getAttribute('data-tick'));
  assert.notEqual(twice[0], twice[1]);
  assert.equal(parse(render('- [ ] same')).querySelector('input')!.getAttribute('data-tick'), twice[0]);
}

// A deck with nothing to show says so.
{
  const empty = pageHtml(publicDeck('```slide title\ntitle: Gone\nskip: true\n```\n', { folderName: 'F', deckName: 'Empty', theme: BUILT_IN_THEME }), assets, { digest, pictureUrl });
  assert.ok(empty.includes('This deck has no slides to show.'));
  assert.equal(parse(empty).querySelectorAll('.layer').length, 0);
}

// Paths as addresses: spaces and the like encoded once, an already-encoded path not twice, # and ? kept in the name.
assert.equal(encodePath('images/my picture.png'), 'images/my%20picture.png');
assert.equal(encodePath('images/my%20picture.png'), 'images/my%20picture.png');
assert.equal(encodePath('images/a#b?.png'), 'images/a%23b%3F.png');
assert.equal(encodePath('images/"q".png'), 'images/%22q%22.png');

console.log('pageHtml: passed');
