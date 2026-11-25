#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const template = path.join(repo, 'docs/development/releases/v2.4.0/sprint-173-word-folder/research/reading-test.md');
const runtimes = {
  claude: { label: 'Claude', key: 'ANTHROPIC' },
  chatgpt: { label: 'ChatGPT', key: 'OPENAI' },
  opencode: { label: 'OpenCode', key: 'GOOGLE' },
};

const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const title = (file) => path.posix.basename(file, path.posix.extname(file));
const mentions = (text, file) => normalize(text).includes(normalize(title(file)));
const containsFact = (text, words) => words.some((word) => {
  const escaped = normalize(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(normalize(text));
});
const pathText = /(?:\bfile:\/\/|\b[A-Z]:[\\/]|(?:^|[\s`"'(])(?:~|\.{1,2})?[\\/]\S|(?:[\w.-]+[\\/])+[\w.-]+\.(?:docx|pdf|pptx)\b)/im;
const passwordReason = /\b(?:has a password|password[- ]protected|encrypted with a password|requires a password)\b/i;
const wayForward = /\b(?:provide|supply|enter|share|ask for|request)\b[^.!?\n]{0,55}\bpassword\b|\b(?:unlocked|unencrypted|decrypted)\s+copy\b|\b(?:unlock|decrypt)\b[^.!?\n]{0,55}\b(?:file|document|appendix|copy)\b/i;
const otherUnreadReason = /\b(?:could not|couldn't|unable to|cannot|can’t|can't) (?:open|read|extract)\b[^\n]*\b(?:corrupt(?:ed)?|damaged|unsupported|permission denied|access denied|missing|not found|timed out)\b/i;
const scanReason = /\b(?:no (?:searchable |selectable |extractable )?text|image[- ]only|needs ocr|without (?:a )?text layer)\b/i;
const noNotes = /\b(?:no (?:speaker )?notes|(?:speaker )?notes\s*[:–—-]\s*(?:none|absent|n\/a))\b/i;

export function scoreRun({ answer, visibleAnswer = answer, stepLabels, links = [] }, facts) {
  const lines = visibleAnswer.split('\n').map((line) => line.trim()).filter(Boolean);
  const passwordLine = lines.find((line) => mentions(line, facts.passwordDocument) && passwordReason.test(line)) ?? null;
  const coverage = facts.documents.map(({ file, words, unreadReason }) => {
    const rows = lines.filter((line) => mentions(line, file));
    if (rows.some((line) => containsFact(line, words))) return { file, result: 'read' };
    if (rows.some((line) => otherUnreadReason.test(line) || (unreadReason === 'scan' && scanReason.test(line)))) return { file, result: 'unread' };
    return { file, result: 'missing' };
  });
  coverage.push({ file: facts.passwordDocument, result: passwordLine ? 'unread' : 'missing' });

  // Each slide entry starts with its own number. The prompt asks for notes on the same line.
  const slideRows = new Map();
  let duplicateSlide = false;
  for (const line of lines) {
    const match = /^(?:[-*+]\s+)?(?:\*\*)?slide\s+(\d+)\b/i.exec(line);
    if (!match) continue;
    const number = Number(match[1]);
    if (slideRows.has(number)) duplicateSlide = true;
    slideRows.set(number, line);
  }
  const slides = facts.deck.slides.map(({ number, words, noteWords }) => {
    const row = slideRows.get(number) ?? '';
    const marker = /\b(?:speaker )?notes?\s*[:–—-]/i.exec(row);
    const slideText = marker ? row.slice(0, marker.index) : row;
    const noteText = marker ? row.slice(marker.index) : '';
    const wrongNotes = facts.deck.slides.some((other) => other.number !== number && containsFact(row, other.noteWords));
    return {
      number, content: containsFact(slideText, words),
      notes: !wrongNotes && !containsFact(slideText, noteWords)
        && (noteWords.length ? containsFact(noteText, noteWords) && !noNotes.test(noteText) : noNotes.test(row)),
    };
  });
  const deckRows = lines.filter((line) => mentions(line, facts.deck.file));
  const deckRead = deckRows.length > 0 && slides.every((slide) => slide.content);
  coverage.push({
    file: facts.deck.file,
    result: deckRead ? 'read' : deckRows.some((line) => otherUnreadReason.test(line)) ? 'unread' : 'missing',
  });

  const names = [facts.folder, ...coverage.flatMap(({ file }) => [path.posix.basename(file), title(file), ...path.posix.dirname(file).split('/')])]
    .filter((name) => name && name !== '.');
  const badSteps = stepLabels.filter((label) => {
    const match = /^(?:Read|Looked in|Couldn't open|Could not open)\s+(.+?)(?:\s+·\s+|:\s+|$)/i.exec(label.trim());
    return !match || pathText.test(label) || !names.some((name) => normalize(match[1]) === normalize(name));
  });

  const numberedSources = /\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]|\(\s*(?:sources?|refs?)\s*:?\s*\d+|\b(?:sources?|refs?|citations?)\s*[:#]?\s*\d+|^(?:\s*\d+[.)]\s*)[^\n]*\.(?:docx|pdf|pptx)\b/im;
  // Markdown link destinations are hidden. Only inspect the displayed answer and link labels.
  const badSourceStyle = numberedSources.test(visibleAnswer) || /\[[^\]\n]+\.(?:docx|pdf|pptx)\s*\]/i.test(visibleAnswer)
    || pathText.test(visibleAnswer) || links.some(({ label }) => /^\s*\[?\d+\]?\s*$/.test(label));
  const readSourcesLinked = coverage.filter(({ result }) => result === 'read')
    .every(({ file }) => links.some((link) => link.expectedFile === file));
  const documentsOpen = links.length > 0 && links.every((link) => link.opensRightDocument && link.hasPassage);
  const result = (ok) => ok ? 'pass' : 'fail';
  return {
    coverage, slides, badSteps, passwordLine,
    criteria: {
      1: result(coverage.every(({ result: coverageResult }) => coverageResult !== 'missing')),
      2: result(!duplicateSlide && slideRows.size === slides.length && slides.every((slide) => slide.notes)),
      3: result(stepLabels.length > 0 && badSteps.length === 0),
      4: readSourcesLinked && documentsOpen ? 'to check' : 'fail',
      5: result(Boolean(passwordLine && wayForward.test(passwordLine))),
      6: result(Boolean(answer.trim()) && !badSourceStyle),
    },
  };
}

function sourceDestination(href, folder) {
  try {
    const hash = href.indexOf('#');
    const fragment = hash < 0 ? '' : href.slice(hash + 1);
    const params = new URLSearchParams(fragment);
    const raw = (hash < 0 ? href : href.slice(0, hash)).trim();
    if (!raw || (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^(?:file:\/\/|[a-z]:[\\/])/i.test(raw))) return null;
    const target = /^file:\/\//i.test(raw) ? fileURLToPath(raw) : decodeURIComponent(raw);
    const relative = path.relative(folder, path.resolve(folder, target)).split(path.sep).join('/').normalize('NFC');
    return { relative, passage: /^(?:p|q)=/.test(fragment) && (/^[1-9]\d*$/.test(params.get('p') ?? '') || Boolean(params.get('q')?.trim())) };
  } catch {
    return null;
  }
}

function browser(port, signal) {
  async function targets() {
    signal.throwIfAborted();
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
    return response.json();
  }

  async function request(target, method, params) {
    signal.throwIfAborted();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CDP request timed out.')), 4000);
        const finish = (callback, value) => {
          clearTimeout(timer);
          callback(value);
        };
        socket.onopen = () => socket.send(JSON.stringify({ id: 1, method, params }));
        socket.onerror = () => finish(reject, new Error('CDP connection failed.'));
        socket.onclose = () => finish(reject, new Error('CDP connection closed.'));
        socket.onmessage = ({ data }) => {
          const reply = JSON.parse(data);
          if (reply.id !== 1) return;
          if (reply.error || reply.result?.exceptionDetails) finish(reject, new Error(`CDP ${method} failed.`));
          else finish(resolve, reply.result);
        };
      });
    } finally {
      socket.close();
    }
  }

  const evaluate = async (target, expression) => (await request(target, 'Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })).result.value;
  async function page() {
    const workbench = (await targets()).find(({ type, url }) => type === 'page' && url.startsWith('vscode-file://'));
    if (!workbench) throw new Error('Ritemark workbench CDP target is missing.');
    return workbench;
  }
  async function frame() {
    for (const candidate of (await targets()).filter(({ type, url }) => type === 'iframe' && url.startsWith('vscode-webview://'))) {
      if (await evaluate(candidate, frameCode('return !!d?.querySelector(\'textarea[aria-label="Message"]\');')).catch(() => false)) {
        return candidate;
      }
    }
    return null;
  }
  const frameCode = (body) => `(() => {const d=document.getElementById('active-frame')?.contentDocument; ${body}})()`;
  async function chat(body) {
    const target = await frame();
    return target ? evaluate(target, frameCode(body)) : null;
  }
  async function waitFor(probe, seconds, message) {
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const value = await probe();
      if (value) return value;
      await pause(300, undefined, { signal });
    }
    if (message) throw new Error(message);
    return null;
  }
  async function press(key, code, windowsVirtualKeyCode, modifiers = 0) {
    for (const type of ['keyDown', 'keyUp']) {
      await request(await page(), 'Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, modifiers });
    }
  }
  async function clickChat(element) {
    const target = await frame();
    if (!target) return false;
    const point = await evaluate(target, frameCode(`
      const el = (${element});
      if (!el) return null;
      el.scrollIntoView({block:'nearest'});
      const r = el.getBoundingClientRect();
      return r.width && r.height ? {x:r.x+r.width/2, y:r.y+r.height/2} : null;
    `));
    if (!point) return false;
    const id = new URL(target.url).searchParams.get('id');
    const workbench = await page();
    const offset = await evaluate(workbench, `(() => {
      const f = [...document.querySelectorAll('iframe')].find(el => new URL(el.src, location.href).searchParams.get('id') === ${JSON.stringify(id)});
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return {x:r.x, y:r.y};
    })()`);
    if (!id || !offset) return false;
    for (const type of ['mousePressed', 'mouseReleased']) {
      await request(workbench, 'Input.dispatchMouseEvent', {
        type, x: offset.x + point.x, y: offset.y + point.y, button: 'left', clickCount: 1,
      });
    }
    return true;
  }

  return { targets, evaluate, page, frame, frameCode, chat, clickChat, waitFor, press,
    insert: async (text) => request(await page(), 'Input.insertText', { text }),
  };
}

const modelSelector = 'button[role="combobox"][title*=" · "]';
const criteriaLabels = ['Document coverage', 'Speaker notes', 'Step labels', 'Passage links', 'Password notice and way forward', 'Source style'];
const activeTab = '.part.editor .editor-group-container.active .tabs-container > .tab.active';
const lastTurn = `
  const anchor = [...d.querySelectorAll('[data-turn-anchor]')].at(-1);
  let turn = anchor?.nextElementSibling;
  while (turn && !turn.matches('.space-y-2') && !turn.hasAttribute('data-turn-anchor')) turn = turn.nextElementSibling;
  if (turn?.hasAttribute('data-turn-anchor')) turn = null;
`;

async function ask(ui, ai, runtime, question) {
  if (!(await ui.frame())) {
    await ui.press('F1', 'F1', 112);
    await ui.waitFor(async () => ui.evaluate(await ui.page(), '!!document.querySelector(".quick-input-widget input:focus")'),
      10, 'The command palette did not open.');
    await ui.insert('Ritemark: Show AI Assistant');
    await ui.waitFor(async () => ui.evaluate(await ui.page(), '[...document.querySelectorAll(".quick-input-list .monaco-list-row")].some(row => row.innerText.includes("Show AI Assistant"))'),
      15, 'The AI sidebar command is unavailable.');
    await ui.press('Enter', 'Enter', 13);
  }
  await ui.waitFor(ui.frame, 60, 'The AI composer did not open.');
  const modelButton = `d.querySelector(${JSON.stringify(modelSelector)})`;
  const selected = () => ui.chat(`return ${modelButton}?.title;`);
  if (!(await selected())?.startsWith(`${runtime.label} · `)) {
    await ui.waitFor(() => ui.clickChat(modelButton), 20, 'The AI model picker is unavailable.');
    const option = `[...d.querySelectorAll('[role="group"]')].find(el =>
      d.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim() === ${JSON.stringify(runtime.label)}
    )?.querySelector('[role="option"]:not([aria-disabled="true"])')`;
    await ui.waitFor(() => ui.clickChat(option), 30, 'The requested AI has no selectable model. Check the test build and vault setup.');
  }
  const model = await ui.waitFor(async () => {
    const current = await selected();
    return current?.startsWith(`${runtime.label} · `) && current;
  }, 15, 'The composer switched to a different AI.');
  const textarea = 'd.querySelector(\'textarea[aria-label="Message"]\')';
  if (!(await ui.clickChat(textarea))) throw new Error('The message box could not be focused.');
  await ui.insert(question);
  await ui.waitFor(() => ui.chat(`return ${textarea}?.value === ${JSON.stringify(question)};`),
    10, 'The fixed question did not reach the message box.');
  if (!(await ui.clickChat('d.querySelector(\'button[aria-label="Send"]:not(:disabled)\')'))) throw new Error('Send is unavailable.');

  const answer = await ui.waitFor(() => ui.chat(`
    ${lastTurn}
    if (!turn?.textContent.includes(${JSON.stringify(question)}) || d.querySelector('button[aria-label="Stop"]')) return null;
    if (turn.querySelector('[data-turn-failure]') || d.querySelector('[data-activity-state="error"]')) return {failed:true};
    const markdown = [...turn.querySelectorAll('.rendered-markdown')].at(-1);
    if (!markdown) return null;
    // Read the same raw Markdown prop the renderer consumed, without clipboard or DOM-to-Markdown conversion.
    let fiber = markdown[Object.keys(markdown).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.memoizedProps?.content !== 'string') fiber = fiber.return;
    return fiber ? {
      answer:fiber.memoizedProps.content,
      visibleAnswer:markdown.innerText,
      links:[...markdown.querySelectorAll('a[href]')].map(a=>({label:a.innerText, href:a.getAttribute('href')})),
    } : null;
  `), 240, 'The turn did not produce a completed answer within 240 seconds.');
  if (answer.failed) throw new Error('The selected AI returned a turn failure. Check API-key readiness in the test build.');

  await ui.chat(`
    ${lastTurn}
    for (const details of turn.querySelectorAll('details')) {
      if (/^(Activity|Read )/.test(details.querySelector('summary')?.innerText || '')) details.open = true;
    }
    for (const button of turn.querySelectorAll('button')) {
      if (/^(?:\\d+ actions? completed|Read \\d+|What (?:ChatGPT|OpenCode) said)/.test(button.innerText)
         && button.getAttribute('aria-expanded') !== 'true' && !button.nextElementSibling) button.click();
    }
    return true;
  `);
  const stepLabels = await ui.chat(`
    ${lastTurn}
    const rows = turn.querySelectorAll(${JSON.stringify(ai === 'claude'
      ? 'details[open] > summary + div > div'
      : 'button + div.border-l > div')});
    return [...rows].flatMap(row => {
      const fiber = row[Object.keys(row).find(key => key.startsWith('__reactFiber$'))];
      const activity = fiber?.return?.memoizedProps?.activity;
      return activity && /^(init|thinking|text|done|error)$/.test(activity.type) ? [] : [row.innerText.trim()];
    });
  `);
  return { ...answer, stepLabels, model };
}

async function tryLinks(ui, folder, facts, links, results) {
  const files = [...facts.documents.map(({ file }) => file), facts.deck.file, facts.passwordDocument];
  const front = async () => ui.evaluate(await ui.page(), `(() => {
    const tab = document.querySelector(${JSON.stringify(activeTab)});
    return tab?.getAttribute('data-resource-name') ?? '';
  })()`);
  for (const [index, link] of links.entries()) {
    const expectedFile = files.find((file) => mentions(link.label, file)) ?? null;
    const destination = sourceDestination(link.href, folder);
    const entry = {
      ...link, expectedFile, hasPassage: destination?.passage ?? false, openedDocument: null,
      opensRightDocument: false, findMarkedPassage: false, landsOnClaim: 'to check',
    };
    results.push(entry);
    // Click only links whose destination is a known fixture. A realpath check also excludes symlinks out of the folder.
    const targetFile = files.find((file) => file.normalize('NFC') === destination?.relative);
    if (!targetFile) continue;
    const filePath = path.join(folder, targetFile);
    if (!fs.existsSync(filePath) || fs.realpathSync(filePath).normalize('NFC') !== filePath.normalize('NFC')) continue;

    // Close the last fixture before the next click so a stale tab or highlight cannot count.
    const isFixtureActive = async () => {
      const open = await front();
      return files.some((file) => path.posix.basename(file).normalize('NFC') === open.normalize('NFC'));
    };
    if (await isFixtureActive()) {
      await ui.evaluate(await ui.page(), `document.querySelector(${JSON.stringify(activeTab + ' .action-label.codicon-close')})?.click()`);
      await ui.waitFor(async () => !(await isFixtureActive()), 5,
        'Could not close the last fixture tab.');
    }
    const anchor = `(() => {${lastTurn} return [...(turn?.querySelectorAll('.rendered-markdown') ?? [])].at(-1)?.querySelectorAll('a[href]')[${index}];})()`;
    if (!(await ui.clickChat(anchor))) continue;
    entry.openedDocument = await ui.waitFor(async () => {
      const open = await front();
      return files.find((file) => path.posix.basename(file).normalize('NFC') === open.normalize('NFC'));
    }, 10);
    entry.opensRightDocument = Boolean(expectedFile && entry.openedDocument === expectedFile);
    if (!entry.openedDocument) continue;
    entry.findMarkedPassage = Boolean(await ui.waitFor(async () => {
      for (const target of (await ui.targets()).filter(({ type, url }) => type === 'iframe' && url.startsWith('vscode-webview://'))) {
        const found = await ui.evaluate(target, ui.frameCode(`
          return /^[1-9]\\d* of \\d+$/.test(d?.querySelector('[data-find-bar] .find-bar-count')?.innerText || '');
        `)).catch(() => false);
        if (found) return true;
      }
      return false;
    }, new URLSearchParams(link.href.split('#')[1]).has('q') ? 5 : 1));
  }
}

function field(output, name) {
  return output.split(/\r?\n/).find((line) => line.startsWith(name + '='))?.slice(name.length + 1);
}

function launch(args) {
  // The launcher may include app log excerpts on failure. Keep them out of this runner's logs.
  return spawnSync(path.join(here, 'dev-launch-isolated.sh'), args, { encoding: 'utf8' });
}

function formatRun(run) {
  const fence = '`'.repeat(Math.max(3, ...(run.answer.match(/`+/g) ?? []).map((s) => s.length + 1)));
  const bullets = (items) => items.length ? items.map((line) => `- ${line}`).join('\n') : 'None recorded.';
  return `#### Run ${run.number}

- Date — ${run.date}
- Build — ${run.build ?? 'unavailable'}
- Model — ${run.model ?? 'unavailable'}
- Question — ${run.question}
- Password document's line — ${run.passwordLine ?? 'None recorded.'}
${run.error ? `- Run error — ${run.error}\n` : ''}
**Answer (verbatim)**

${fence}markdown
${run.answer}
${fence}

**Step labels**

${bullets(run.stepLabels)}

**Links tried**

${bullets(run.links.map((link) => `${link.label} — \`${link.href}\` — opened ${link.openedDocument ?? 'none'} — opens the right document ${link.opensRightDocument ? 'yes' : 'no'} — find marked a passage ${link.findMarkedPassage ? 'yes' : 'no'} — lands on the claim to check`))}

**Criteria**

${Object.entries(run.criteria).map(([n, status]) => `${n}. ${criteriaLabels[Number(n) - 1]} — ${status}`).join('\n')}
`;
}

async function main() {
  const { values } = parseArgs({ options: { ai: { type: 'string' }, folder: { type: 'string' }, out: { type: 'string' },
    'user-data-dir': { type: 'string' } } });
  const runtime = Object.hasOwn(runtimes, values.ai) && runtimes[values.ai];
  if (!runtime || !values.folder || !values.out) throw new Error('Use --ai claude|chatgpt|opencode --folder <dir> --out <dir>.');
  const profile = values['user-data-dir'];
  if (process.platform !== 'darwin') throw new Error('The existing isolated launcher and vault wrapper require macOS. Windows needs its Gate 2 launcher and vault wrapper.');
  if (process.env.RITEMARK_BUILD_CHANNEL !== 'test' || !profile || profile !== process.env.RITEMARK_TEST_PROFILE
      || !Object.hasOwn(process.env, `RITEMARK_TEST_KEY_${runtime.key}`)) {
    throw new Error('Run through with-test-keys.sh with the required provider and the matching test profile.');
  }
  const folder = fs.realpathSync(values.folder);
  const facts = JSON.parse(fs.readFileSync(path.join(folder, '..', 'facts.json'), 'utf8'));
  facts.folder = path.basename(folder);
  const question = fs.readFileSync(template, 'utf8').match(/^> (Review the whole folder[^\r\n]*)/m)?.[1];
  if (!question) throw new Error('The fixed question is missing from reading-test.md.');
  const output = path.resolve(values.out);
  const insideFolder = (dir) => dir === folder || dir.startsWith(folder + path.sep);
  if (insideFolder(output)) throw new Error('Keep evidence outside the workspace.');
  // Resolve the nearest existing ancestor before mkdir so a symlink cannot put evidence in the fixture.
  let ancestor = output;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (insideFolder(fs.realpathSync(ancestor))) throw new Error('Keep evidence outside the workspace.');
  fs.mkdirSync(output, { recursive: true });
  let number = 1;
  let stem;
  for (;; number++) {
    stem = path.join(output, `run-${values.ai}-${number}`);
    if (fs.existsSync(stem + '.md')) continue;
    try {
      fs.closeSync(fs.openSync(stem + '.json', 'wx'));
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  const report = { number, ai: values.ai, platform: 'Mac', date: new Date().toISOString(), question, answer: '', stepLabels: [], links: [] };
  let runDir;
  const abort = new AbortController();
  const interrupt = () => abort.abort(new Error('Run interrupted.'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const started = launch(['start', '--name', `reading-${values.ai}`, '--folder', folder, `--user-data-dir=${profile}`]);
    runDir = field(started.stdout ?? '', 'RUN_DIR');
    const port = Number(field(started.stdout ?? '', 'PORT'));
    if (started.status !== 0 || !runDir || !port) throw new Error('dev-launch-isolated.sh start failed. Check the dev build, launch window and empty test profile.');
    const buildRoot = field(started.stdout, 'BUILD_ROOT') ?? repo;
    const version = JSON.parse(fs.readFileSync(path.join(buildRoot, 'extensions/ritemark/package.json'), 'utf8')).version;
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: buildRoot, encoding: 'utf8' });
    report.build = `${version} dev (${revision.stdout?.trim() || 'revision unavailable'})`;
    const ui = browser(port, abort.signal);
    Object.assign(report, await ask(ui, values.ai, runtime, question));
    const anchors = report.links;
    report.links = [];
    await tryLinks(ui, folder, facts, anchors, report.links);
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    if (runDir) {
      const stopped = launch(['stop', runDir]);
      if (stopped.status === 0 && /^LEFT=0\r?$/m.test(stopped.stdout ?? '')) {
        console.log('LEFT=0');
      } else {
        report.error = [report.error, `Cleanup failed. Run dev-launch-isolated.sh stop on ${runDir}.`].filter(Boolean).join(' ');
        process.exitCode = 1;
      }
    }
    Object.assign(report, scoreRun(report, facts));
    fs.writeFileSync(stem + '.json', JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(stem + '.md', formatRun(report));
    if (report.error) console.error(report.error);
    if (Object.values(report.criteria).includes('fail')) process.exitCode = 1;
    console.log(`Evidence written to ${stem}.json and ${stem}.md`);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
