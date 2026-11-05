/**
 * Tests for gather.ts (Sprint 149, R3, S7–S13): what goes up, what is left out and why, over A3's corpus.
 *
 * A3's ten pages live in private repos, so each is rebuilt here as a page with the same references (`research/
 * gather-corpus.md`, *The pages*), in a real temp project with real folders, symlinks and a real Git repository.
 * Then the boundary and exclusion cases of S8–S13 one by one, each failing without its rule.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { contentHashOf, gatherPage, kindOf } from './gather';
import { GitCheckError, gitIgnored } from './gitIgnore';
import { relTokens, srcsetUrls } from './references';
import type { LeftOutReason, PublishPlan } from './types';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-gather-')));
const project = path.join(root, 'Leadership programme');
const outside = path.join(root, 'secrets');

function write(rel: string, content: string | Buffer = 'x'): string {
  const file = path.join(project, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function goes(plan: PublishPlan): string[] {
  return plan.files.map((f) => f.relPath);
}
function left(plan: PublishPlan): [string, LeftOutReason][] {
  return plan.leftOut.map((l) => [l.display, l.reason]);
}
function reasonOf(plan: PublishPlan, display: string): LeftOutReason | undefined {
  return plan.leftOut.find((l) => l.display === display)?.reason;
}

/** A3's pages, gathered: each must hold nothing that looks like a key (review of #669, minor 3: clean pages stay clean). */
const corpusPlans: [string, PublishPlan][] = [];

async function gather(rel: string, html: string): Promise<PublishPlan> {
  const page = write(rel, html);
  return gatherPage(page, project);
}

