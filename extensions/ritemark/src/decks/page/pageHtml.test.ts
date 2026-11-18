/**
 * Sprint 159 (technical plan §6): the handout page's HTML. The same deck gives the same bytes; every shown slide and
 * section is there; every prompt has Copy and an exercise's steps have ticks; the page loads nothing from the web; the
 * gather finds only the pictures the shown slides use; the script builds no file names; and no private test word is
 * in the bytes.
 *
 * Run: npx tsx src/decks/page/pageHtml.test.ts
 */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { BUILT_IN_THEME } from '../deckTheme';
import { cssReferences, pageReferences, scriptBuildsReferences } from '../../publish/references';
import { scanText } from '../../publish/secretScan';
import { PAGE_FONTS } from './pageFile';
import { DIGEST_META, OPEN_IN_MAX_ADDRESS, PAGE_CSP, PAGE_CSS, handoutHtml, isSlideOnly, openInAddresses, pageHtml, pictureAddress, pictureFile, sanitizeHtml, type PageAssets, type PictureFrom } from './pageHtml';
import { PAGE_SCRIPT } from './pageScript';
import { deckDigest, publicDeck } from './publicDeck';
import { PRIVATE_DECK, PRIVATE_WORDS, PUBLIC_WORDS } from './testing/privateDeck';

const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};
const there = new Set(['images/which-stays.png']);
const pictureUrl = (picture: string, from: PictureFrom) => {
  const file = pictureFile(picture, from);
  return there.has(file) ? pictureAddress(file) : null;
};

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

// Sprint 163 PR 4: every shown slide is drawn once, in order, one at a time (the first one on), as the wall draws it;
// each has its part in More, and each is a slide to a screen reader, named by its number and title.
const layers = root.querySelectorAll('#frame > .layer');
assert.equal(layers.length, deck.slides.length);
assert.deepEqual(layers.map(layer => layer.getAttribute('aria-label')), ['Slide 1 of 5: Harbour title', 'Slide 2 of 5: Why agents?', 'Slide 3 of 5: Build an assistant for one task', 'Slide 4 of 5: Assistant or agent?', 'Slide 5 of 5: Read the room']);
assert.deepEqual(layers.map(layer => layer.getAttribute('id')), ['s1', 's2', 's3', 's4', 's5']);
assert.ok(layers.every(layer => layer.getAttribute('aria-roledescription') === 'slide'));
assert.deepEqual(layers.map(layer => layer.hasAttribute('aria-hidden')), [false, true, true, true, true], 'only the slide shown is read');
assert.ok(!layers.some(layer => layer.querySelector('.deck-sl[aria-hidden]')), 'the slide is the page\'s text, never hidden from a screen reader');
assert.equal(layers.filter(layer => layer.classList.contains('on')).length, 1);
assert.ok(layers[0].classList.contains('on'));
assert.ok(layers.every(layer => layer.querySelector('.deck-slide.is-borderless .deck-sl')), 'each layer holds the deck view\'s slide');
const parts = root.querySelectorAll('#side .part');
assert.deepEqual(parts.map(part => part.getAttribute('id')), ['t1', 't2', 't3', 't4', 't5']);
assert.deepEqual(parts.map(part => part.getAttribute('data-i')), ['0', '1', '2', '3', '4']);
assert.equal(root.querySelector('#pos')!.text, '1 / 5');

// A Section's text says "Section N" over its title.
const band = root.querySelector('#t2')!;
assert.ok(band.classList.contains('sect'));
assert.equal(band.querySelector('.eyebrow')!.text, 'Section 1');
assert.equal(band.querySelector('h2')!.text, 'Why agents?');

// Contents: every part by its title, the exercise marked, with a tick for when it is done.
const goers = root.querySelectorAll('#toc [data-go]');
assert.deepEqual(goers.map(button => button.querySelector('.n')!.text), ['1', '2', '3', '4', '5']);
assert.ok(root.querySelector('#toc')!.hasAttribute('hidden'));
assert.ok(goers[2].querySelector('.tag') && goers[2].querySelector('.done svg'));
assert.ok(goers[1].querySelector('.sec'), 'a section is bold in Contents');

// The text before the first slide is at the top of the first slide's text, as in the deck view's handout.
assert.equal(root.querySelector('#side > .pre[data-i="0"]')!.text.trim(), 'Before the first slide: PREAMBLEPUBLIC, for everyone.');

// Every prompt has Copy; the label before it is the prompt's label; an exercise's numbered steps have ticks.
const prompts = root.querySelectorAll('.prompt');
assert.equal(prompts.length, root.querySelectorAll('#side pre').length, 'every code block in the text is a prompt');
assert.equal(prompts.length, 2);
for (const prompt of prompts) assert.ok(prompt.querySelector('button.copy'), 'with Copy');
// Decks README item 10: Copy first, then Open in Claude and Open in ChatGPT, each a link to a new tab with the prompt's
// words in its address and nothing of this page sent with it.
for (const prompt of prompts) {
  assert.ok(prompt.classList.contains('ai'));
  assert.deepEqual(prompt.querySelectorAll('button, a').map(control => control.text), ['CopyCopied', 'Open in Claude', 'Open in ChatGPT']);
  const words = /<code>([\s\S]*?)<\/code>/.exec(prompt.toString())![1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const links = prompt.querySelectorAll('a.open');
  assert.deepEqual(links.map(link => link.getAttribute('target')), ['_blank', '_blank']);
  assert.deepEqual(links.map(link => link.getAttribute('rel')), ['noopener noreferrer', 'noopener noreferrer']);
  // The accessible name starts with the visible words (WCAG 2.5.3), so "click Open in Claude" finds it.
  assert.deepEqual(links.map(link => link.getAttribute('aria-label')), ['Open in Claude, in a new tab', 'Open in ChatGPT, in a new tab']);
  const hrefs = links.map(link => link.getAttribute('href')!.replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
  assert.deepEqual(hrefs, [`https://claude.ai/new?q=${encodeURIComponent(words)}`, `https://chatgpt.com/?q=${encodeURIComponent(words)}`]);
}
assert.equal(root.querySelector('#t3 .k')!.text, 'PROMPT');
const steps = root.querySelectorAll('#t3 ol.steps > li.step input[type="checkbox"][data-tick]');
assert.equal(steps.length, 2);
assert.notEqual(steps[0].getAttribute('data-tick'), steps[1].getAttribute('data-tick'));
assert.match(root.querySelector('body')!.getAttribute('data-store')!, /^ritemark-ticks-[0-9a-f]{12}$/);
// Small details 7: the reader's place is kept under the page's own name (the ticks' name), and "Start from the beginning"
// waits hidden for the script, over the line.
assert.equal(root.querySelector('body')!.getAttribute('data-place')!.replace('ritemark-place-', ''), root.querySelector('body')!.getAttribute('data-store')!.replace('ritemark-ticks-', ''));
const restart = root.querySelector('#restart')!;
assert.equal(restart.text, 'Start from the beginning');
assert.ok(restart.hasAttribute('hidden') && restart.getAttribute('type') === 'button');
// The notice is a pill over the quiet line, above the safe area, at every width.
{
  const pill = /\.toast, \.restart \{([^}]*)\}/.exec(PAGE_CSS)![1];
  for (const rule of ['position: fixed', 'left: 50%', 'transform: translateX(-50%)', 'bottom: calc(var(--line-h) + 12px + env(safe-area-inset-bottom, 0px))']) assert.ok(pill.includes(rule), rule);
}
// A prompt that shows a comment shows it as words.
assert.ok(html.includes('&lt;!-- a prompt that shows a comment stays as written --&gt;'));

// The page loads nothing from the web: its own references are its pictures, relative to it, and its CSS only data.
const references = pageReferences(html);
const loads = references.refs.filter(ref => ref.as !== 'link').map(ref => ref.value);
assert.deepEqual(loads, ['images/which-stays.png'], 'the gather finds the picture a shown part uses, and nothing else');
for (const css of references.inlineCss) {
  for (const ref of cssReferences(css)) assert.match(ref.value, /^data:font\/woff2;base64,/, `the CSS loads only its fonts, inline: ${ref.value.slice(0, 40)}`);
}
assert.ok(!/(?:src|href)="(?:https?:)?\/\//i.test(html
  .replace(/<a href="https:\/\/[^"]*" target="_blank" rel="noopener noreferrer">/g, '')
  .replace(/<a class="open" href="https:\/\/(?:claude\.ai\/new|chatgpt\.com\/)\?q=[^"]*" target="_blank" rel="noopener noreferrer"/g, '')), 'no remote address but the handout\'s own web links and the prompts\' Open in links');
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
  // A picture's words are escaped once: marked hands them over escaped, and twice would read "Q&amp;amp;A".
  assert.equal(render('![Q&A <b> "x"](images/which-stays.png)'), '<p><img src="images/which-stays.png" alt="Q&amp;A &lt;b&gt; &quot;x&quot;" loading="lazy"></p>\n');
  assert.equal(render('![Gone & lost](images/missing.png)'), '<p><span class="nopic">Gone &amp; lost</span></p>\n');
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
  // A list that only holds a task list inside one of its items stays a list (its bullets kept); the inner one ticks.
  {
    const nested = parse(render('- one\n  - [ ] sub\n- two'));
    assert.equal(nested.querySelector('ul')!.getAttribute('class'), undefined);
    assert.equal(nested.querySelectorAll('ul.steps').length, 1);
    assert.equal(nested.querySelectorAll('ul.steps > li.step').length, 1);
  }
  // The same step twice gets two ids; the same words give the same id again (a tick survives an update).
  const twice = parse(render('- [ ] same\n- [ ] same')).querySelectorAll('input').map(input => input.getAttribute('data-tick'));
  assert.notEqual(twice[0], twice[1]);
  assert.equal(parse(render('- [ ] same')).querySelector('input')!.getAttribute('data-tick'), twice[0]);
}

// A tick's id is the part's title and the step's words, not its place: a slide added before the exercise keeps its ticks.
{
  const ticks = (text: string) => parse(pageHtml(publicDeck(text, { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME }), assets, { digest, pictureUrl }))
    .querySelectorAll('input[data-tick]').map(input => input.getAttribute('data-tick'));
  const exercise = '```slide exercise\ntitle: Try it\n```\n\n1. First step\n2. Second step\n';
  const before = ticks(exercise);
  assert.equal(before.length, 2);
  assert.deepEqual(ticks('```slide title\ntitle: A new first slide\n```\n\n' + exercise), before);
  // Two exercises with one title and the same step keep their ticks apart (round 2), and so do the text before the
  // first slide and a slide titled like it.
  const twins = ticks('```slide exercise\ntitle: Your turn\n```\n\n1. Open the file\n\n```slide exercise\ntitle: Your turn\n```\n\n1. Open the file\n');
  assert.equal(twins.length, 2);
  assert.notEqual(twins[0], twins[1]);
  const preamble = ticks('- [ ] Open the file\n\n```slide points\ntitle: preamble\n```\n\n- [ ] Open the file\n');
  assert.equal(preamble.length, 2);
  assert.notEqual(preamble[0], preamble[1]);
}

// No handout text can open a tag on the page (the security review of PR 3). In marked's raw mode, after an inline
// <code>, <pre>, <kbd> or <script>, text went on unescaped, and a tag marked doesn't read as one (no space before its
// attribute) reached the page live: in the same paragraph, and in every later one.
{
  const render = (markdown: string) => handoutHtml(markdown, { partKey: 'k', exercise: true, pictureUrl });
  const payloads = ['<svg/onload=alert(1)>', '<img/src/onerror=alert(1)>', '<img/src="x"/onerror=alert(2)>'];
  for (const tag of ['code', 'pre', 'kbd', 'script', 'CODE', 'pre class="x"']) {
    for (const payload of payloads) {
      const places = [
        `See <${tag}> ${payload}`,
        `First <${tag}>x\n\nA later paragraph ${payload}`,
        `# Head <${tag}> ${payload}`,
        `- item <${tag}> ${payload}\n- next ${payload}`,
        `1. step <${tag}> ${payload}`,
        `| a | b |\n| - | - |\n| <${tag}> | ${payload} |`,
        `[link <${tag}> ${payload}](https://example.com)`,
        `> quote <${tag}> ${payload}`,
      ];
      for (const markdown of places) {
        const html = render(markdown);
        assert.ok(!/<(?:svg|img)\b[^>]*on\w+=/i.test(html) && !/<(?:svg|img)\//i.test(html), `${JSON.stringify(markdown)} gave ${html}`);
        assert.ok(!/<(?:code|pre|kbd|script)\b/i.test(html.replace(/<pre><code>[\s\S]*?<\/code><\/pre>/g, '')), `no raw tag: ${html}`);
      }
    }
  }
  // The words are still there, as words.
  assert.equal(render('See <code> <svg/onload=alert(1)>'), '<p>See &lt;code&gt; &lt;svg/onload=alert(1)&gt;</p>\n');
  // The whole page, from a deck that carries it.
  const deckText = '```slide title\ntitle: T\n```\n\nSee <code> <svg/onload=alert(document.domain)>\n\nLater <img/src/onerror=alert(1)>\n';
  const page = pageHtml(publicDeck(deckText, { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME }), assets, { digest, pictureUrl });
  assert.ok(!page.includes('<svg/') && !page.includes('<img/'), 'no live tag on the page');
  assert.deepEqual(pageReferences(page).refs.filter(ref => ref.as !== 'link'), [], 'and nothing the gather would send for it');
}

// The page's Content Security Policy: first in the head; its one script allowed by its exact hash, nothing else run or
// loaded from elsewhere.
{
  const head = html.slice(0, html.indexOf('<title>'));
  assert.ok(head.startsWith('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="'));
  const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)![1];
  assert.equal(policy, PAGE_CSP);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 1);
  const hash = createHash('sha256').update(scripts[0]).digest('base64');
  assert.ok(policy.includes(`script-src 'sha256-${hash}'`), 'the script is allowed by its own hash');
  for (const part of ["default-src 'none'", "style-src 'unsafe-inline'", "font-src 'self' data: file:", "img-src 'self' data: file:", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(policy.includes(part), part);
  }
  assert.ok(!/unsafe-eval|https?:|\*/.test(policy), 'nothing from elsewhere, no eval');
}

// A deck with nothing to show says so.
{
  const empty = pageHtml(publicDeck('```slide title\ntitle: Gone\nskip: true\n```\n', { folderName: 'F', deckName: 'Empty', theme: BUILT_IN_THEME }), assets, { digest, pictureUrl });
  assert.ok(empty.includes('This deck has no slides to show.'));
  assert.equal(parse(empty).querySelectorAll('.layer').length, 0);
}

// Pictures: a slide's image: line is a plain path, as the deck view reads it; a handout's picture is an address, its
// folders and name decoded (%26 and %23 too) and its query cut; on the page each part is encoded once.
assert.equal(pictureFile('images/Q%26A.png', 'handout'), 'images/Q&A.png');
assert.equal(pictureFile('images/a%23b.png?v=2#top', 'handout'), 'images/a#b.png');
assert.equal(pictureFile('images/my picture.png', 'handout'), 'images/my picture.png');
assert.equal(pictureFile('images/50%off.png', 'handout'), 'images/50%off.png', 'a stray % stays');
assert.equal(pictureFile('images/Q%26A.png', 'slide'), 'images/Q%26A.png');
// As a browser reads the address: %2E%2E is .., but an encoded separator never becomes one (round 2).
assert.equal(pictureFile('%2E%2E/shared/x.png', 'handout'), '../shared/x.png');
assert.equal(pictureFile('images/a%2Fb.png', 'handout'), 'images/a%2Fb.png');
assert.equal(pictureFile('images/a%5Cb.png', 'handout'), 'images/a%5Cb.png');
// A slide's path as the deck view reads it: a backslash separates folders on Windows only.
assert.equal(pictureFile('pics\\a.png', 'slide', 'darwin'), 'pics\\a.png');
assert.equal(pictureFile('pics\\a.png', 'slide', 'win32'), 'pics/a.png');
assert.equal(pictureAddress('images/Q&A.png'), 'images/Q%26A.png');
assert.equal(pictureAddress('images/a#b?.png'), 'images/a%23b%3F.png');
assert.equal(pictureAddress('images/my picture.png'), 'images/my%20picture.png');
assert.equal(pictureAddress('../shared/"q".png'), '../shared/%22q%22.png');
assert.equal(pictureAddress(pictureFile('images/a%2523.png', 'handout')), 'images/a%2523.png', 'never encoded twice');

// 16 November: the handout is a Text document. A part's own opening heading is its heading on the page; a part not yet
// written (no heading of its own, every part of an older deck) shows the heading the deck view draws, its slide's title,
// an H1 for a section as an H2 for any other kind in the editor, and the page's own h2 for both. Contents keeps
// listing the slides' titles.
{
  const text = [
    '```slide title', 'id: t0a1', 'title: AI assistants and agents', '```', '',
    '## Welcome to the day', '', 'Everything you need today.', '',
    '```slide section', 'id: s001', 'title: Why agents?', 'number: "1"', '```', '',
    'Unwritten part.', '',
    '```slide points', 'id: p001', 'title: Agents act', '```', '',
    '## Agents, in short', '', '### Smaller', '', 'Words.', '',
  ].join('\n');
  const headed = publicDeck(text, { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  const page = parse(pageHtml(headed, assets, { digest: deckDigest(headed), pictureUrl }));
  const parts = page.querySelectorAll('.part');
  assert.deepEqual(parts.map(part => part.querySelectorAll('h2').map(h2 => h2.text)), [['Welcome to the day'], ['Why agents?'], ['Agents, in short']], "each part's heading as the editor shows it");
  assert.ok(parts[1].querySelector('.eyebrow'), "a section keeps the page's own band");
  assert.deepEqual(parts[2].querySelectorAll('h4').map(h4 => h4.text), ['Smaller'], "the handout's other headings sit under it");
  const contents = page.querySelectorAll('[data-go]').map(row => row.text);
  assert.ok(contents.some(row => row.includes('AI assistants and agents')) && contents.some(row => row.includes('Agents act')), "Contents lists the slides' titles");
  assert.ok(!contents.some(row => row.includes('Welcome to the day')));
  // An older deck (no part headings) is the page it was: the slides' titles as the parts' headings, the digest the same.
  const older = text.replace('## Welcome to the day\n\n', '').replace('## Agents, in short\n\n', '');
  const olderDeck = publicDeck(older, { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  const olderPage = parse(pageHtml(olderDeck, assets, { digest: deckDigest(olderDeck), pictureUrl }));
  assert.deepEqual(olderPage.querySelectorAll('.part').map(part => part.querySelectorAll('h2').map(h2 => h2.text)), [['AI assistants and agents'], ['Why agents?'], ['Agents act']]);
}


// A deck marked `handout: text`: a part without a heading of its own shows none (a heading the person deleted stays
// deleted on the page too), and the mark, like all of the front matter, never reaches the page.
{
  const text = [
    '---', 'deck: 1', 'theme: Slide library/Themes/Evening.theme.md', 'handout: text', '---', '',
    '```slide title', 'id: t0a1', 'title: AI assistants and agents', '```', '', '## Welcome', '', 'Words.', '',
    '```slide points', 'id: p001', 'title: Agents act', '```', '', 'Heading deleted, words kept.', '',
  ].join('\n');
  const marked = publicDeck(text, { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  assert.equal(marked.textHandout, true);
  const bytes = pageHtml(marked, assets, { digest: deckDigest(marked), pictureUrl });
  const page = parse(bytes);
  assert.deepEqual(page.querySelectorAll('.part').map(part => part.querySelectorAll('h2').map(h2 => h2.text)), [['Welcome'], []]);
  assert.ok(page.querySelectorAll('[data-go]').some(row => row.text.includes('Agents act')), "Contents still lists the slide's title");
  assert.ok(!/handout:\s*text|handout: |Evening\.theme\.md/.test(bytes), 'privacy: no line of the front matter reaches the page');
  // Without the mark the same deck is the page it was: the slide's title as the part's heading.
  const unmarked = publicDeck(text.replace('handout: text\n', ''), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  assert.equal(unmarked.textHandout, undefined, 'and the digest of an unmarked deck is as it was');
  assert.deepEqual(parse(pageHtml(unmarked, assets, { digest: deckDigest(unmarked), pictureUrl })).querySelectorAll('.part').map(part => part.querySelectorAll('h2').map(h2 => h2.text)), [['Welcome'], ['Agents act']]);
}


// Decks README item 10: the prompts' Open in addresses.
{
  // Special characters, line breaks and Estonian letters, encoded so the box gets the words exactly.
  const prompt = 'Tere! Kirjuta õpetajale & õpilastele: "Mis on äri?"\nRida kaks: 50% #1 ?q=x / šokolaad, Žürii, ÕÄÖÜ.';
  const links = openInAddresses(prompt);
  assert.deepEqual(links.map(link => link.label), ['Claude', 'ChatGPT']);
  assert.equal(links[0].href, 'https://claude.ai/new?q=Tere!%20Kirjuta%20%C3%B5petajale%20%26%20%C3%B5pilastele%3A%20%22Mis%20on%20%C3%A4ri%3F%22%0ARida%20kaks%3A%2050%25%20%231%20%3Fq%3Dx%20%2F%20%C5%A1okolaad%2C%20%C5%BD%C3%BCrii%2C%20%C3%95%C3%84%C3%96%C3%9C.');
  assert.equal(links[1].href, 'https://chatgpt.com/?q=' + links[0].href.slice('https://claude.ai/new?q='.length));
  for (const link of links) {
    const address = new URL(link.href);
    assert.equal(address.searchParams.get('q'), prompt, 'the host reads back the prompt exactly');
    assert.equal([...address.searchParams.keys()].join(), 'q', 'one parameter: a & or # in the prompt starts no other');
    assert.equal(address.hash, '');
  }
  // Drawn on the page: the address in the attribute, escaped as HTML, and the box's words as written.
  const drawn = parse(handoutHtml('```\n' + prompt + '\n```\n', { partKey: 'k', exercise: false, pictureUrl }));
  assert.deepEqual(drawn.querySelectorAll('a.open').map(link => link.getAttribute('href')!.replace(/&amp;/g, '&').replace(/&#39;/g, "'")), links.map(link => link.href));
  // An apostrophe stays unencoded by encodeURIComponent, and is escaped in the attribute, so it never closes it.
  const quoted = handoutHtml("```\nDon't send it\n```\n", { partKey: 'k', exercise: false, pictureUrl });
  assert.ok(quoted.includes('href="https://claude.ai/new?q=Don&#39;t%20send%20it"'));

  // The length cap: an address of OPEN_IN_MAX_ADDRESS characters is kept; one character more, and both go, Copy stays.
  const claudeBase = 'https://claude.ai/new?q='.length;
  assert.equal(openInAddresses('a'.repeat(OPEN_IN_MAX_ADDRESS - claudeBase)).length, 2);
  assert.equal(openInAddresses('a'.repeat(OPEN_IN_MAX_ADDRESS - claudeBase + 1)).length, 0);
  // The cap counts the encoded address: 2,000 Estonian letters are 12,000 characters encoded.
  assert.equal(openInAddresses('õ'.repeat(2000)).length, 0);
  const long = parse(handoutHtml('```\n' + 'õ'.repeat(2000) + '\n```\n', { partKey: 'k', exercise: false, pictureUrl }));
  assert.ok(long.querySelector('.prompt button.copy'), 'a long prompt keeps Copy');
  assert.equal(long.querySelectorAll('a.open').length, 0, 'and has no Open in links');
  assert.ok(!long.querySelector('.prompt')!.classList.contains('ai'), 'and is drawn as before, Copy in its corner');
  // A prompt that can't be encoded (a lone surrogate), and an empty one, keep Copy only.
  assert.equal(openInAddresses('broken \uD800 text').length, 0);
  assert.equal(parse(handoutHtml('```\n\n```\n', { partKey: 'k', exercise: false, pictureUrl })).querySelectorAll('a.open').length, 0);
  // The handout's own builder with them off (a deck's `open-in: none`).
  assert.equal(parse(handoutHtml('```\nHello\n```\n', { partKey: 'k', exercise: false, pictureUrl, openIn: false })).querySelectorAll('a.open').length, 0);
}

// A deck's `open-in: none` turns them off on every prompt, the preamble's too; Copy stays, and the line itself, like all
// of the front matter, never reaches the page.
{
  const text = (front: string) => [
    '---', 'deck: 1', ...(front ? [front] : []), '---', '',
    'Before the first slide.', '', '```', 'A prompt before the slides', '```', '',
    '```slide title', 'id: t0a1', 'title: AI assistants and agents', '```', '', '## Welcome', '', '```', 'Help me write instructions.', '```', '',
  ].join('\n');
  for (const front of ['open-in: none', 'open-in: "none"', 'open-in:  none  ']) {
    const off = publicDeck(text(front), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
    assert.equal(off.openInOff, true, front);
    const bytes = pageHtml(off, assets, { digest: deckDigest(off), pictureUrl });
    const page = parse(bytes);
    assert.equal(page.querySelectorAll('.prompt').length, 2);
    assert.equal(page.querySelectorAll('.prompt button.copy').length, 2, 'Copy stays');
    assert.equal(page.querySelectorAll('a.open').length, 0, `${front}: no Open in links`);
    assert.ok(!/claude\.ai|chatgpt\.com|open-in/.test(bytes), 'neither address, nor the line, is on the page');
  }
  // Without the line, or with any other value, both prompts have them, and the deck's digest is as it was.
  // Read as `handout: text` is read: exactly `none` (quoted or padded), so `None` is not it.
  for (const front of ['', 'open-in: all', 'open-in:', 'open-in: None']) {
    const on = publicDeck(text(front), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
    assert.equal(on.openInOff, undefined, front);
    assert.equal(parse(pageHtml(on, assets, { digest: deckDigest(on), pictureUrl })).querySelectorAll('a.open').length, 4, front);
  }
  const plain = publicDeck(text(''), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  assert.equal(deckDigest(publicDeck(text('open-in: all'), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME })), deckDigest(plain));
  assert.notEqual(deckDigest(publicDeck(text('open-in: none'), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME })), deckDigest(plain), 'turning them off is a new page');
}

// A slide with no handout (17 November): a part with no heading and no text. The viewer sees nothing of it in the text,
// no row, no title, no Contents entry; the slide keeps its place in the slide order (its layer, its place in the
// text's order), so the arrows step through it and scrolling past the gap between its neighbours brings it up.
{
  const text = [
    '---', 'deck: 1', 'theme: Slide library/Themes/Evening.theme.md', 'handout: text', '---', '',
    '```slide title', 'id: t0a1', 'title: AI assistants and agents', '```', '', '## Welcome', '', 'Words.', '',
    '```slide points', 'id: p001', 'title: Copilot or Cursor?', '```', '', '##', '', '<!-- a comment -->', '',
    '```slide points', 'id: p002', 'title: Agents act', '```', '', 'Words after.', '',
    '```slide points', 'id: p003', 'title: A picture only', '```', '', '![](images/which-stays.png)', '',
  ].join('\n');
  const deckOnly = publicDeck(text, { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  assert.equal(isSlideOnly(deckOnly.slides[1], true), true, 'an emptied part: an empty heading and a comment');
  assert.equal(isSlideOnly(deckOnly.slides[0], true), false);
  assert.equal(isSlideOnly(deckOnly.slides[3], true), false, 'a picture is something to see');
  const bytes = pageHtml(deckOnly, assets, { digest: deckDigest(deckOnly), pictureUrl });
  const page = parse(bytes);
  assert.equal(page.querySelectorAll('#frame > .layer').length, 4, 'the slide stays in the deck');
  assert.equal(page.querySelectorAll('#frame > .layer')[1].getAttribute('aria-label'), 'Slide 2 of 4: Copilot or Cursor?');
  const parts = page.querySelectorAll('.part[data-i]');
  assert.deepEqual(parts.map(part => part.getAttribute('data-i')), ['0', '1', '2', '3'], "every slide keeps its place in the text's order");
  const only = parts[1];
  assert.ok(only.classList.contains('only') && only.getAttribute('aria-hidden') === 'true' && only.innerHTML === '', 'its place only, with nothing in it');
  assert.ok(!page.querySelector('#side')!.text.includes('Copilot or Cursor?'), 'no title in the text');
  // Sprint 163 PR 4: one slide at a time, so Contents lists every slide; More isn't offered on one with no text, and
  // print shows its slide alone.
  assert.deepEqual(page.querySelectorAll('[data-go]').map(row => row.getAttribute('data-go')), ['0', '1', '2', '3'], 'every slide in Contents');
  assert.ok(PAGE_SCRIPT.includes("return (!!part && !part.classList.contains('only'))"), 'More only where there is text');
  assert.ok(/\.side > \.part\.only \{ display: none; \}/.test(bytes), 'nothing of it printed but its slide');
  // A deck written before 16 November shows a part's slide title as its heading, so an empty part is no slide-only one;
  // a slide with no title and no handout shows nothing either way.
  const older = publicDeck(text.replace('handout: text\n', '').replace('##\n\n', ''), { folderName: 'Harbour Logistics', deckName: 'Deck', theme: BUILT_IN_THEME });
  assert.equal(isSlideOnly(older.slides[1], false), false, 'an old deck: the title is its heading');
  assert.equal(isSlideOnly({ handout: '', data: { title: '' } }, false), true);
  const olderPage = parse(pageHtml(older, assets, { digest: deckDigest(older), pictureUrl }));
  assert.deepEqual(olderPage.querySelectorAll('.part').map(part => part.querySelectorAll('h2').map(h2 => h2.text))[1], ['Copilot or Cursor?']);
  assert.equal(olderPage.querySelectorAll('[data-go]').length, 4);
  // A wide table's own scrollbar is its thumb only, with no track behind it (Jarmo's rule for every scrollbar).
  assert.ok(/\.tw \{ overflow-x: auto;[^}]*scrollbar-color: [^;]+ transparent;[^}]*\}/.test(bytes), 'no scrollbar track');
}

// A wide table keeps sensible column widths (the Experience lead on #780), by the deck view's own rule
// (`tableColumns.ts`): a text column keeps about 200 px, or its stored share when larger, never more than its longest
// note on one line; a number column has no floor, so it keeps only its widest word. On the page the floor is a spacer
// at the end of the column's header cell, which every browser keeps (Safari and Firefox ignore a <col>'s min-width).
{
  const table = (delimiter: string, note = 'Most replies needed **one edit** before [sending](https://example.org/a-very-long-address)') => handoutHtml([
    '| Mail drafted | Hours saved | Notes from the pilot week |',
    delimiter,
    `| 412 | 31 | ${note} |`,
    '| 268 | 1 200 | Fine |',
  ].join('\n'), { partKey: 't', exercise: false, pictureUrl });
  const spacers = (html: string) => parse(html).querySelectorAll('.tw > table > thead th').map(th => th.querySelector('i.fl')?.getAttribute('style') ?? '');
  const automatic = table('| --- | --- | --- |');
  // The note's words as read, without its marks or the link's address: "Most replies needed one edit before sending".
  assert.deepEqual(spacers(automatic), ['', '', 'width:calc(min(200px, calc(43ch + 2em)) - 20px)'], 'numbers: no floor; the note: 200 px');
  assert.equal(parse(automatic).querySelectorAll('th')[2].text, 'Notes from the pilot week', 'the header reads as before');
  assert.ok(!automatic.includes('<colgroup>') && automatic.includes('<div class="tw"><table>\n<thead>'), 'an automatic table is drawn as before');
  // The cells' words as the editor reads them: a character reference is one character, as the editor's textContent.
  assert.deepEqual(spacers(table('| --- | --- | --- |', 'Q&A "quoted" sessions here')), ['', '', 'width:calc(min(200px, calc(26ch + 2em)) - 20px)']);
  // Stored widths (#772's form, 16 + 16 + 48 dashes: 20 %, 20 %, 60 %): drawn as the handout draws them, at the text's
  // width with those shares, and the note keeps its share of the frame when that is larger than 200 px.
  const stored = table(`|${'-'.repeat(16)}|${'-'.repeat(16)}|${'-'.repeat(48)}|`);
  assert.deepEqual(spacers(stored), ['', '', 'width:calc(min(max(200px, 60cqw), calc(43ch + 2em)) - 20px)'], 'the stored share wins when larger');
  assert.deepEqual(parse(stored).querySelectorAll('.tw > table.has-widths > colgroup > col').map(col => col.getAttribute('style')), ['width:20%', 'width:20%', 'width:60%']);
  assert.ok(stored.includes('<table class="has-widths" style="width:100%">'));
  // A table of numbers and single words has no floor at all: every column keeps its widest word.
  assert.ok(!handoutHtml('| A | B |\n| --- | --- |\n| 1 | Yes |\n', { partKey: 't', exercise: false, pictureUrl }).includes('class="fl"'));
  // The spacer has a width and no height; the frame the share counts against is the table's own scrolling frame; and a
  // step's words take the step's width, so a table in a step has room (a query container takes no width from inside).
  assert.ok(/\.tw \.fl \{ display: block; height: 0; \}/.test(html), 'the spacer has no height');
  assert.ok(/\.tw \{ overflow-x: auto;[^}]*container-type: inline-size;[^}]*\}/.test(html), 'the frame is the query container');
  // A wide table's soft edge (the Experience lead on #781): a 24 px mask on the side with more to scroll to, chosen by
  // the classes the page's script sets, prefixed for older browsers, the scrollbar kept whole, and nothing that moves.
  const fade = /\.tw\.is-scrollable-left, \.tw\.is-scrollable-right \{([^}]*)\}/.exec(html)?.[1] ?? '';
  const gradient = 'linear-gradient(to right, var(--fade-l), #000 24px, #000 calc(100% - 24px), var(--fade-r)), linear-gradient(#000 0 0) bottom / 100% var(--rm-fade-bar, 0px) no-repeat;';
  assert.ok(fade.includes(`-webkit-mask: ${gradient}`) && fade.includes(` mask: ${gradient}`), 'the frame fades its content');
  assert.ok(/\.tw\.is-scrollable-left \{ --fade-l: transparent; \}/.test(html) && /\.tw\.is-scrollable-right \{ --fade-r: transparent; \}/.test(html), 'each side by its own class');
  assert.ok(!/\.tw[^{]*\{[^}]*(transition|animation)/.test(html), 'the fade appears and goes with no animation');
  assert.ok(/\.steps label > span \{ min-width: 0; flex: 1 1 auto; \}/.test(html), "a step's words take its width");
}


console.log('pageHtml: passed');