/** One of A3's pages: gathered as any page, and kept for the check that their scans are quiet. */
async function corpus(rel: string, html: string): Promise<PublishPlan> {
  const plan = await gather(rel, html);
  corpusPlans.push([path.basename(rel), plan]);
  return plan;
}

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  for (const f of ['scan.png', 'b.png', 'c.png']) fs.writeFileSync(path.join(outside, f), 'secret picture');
  execFileSync('git', ['init', '-q'], { cwd: project });
  write('.gitignore', 'build/\n*.local.css\n');

  // ---------- A3's corpus ----------

  await check('P1: a single-file board with Google Fonts and script-built content', async () => {
    const plan = await corpus('boards/P1 planning board.html', `<!doctype html><link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Sofia+Sans&display=swap" rel="stylesheet">
<div id="board"></div><script>
const rows = data.map((r) => '<div class="row">' + r.name + '</div>');
document.getElementById('board').innerHTML = rows.join('') + '<img src="' + logo + '">';
const card = document.createElement('img');
</script>`);
    assert.deepEqual(goes(plan), ['P1 planning board.html'], 'nothing local goes; Google Fonts stay remote');
    assert.deepEqual(left(plan), []);
    assert.equal(plan.scriptBuilt, true, 'it builds content in its script');
  });

  await check('P2: pictures named by template strings in src and srcset', async () => {
    write('heroes/img/slide-a.webp', 'webp');
    const plan = await corpus('heroes/P2 hero options.html', `<link href="https://fonts.googleapis.com/css2?family=Montserrat" rel="stylesheet">
<div id="o"></div><script>
for (const key of ['a','b']) {
  o.insertAdjacentHTML('beforeend', \`<img src="img/slide-\${key}.webp" srcset="img/slide-\${key}@2x.webp 2x">\`);
}
</script>`);
    assert.deepEqual(goes(plan), ['P2 hero options.html'], "the gather can't see script-built pictures and doesn't guess");
    assert.equal(plan.scriptBuilt, true, 'so the sheet says so (A3, finding 2)');
  });

  await check('P3: an API reference linking to a page in a sibling folder by ../', async () => {
    write('demo/dashboard/index.html', '<h1>dash</h1>');
    const plan = await corpus('demo/api/P3 api.html', '<a href="../dashboard/index.html">Dashboard</a><a href="#auth">Auth</a>');
    assert.deepEqual(goes(plan), ['P3 api.html']);
    assert.deepEqual(left(plan), [['demo/dashboard/index.html', 'otherPage']], 'S13: another page, its link named');
    assert.equal(plan.scriptBuilt, false);
  });

  await check('P4: a dashboard with inline SVG and url(#fragment) only', async () => {
    const plan = await corpus('demo/P4 dashboard.html', `<svg><defs><linearGradient id="grad"/></defs><rect fill="url(#grad)"/><use href="#bar"/></svg>
<style>.a { fill: url(#grad); }</style>`);
    assert.deepEqual(goes(plan), ['P4 dashboard.html']);
    assert.deepEqual(left(plan), []);
    assert.equal(plan.scriptBuilt, false);
  });

  await check('P5: a users dashboard; GitHub links; one link built from data', async () => {
    const plan = await corpus('demo/P5 users.html', `<a href="https://github.com/ProductoryHQ">GitHub</a>
<table id="t"></table><script>t.innerHTML = users.map(u => \`<tr><td><a href="\${u.url}">\${u.name}</a></td></tr>\`).join('');</script>`);
    assert.deepEqual(goes(plan), ['P5 users.html']);
    assert.equal(plan.scriptBuilt, true);
  });

  await check('P6: a before/after page with 39 pictures in two folders', async () => {
    const imgs: string[] = [];
    for (let i = 1; i <= 20; i++) imgs.push(`before/shot-${i}.png`);
    for (let i = 1; i <= 19; i++) imgs.push(`after-${i}.png`);
    for (const img of imgs) write(`compare/${img}`, `png ${img}`);
    const plan = await corpus('compare/P6 before and after.html', imgs.map((i) => `<img src="${i}" alt="">`).join('\n'));
    assert.equal(plan.files.length, 40, 'the page and its 39 pictures');
    assert.deepEqual(goes(plan).slice(1), imgs, 'in the order the page uses them, the page first');
    assert.ok(plan.files.slice(1).every((f) => f.kind === 'picture'));
    assert.equal(plan.root, path.join(project, 'compare'));
  });

  await check('P7: a slide index using ../tokens.css (inside the project) that @imports Google Fonts; 7 sibling slides', async () => {
    write('design/tokens.css', "@import url('https://fonts.googleapis.com/css2?family=Sofia+Sans');\n:root { --ink: #222; }");
    const links: string[] = [];
    for (let i = 1; i <= 7; i++) {
      write(`design/slides/slide-${i}.html`, `<h1>${i}</h1>`);
      links.push(`<a href="slide-${i}.html">Slide ${i}</a>`);
    }
    const plan = await corpus('design/slides/P7 index.html', `<link rel="stylesheet" href="../tokens.css">${links.join('')}`);
    assert.deepEqual(goes(plan), ['slides/P7 index.html', 'tokens.css'], 'A3 finding 1: ../ inside the project goes up');
    assert.equal(plan.root, path.join(project, 'design'), 'the tree is rooted where the page and its files meet');
    assert.equal(plan.leftOut.filter((l) => l.reason === 'otherPage').length, 7);
  });

  await check('P8: a design-system preview, ../tokens.css and 3 sibling pages', async () => {
    for (const n of ['colours', 'type', 'space']) write(`design/preview/${n}.html`, n);
    const plan = await corpus('design/preview/P8 preview.html', `<link rel="stylesheet" href="../tokens.css"><nav><a href="colours.html">C</a><a href="type.html">T</a><a href="space.html">S</a></nav>`);
    assert.deepEqual(goes(plan), ['preview/P8 preview.html', 'tokens.css']);
    assert.equal(plan.leftOut.length, 3);
  });

  await check('P9: an interactive prototype that builds in script', async () => {
    const plan = await corpus('proto/P9 prototype.html', `<link href="https://fonts.googleapis.com/css2?family=Sofia+Sans" rel="stylesheet"><main></main>
<script>const el = document.createElement('img'); el.src = 'shots/' + step + '.png'; main.append(el);</script>`);
    assert.deepEqual(goes(plan), ['P9 prototype.html']);
    assert.equal(plan.scriptBuilt, true);
  });

  await check('P10: a foundation drawing, nothing local', async () => {
    const plan = await corpus('proto/P10 foundation.html', `<link href="https://fonts.googleapis.com/css2?family=Sofia+Sans" rel="stylesheet"><svg viewBox="0 0 10 10"><circle r="4"/></svg>`);
    assert.deepEqual(goes(plan), ['P10 foundation.html']);
    assert.equal(plan.scriptBuilt, false);
  });

  await check("H: the spike's hostile.html; file:// only in fetch, a CDN script", async () => {
    const plan = await corpus('spike/hostile.html', `<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
<script>fetch('file:///etc/hostname').then(r => r.text()); fetch('file:///etc/hosts'); try { acquireVsCodeApi(); } catch {} window.open('https://example.com');</script>`);
    assert.deepEqual(goes(plan), ['hostile.html'], 'S12: the CDN script stays remote; fetch is never followed');
    assert.deepEqual(left(plan), []);
    assert.equal(plan.scriptBuilt, true);
  });

  await check("A3's corpus holds nothing key-shaped: every page's scan is quiet", () => {
    assert.equal(corpusPlans.length, 11);
    for (const [name, plan] of corpusPlans) assert.deepEqual(plan.keyHits, [], `${name}: ${JSON.stringify(plan.keyHits)}`);
  });

  // ---------- S7: what goes ----------

  await check('S7: two pictures, a stylesheet and its font: "This page and 4 files"', async () => {
    write('harbour/img/a.png', 'a');
    write('harbour/img/b.png', 'b');
    write('harbour/fonts/x.woff2', 'font');
    write('harbour/style.css', "@font-face { font-family: X; src: url('fonts/x.woff2') format('woff2'); }");
    const plan = await gather('harbour/Harbour programme.html', `<link rel="stylesheet" href="style.css"><img src="img/a.png"><img src="img/b.png">`);
    assert.deepEqual(goes(plan), ['Harbour programme.html', 'style.css', 'img/a.png', 'img/b.png', 'fonts/x.woff2']);
    assert.deepEqual(plan.files.map((f) => f.kind), ['page', 'style', 'picture', 'picture', 'font']);
    assert.ok(plan.files.every((f) => f.sha256 && f.sha256.length === 64));
    assert.deepEqual(plan.files.map((f) => f.projectPath)[1], 'harbour/style.css');
  });

  await check('srcset, poster, CSS url() in <style> and style="", <object data>, video <source>, SVG <image>', async () => {
    for (const f of ['m/small.jpg', 'm/large.jpg', 'm/poster.jpg', 'm/bg.png', 'm/inline.png', 'm/doc.pdf', 'm/clip.mp4', 'm/sprite.svg', 'm/pic.png']) write(`media/${f}`, f);
    const plan = await gather('media/media.html', `<img srcset="m/small.jpg 480w, m/large.jpg 1080w" src="m/small.jpg">
<video poster="m/poster.jpg"><source src="m/clip.mp4" type="video/mp4"></video>
<style>body { background: url("m/bg.png") }</style><div style="background-image:url(m/inline.png)"></div>
<object data="m/doc.pdf"></object><svg><image xlink:href="m/pic.png"/><use href="m/sprite.svg#i"/></svg>`);
    assert.deepEqual(goes(plan).slice(1).sort(), ['m/bg.png', 'm/clip.mp4', 'm/doc.pdf', 'm/inline.png', 'm/large.jpg', 'm/pic.png', 'm/poster.jpg', 'm/small.jpg', 'm/sprite.svg']);
  });

  await check('module scripts: static imports followed, bare specifiers not files', async () => {
    write('app/js/main.js', "import { a } from './lib/a.js';\nimport React from 'react';\nexport * from '../shared/b.js';");
    write('app/js/lib/a.js', "export const a = 1;");
    write('app/shared/b.js', "export const b = 2;");
    write('app/js/inline-dep.js', 'export default 3;');
    const plan = await gather('app/index.html', `<script type="module" src="js/main.js"></script><script type="module">import d from './js/inline-dep.js';</script>`);
    assert.deepEqual(goes(plan).slice(1).sort(), ['js/inline-dep.js', 'js/lib/a.js', 'js/main.js', 'shared/b.js']);
  });

  await check('<base href> moves every relative reference', async () => {
    write('based/assets/logo.png', 'logo');
    const plan = await gather('based/page.html', '<base href="assets/"><img src="logo.png">');
    assert.deepEqual(goes(plan), ['page.html', 'assets/logo.png']);
    const remote = await gather('based/remote.html', '<base href="https://example.com/"><img src="assets/logo.png">');
    assert.deepEqual(goes(remote), ['remote.html'], 'a remote base makes every relative reference remote');
  });

  await check("R3: a link to a document is 'a linked file, so its link won't work'; a stylesheet or icon <link> still goes", async () => {
    write('links/notes.md', '# notes');
    write('links/budget.xlsx', 'xlsx');
    write('links/report.pdf', 'pdf');
    write('links/style.css', 'body { color: #222 }');
    write('links/favicon.png', 'ico');
    write('links/touch.png', 'touch');
    write('links/feed.xml', 'rss');
    write('links/map.png', 'map');
    const plan = await gather('links/page.html', [
      '<link rel="stylesheet" href="style.css"><link rel="icon" href="favicon.png"><link rel="apple-touch-icon" href="touch.png">',
      '<link rel="alternate" type="application/rss+xml" href="feed.xml">',
      '<a href="notes.md">Notes</a><a href="budget.xlsx">Budget</a>',
      '<map><area href="report.pdf" shape="rect" coords="0,0,1,1"></map><svg><a href="notes.md"><text>n</text></a></svg>',
      '<a href="map.png">See the map</a><img src="map.png" alt="">',
    ].join('\n'));
    assert.deepEqual(goes(plan), ['page.html', 'style.css', 'favicon.png', 'touch.png', 'map.png'], 'what the page uses goes; a picture it both shows and links goes');
    assert.deepEqual(left(plan).sort(), [['links/budget.xlsx', 'link'], ['links/feed.xml', 'link'], ['links/notes.md', 'link'], ['links/report.pdf', 'link']]);
  });

  await check('round 3: a prefetch or dns-prefetch <link> is a link, not a file the page uses; rel is read word by word', async () => {
    write('hints/pre.md', '# pre');
    write('hints/next.md', '# next');
    write('hints/dns.md', '# dns');
    write('hints/style.css', 'p { margin: 0 }');
    write('hints/fav.png', 'ico');
    const plan = await gather('hints/page.html', [
      '<link rel="prefetch" href="pre.md">',
      '<link rel="next prefetch" href="next.md">',
      '<link rel="dns-prefetch" href="dns.md">',
      '<link rel="Alternate  Stylesheet" href="style.css"><link rel="shortcut icon" href="fav.png">',
    ].join('\n'));
    assert.deepEqual(goes(plan), ['page.html', 'style.css', 'fav.png'], 'a stylesheet and an icon still go, whatever else rel says');
    assert.deepEqual(left(plan).sort(), [['hints/dns.md', 'link'], ['hints/next.md', 'link'], ['hints/pre.md', 'link']]);
    assert.deepEqual([...relTokens(' Shortcut\tICON ')], ['shortcut', 'icon'], 'rel splits on whitespace and lower-cases');
    assert.deepEqual([...relTokens('dns-prefetch')], ['dns-prefetch'], 'a hyphenated word stays one word, so no shorter word matches inside it');
  });

  await check('a link that comes before the picture it links never keeps the picture back', async () => {
    write('links2/big.png', 'big');
    const plan = await gather('links2/page.html', '<a href="big.png">Full size</a><img src="big.png">');
    assert.deepEqual(goes(plan), ['page.html', 'big.png']);
    assert.deepEqual(left(plan), []);
  });

  await check('a missing file and a folder go nowhere and are not named', async () => {
    fs.mkdirSync(path.join(project, 'empty/folder'), { recursive: true });
    const plan = await gather('empty/page.html', '<img src="nope.png"><a href="folder/">f</a>');
    assert.deepEqual(goes(plan), ['page.html']);
    assert.deepEqual(left(plan), []);
  });

  // ---------- S8–S13: the boundary and the exclusions (each fails without its rule) ----------

  await check('S8: ../../ out of the project is "outside this project"', async () => {
    const plan = await gather('deep/page.html', '<img src="../../secrets/scan.png">');
    assert.deepEqual(goes(plan), ['page.html']);
    assert.deepEqual(left(plan), [['../../secrets/scan.png', 'outside']]);
  });

  await check('S8b: a ../ that leaves the project and comes back by a symlink is still "outside"', async () => {
    write('back/img/a.png', 'a');
    fs.symlinkSync(path.join(project, 'back/img/a.png'), path.join(outside, 'back-link.png'));
    const plan = await gather('back/page.html', '<img src="../../secrets/back-link.png">');
    assert.deepEqual(goes(plan), ['page.html'], 'judged as written too, not only by real path');
    assert.deepEqual(left(plan), [['../../secrets/back-link.png', 'outside']]);
  });

  await check('S9: .env and .git/config are "a hidden file"', async () => {
    write('.env', 'TOKEN=1');
    write('.git-like/config', 'x');
    fs.mkdirSync(path.join(project, 'site'), { recursive: true });
    const plan = await gather('site/page.html', '<link href="../.env"><script src="../.git/config"></script><img src="../.git-like/config">');
    assert.deepEqual(goes(plan), ['page.html']);
    assert.equal(reasonOf(plan, '.env'), 'hidden');
    assert.equal(reasonOf(plan, '.git/config'), 'hidden');
    assert.equal(reasonOf(plan, '.git-like/config'), 'hidden');
  });

  await check('S10: a symlink inside the project to a file outside is "outside"; one to a hidden file is "hidden"', async () => {
    fs.mkdirSync(path.join(project, 'linked/img'), { recursive: true });
    fs.symlinkSync(path.join(outside, 'scan.png'), path.join(project, 'linked/img/logo.png'));
    fs.symlinkSync(path.join(project, '.env'), path.join(project, 'linked/img/env.png'));
    write('linked/img/real.png', 'real');
    fs.symlinkSync(path.join(project, 'linked/img/real.png'), path.join(project, 'linked/img/alias.png'));
    const plan = await gather('linked/page.html', '<img src="img/logo.png"><img src="img/env.png"><img src="img/alias.png">');
    assert.equal(reasonOf(plan, 'img/logo.png'), 'outside');
    assert.equal(reasonOf(plan, 'linked/img/env.png'), 'hidden', 'judged by its real path too');
    assert.deepEqual(goes(plan), ['page.html', 'img/alias.png'], 'a symlink that stays inside goes, at the path the page uses');
    assert.equal(plan.files[1].realPath, path.join(project, 'linked/img/real.png'));
  });

  await check('S10b: a symlinked folder that leaves the project is "outside"', async () => {
    fs.symlinkSync(outside, path.join(project, 'shared'));
    const plan = await gather('page-shared.html', '<img src="shared/scan.png">');
    assert.deepEqual(left(plan), [['shared/scan.png', 'outside']]);
  });

  await check('S11: %2e%2e, file://, an absolute path, a drive letter and a UNC path are "outside"', async () => {
    const plan = await gather('s11/page.html', [
      '<img src="%2e%2e/%2e%2e/secrets/scan.png">',
      `<img src="file://${outside}/b.png">`,
      `<img src="${outside}/c.png">`,
      '<img src="C:\\Users\\me\\x.png">',
      '<img src="\\\\server\\share\\x.png">',
      '<img src="//server/share/y.png">',
      '<img src="file://server/share/z.png">',
    ].join(''));
    assert.deepEqual(goes(plan), ['page.html']);
    assert.ok(plan.leftOut.every((l) => l.reason === 'outside'), JSON.stringify(plan.leftOut));
    assert.equal(plan.leftOut.length, 6, JSON.stringify(plan.leftOut)); // `//server/…` is a web address on the published page (S12)
  });

  await check('S11b: a query never shows in a left-out name', async () => {
    const plan = await gather('s11b/page.html', '<img src="../../secrets/scan.png?token=abc#x">');
    assert.deepEqual(left(plan), [['../../secrets/scan.png', 'outside']]);
  });

  await check('S12: a CDN script and a data: picture are not in the list', async () => {
    const plan = await gather('s12/page.html', '<script src="//cdn.example.com/x.js"></script><script src="https://cdn.example.com/y.js"></script><img src="data:image/png;base64,iVBORw0KGgo=">');
    assert.deepEqual(goes(plan), ['page.html']);
    assert.deepEqual(left(plan), []);
  });

  await check('S13: a link to appendix.html is "another page"', async () => {
    write('s13/appendix.html', 'a');
    const plan = await gather('s13/page.html', '<a href="appendix.html">Appendix</a><iframe src="appendix.html?x"></iframe>');
    assert.deepEqual(left(plan), [['s13/appendix.html', 'otherPage']]);
    assert.deepEqual(goes(plan), ['page.html']);
  });

  await check('node_modules is "a tool\'s folder"', async () => {
    write('nm/node_modules/lib/index.js', 'x');
    const plan = await gather('nm/page.html', '<script src="node_modules/lib/index.js"></script>');
    assert.deepEqual(left(plan), [['nm/node_modules/lib/index.js', 'toolFolder']]);
  });

  await check('Git-ignored files are "Git ignores it", and nothing they name is followed', async () => {
    write('gi/build/app.js', 'x');
    write('gi/theme.local.css', "body { background: url('secret-bg.png') }");
    write('gi/secret-bg.png', 'bg');
    write('gi/kept.png', 'kept');
    const plan = await gather('gi/page.html', '<script src="build/app.js"></script><link rel="stylesheet" href="theme.local.css"><img src="kept.png">');
    assert.deepEqual(goes(plan), ['page.html', 'kept.png']);
    assert.equal(reasonOf(plan, 'gi/build/app.js'), 'gitIgnored');
    assert.equal(reasonOf(plan, 'gi/theme.local.css'), 'gitIgnored');
    assert.ok(!goes(plan).includes('secret-bg.png'), "a left-out stylesheet's files never come in through it");
  });

  await check('minor 7: a symlink in the project to a file Git ignores is "Git ignores it" (Git is asked about the real path)', async () => {
    write('gi7/build/key.png', 'a picture Git ignores');
    fs.symlinkSync(path.join(project, 'gi7/build/key.png'), path.join(project, 'gi7/logo.png'));
    write('gi7/kept.png', 'kept');
    const plan = await gather('gi7/page.html', '<img src="logo.png"><img src="kept.png">');
    assert.deepEqual(goes(plan), ['page.html', 'kept.png'], 'the name the page uses is not ignored; the file it points to is');
    assert.deepEqual(left(plan), [['gi7/logo.png', 'gitIgnored']]);
  });

  await check('minor 6: a file behind a linked folder in the project is left out ("couldn\'t be checked"); the rest still go', async () => {
    write('gi6/real/a.png', 'a');
    write('gi6/b.png', 'b');
    fs.symlinkSync(path.join(project, 'gi6/real'), path.join(project, 'gi6/alias'));
    const plan = await gather('gi6/page.html', '<img src="alias/a.png"><img src="b.png">');
    assert.deepEqual(goes(plan), ['page.html', 'b.png'], 'one refused path never fails the whole gather');
    assert.deepEqual(left(plan), [['gi6/alias/a.png', 'gitUnchecked']]);
    const direct = await gatherPage(path.join(project, 'gi6/page.html'), project);
    assert.deepEqual(direct.leftOut, plan.leftOut, 'the same on a second ask');
  });

  await check('minor 6: Git is asked with LC_ALL=C, so its messages read the same in any language', async () => {
    const before = { LC_ALL: process.env.LC_ALL, LANG: process.env.LANG, LANGUAGE: process.env.LANGUAGE };
    process.env.LC_ALL = 'de_DE.UTF-8';
    process.env.LANG = 'de_DE.UTF-8';
    process.env.LANGUAGE = 'de';
    try {
      const answer = await gitIgnored(project, [path.join(project, 'gi6/alias/a.png'), path.join(project, 'gi7/build/key.png')]);
      assert.deepEqual([...answer.unchecked], [path.join(project, 'gi6/alias/a.png')]);
      assert.deepEqual([...answer.ignored], [path.join(project, 'gi7/build/key.png')]);
      const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-nogit-lc-')));
      try {
        assert.deepEqual(await gitIgnored(plain, [path.join(plain, 'a.png')]), { ignored: new Set(), unchecked: new Set() }, 'no repository: nothing ignored, in any language');
      } finally {
        fs.rmSync(plain, { recursive: true, force: true });
      }
    } finally {
      for (const [k, v] of Object.entries(before)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  await check('a hidden stylesheet is never followed', async () => {
    write('hid/.private/style.css', "body { background: url('../photo.png') }");
    write('hid/photo.png', 'p');
    const plan = await gather('hid/page.html', '<link rel="stylesheet" href=".private/style.css">');
    assert.deepEqual(goes(plan), ['page.html']);
  });

  await check('Git that fails in a repository stops the gather (fail closed)', async () => {
    write('fc/a.png', 'a');
    const page = write('fc/page.html', '<img src="a.png">');
    await assert.rejects(gatherPage(page, project, { gitIgnored: async () => { throw new GitCheckError(); } }), GitCheckError);
  });

  await check('no Git repository: nothing is ignored', async () => {
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publish-nogit-')));
    fs.writeFileSync(path.join(plain, 'a.png'), 'a');
    fs.writeFileSync(path.join(plain, 'page.html'), '<img src="a.png">');
    const plan = await gatherPage(path.join(plain, 'page.html'), plain);
    assert.deepEqual(goes(plan), ['page.html', 'a.png']);
    fs.rmSync(plain, { recursive: true, force: true });
  });

  await check('S15: a file over 25 MiB is too big and is never read', async () => {
    const big = write('big/clip.mp4', 'small on disk');
    const page = write('big/page.html', '<video src="clip.mp4"></video>');
    const read: string[] = [];
    const plan = await gatherPage(page, project, {
      stat: async (p) => {
        const s = await fs.promises.stat(p);
        return { isFile: () => s.isFile(), size: p === big ? 30 * 1024 * 1024 : s.size };
      },
      readFile: async (p) => { read.push(p); return fs.promises.readFile(p); },
    });
    assert.deepEqual(plan.tooBig, [{ projectPath: 'big/clip.mp4', size: 30 * 1024 * 1024 }]);
    assert.ok(!read.includes(big));
  });

  await check('CSS loops end', async () => {
    write('loop/a.css', '@import "b.css";');
    write('loop/b.css', '@import url(a.css);');
    const plan = await gather('loop/page.html', '<link rel="stylesheet" href="a.css">');
    assert.deepEqual(goes(plan), ['page.html', 'a.css', 'b.css']);
  });

  await check('a CSS comment names nothing', async () => {
    write('cm/old.png', 'o');
    const plan = await gather('cm/page.html', '<style>/* background: url(old.png) */</style><!-- <img src="old.png"> -->');
    assert.deepEqual(goes(plan), ['page.html']);
  });

  await check('the content hash follows paths and bytes', async () => {
    const a = contentHashOf([{ relPath: 'a', sha256: '1' }, { relPath: 'b', sha256: '2' }]);
    assert.equal(a, contentHashOf([{ relPath: 'b', sha256: '2' }, { relPath: 'a', sha256: '1' }]));
    assert.notEqual(a, contentHashOf([{ relPath: 'a', sha256: '1' }, { relPath: 'b', sha256: '3' }]));
    assert.notEqual(a, contentHashOf([{ relPath: 'a', sha256: '1' }, { relPath: 'c', sha256: '2' }]));
  });

  await check('kinds and srcset parsing', () => {
    assert.equal(kindOf('x.WOFF2'), 'font');
    assert.equal(kindOf('x.svg'), 'picture');
    assert.equal(kindOf('x.mp4'), 'other');
    assert.deepEqual(srcsetUrls('a.png 1x, b.png 2x'), ['a.png', 'b.png']);
    assert.deepEqual(srcsetUrls('a.png,b.png 2x'), ['a.png,b.png']);
    assert.deepEqual(srcsetUrls('data:image/png;base64,AA== 1x, c.png 2x'), ['data:image/png;base64,AA==', 'c.png']);
  });

  fs.rmSync(root, { recursive: true, force: true });
  console.log(`gather.test: ${passed} passed`);
}

main().catch((e) => {
  console.error(e);
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(1);
});
