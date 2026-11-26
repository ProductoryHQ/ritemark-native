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
  opencode: { label: 'OpenCode', key: 'GOOGLE', modelPrefix: 'opencode:google/' },
};

const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[\p{Pd}−]/gu, '-').replace(/\s+/g, ' ').trim();
const title = (file) => path.posix.basename(file, path.posix.extname(file));
const titleWords = (text) => normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const titleAliases = (name) => {
  const stripped = name.replace(/ (?:v ?\d+|draft \d+)$/, '');
  return stripped !== name && stripped.includes(' ') ? [name, stripped] : [name];
};
const entryEndingNames = (name) => {
  const role = name.replace(/^interview /, '');
  return role !== name && role.includes(' ') ? [name, role] : [name];
};
const normalizeFact = (text) => normalize(text.replace(/["“”'‘’]/g, ''));
const containsFact = (text, words) => {
  const normalized = normalizeFact(text);
  return words.some((word) => {
    const escaped = normalizeFact(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Boolean(escaped) && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(normalized);
  });
};
const pathText = /(?:\bfile:\/\/|\b[A-Z]:[\\/]|(?:^|[\s`"'(])(?:~|\.{1,2})?[\\/]\S|(?:[\w.-]+[\\/])+[\w.-]+\.(?:docx|pdf|pptx)\b)/im;
const passwordReason = /\b(?:has a password|password[- ]protected|encrypted with a password|requires a password)\b/i;
const wayForward = /\b(?:provide|supply|enter|share|ask for|request)\b[^.!?\n]{0,55}\bpassword\b|\b(?:unlocked|unencrypted|decrypted|unprotected|password-free)\s+copy\b|\bcopy\s+without\s+(?:the|a)\s+password\b|\bremove\s+the\s+password\b|\b(?:save|export|send|share|provide|supply)\b[^.!?\n]{0,40}\bcopy\s+without\s+its\s+password\b|\b(?:unlock|decrypt)\b[^.!?\n]{0,55}\b(?:file|document|appendix|copy)\b/i;
const otherUnreadReason = /\b(?:could not|couldn't|unable to|cannot|can’t|can't) (?:open|read|extract)\b[^\n]*\b(?:corrupt(?:ed)?|damaged|unsupported|permission denied|access denied|missing|not found|timed out)\b/i;
const scanReason = /\b(?:no (?:searchable |selectable |extractable |readable )?text|image[- ]only|needs ocr|without (?:a )?text layer)\b/i;
const noNotes = /\b(?:no (?:speaker )?notes|(?:speaker )?notes\s*[:–—-]\s*(?:none|absent|n\/a))\b/i;
const slideStart = /^(?:(?:[-*+]|\d+[.)])\s+)?(?:\*\*)?\[?slide\s+(\d+)\b/i;
const entryName = (line) => titleWords(line.replace(/^(?:[-*+] |\d+[.)] )?/, ''));

export function evidenceRedactor(env = process.env) {
  const keys = Object.entries(env)
    .filter(([name, value]) => name.startsWith('RITEMARK_TEST_KEY_') && value)
    .map(([, value]) => value)
    .sort((a, b) => b.length - a.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const secrets = new RegExp([...keys, 'AIza[0-9A-Za-z_-]{20,}', 'sk-[A-Za-z0-9_-]{20,}'].join('|'), 'g');
  return (value) => typeof value === 'string' ? value.replace(secrets, '[redacted]') : value;
}

export function scoreRun({ answer, visibleAnswer = answer, stepLabels, links = [], customQuestion = false }, facts) {
  const lines = visibleAnswer.split(/\r?\n/).map((line) => line.trim());
  const markdownLines = answer.split(/\r?\n/).map((line) => line.trim());
  const files = [...facts.documents.map(({ file }) => file), facts.passwordDocument, facts.deck.file];
  const entries = new Map(files.map((file) => [file, []]));
  const rawNamesByFile = new Map(files.map((file) => {
    const heading = facts.documents.find((document) => document.file === file)?.heading;
    return [file, [title(file), heading].filter(Boolean)];
  }));
  const namesByFile = new Map([...rawNamesByFile].map(([file, names]) => [file, names.map(titleWords)]));
  const candidates = [...rawNamesByFile].flatMap(([file, names]) => names.flatMap((raw) => {
    const name = titleWords(raw);
    const prefix = titleWords(raw.split(/[,\(]/, 1)[0]);
    return [...new Set([...titleAliases(name), ...(prefix.includes(' ') ? [prefix] : [])])]
      .filter(Boolean).map((alias) => ({ file, name: alias, full: alias === name }));
  }));
  const titles = candidates.filter(({ file, name, full }) => full || !candidates.some((other) =>
    other.file !== file && (other.name === name || other.name.startsWith(name + ' '))))
    .sort((a, b) => b.name.length - a.name.length);
  const startsEntry = (heading) => titles.find(({ name }) => heading === name || heading.startsWith(name + ' '));
  const mentionsOther = (heading, file) => files.some((other) => other !== file
    && containsFact(heading, namesByFile.get(other).flatMap(entryEndingNames)));
  let entryFile;
  let entry;
  for (const line of lines) {
    const heading = entryName(line);
    const file = startsEntry(heading)?.file;
    if (file) {
      entryFile = file;
      entry = [line];
      entries.get(file).push(entry);
    } else if (!line || /^(?:[-*+] |\d+[.)] )/.test(line) || slideStart.test(line)
      || (entry && mentionsOther(heading, entryFile))) {
      entry = undefined;
    } else {
      entry?.push(line);
    }
  }
  const rowsFor = (file) => entries.get(file).map((row) => row.join(' '));
  // Rendered Markdown can insert a blank line between a paragraph and its list.
  // Use source line boundaries for reasons following a standalone title.
  const unreadRows = new Map(files.map((file) => [file, []]));
  let unreadEntry;
  for (const line of markdownLines) {
    const visible = line.replace(/\[([^\]\n]+)\]\([^\n]*?\)/g, '$1');
    const heading = entryName(visible);
    const match = startsEntry(heading);
    if (match && heading === match.name) {
      entryFile = match.file;
      unreadEntry = [visible];
      unreadRows.get(entryFile).push(unreadEntry);
    } else if (!line || match || /^#{1,6}\s/.test(line) || slideStart.test(line)
      || (unreadEntry && mentionsOther(heading, entryFile))) {
      unreadEntry = undefined;
    } else {
      unreadEntry?.push(visible);
    }
  }
  const unreadRowsFor = (file) => [...rowsFor(file), ...unreadRows.get(file).map((row) => row.join(' '))];
  const passwordRows = customQuestion ? [] : unreadRowsFor(facts.passwordDocument).filter((row) => passwordReason.test(row));
  const passwordLine = passwordRows.find((row) => wayForward.test(row)) ?? passwordRows[0] ?? null;
  const coverage = customQuestion ? [] : facts.documents.map(({ file, words, unreadReason }) => {
    const rows = rowsFor(file);
    if (rows.some((row) => containsFact(row, words))) return { file, result: 'read' };
    if (unreadRowsFor(file).some((row) => otherUnreadReason.test(row) || (unreadReason === 'scan' && scanReason.test(row)))) return { file, result: 'unread' };
    return { file, result: 'missing' };
  });
  if (!customQuestion) coverage.push({ file: facts.passwordDocument, result: passwordLine ? 'unread' : 'missing' });

  // Each slide entry starts with its own number. The prompt asks for notes on the same line.
  const slideRows = new Map();
  let duplicateSlide = false;
  for (const line of lines) {
    const match = slideStart.exec(line);
    if (!match) continue;
    const number = Number(match[1]);
    if (slideRows.has(number)) duplicateSlide = true;
    slideRows.set(number, line);
  }
  const slides = customQuestion ? [] : facts.deck.slides.map(({ number, words, noteWords }) => {
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
  const deckRows = rowsFor(facts.deck.file);
  const linkedSlides = new Set();
  for (const line of markdownLines) {
    const match = slideStart.exec(line);
    if (!match) continue;
    const number = Number(match[1]);
    if (links.some(({ href, targetFile, hasPassage }) => {
      if (targetFile !== facts.deck.file || !hasPassage || !line.includes(`](${href})`)) return false;
      const page = new URLSearchParams(href.split('#')[1]).get('p');
      return page === null || page === String(number);
    })) linkedSlides.add(number);
  }
  const deckRead = slides.every(({ content }) => content) && (deckRows.length > 0
    || slides.every(({ number }) => linkedSlides.has(number)));
  if (!customQuestion) coverage.push({
    file: facts.deck.file,
    result: deckRead ? 'read' : unreadRowsFor(facts.deck.file).some((line) => otherUnreadReason.test(line)) ? 'unread' : 'missing',
  });

  const names = ['the project folder', facts.folder, ...files.flatMap((file) => [path.posix.basename(file), title(file), ...path.posix.dirname(file).split('/')])]
    .filter((name) => name && name !== '.');
  const badSteps = stepLabels.filter((label) => {
    if (/^Reading documents$/i.test(label.trim())) return false;
    const match = /^(?:Read|Reading|Looked in|Looking in|Couldn't look in|Couldn't open|Could not open)\s+(.+?)(?:\s+·\s+|:\s+|$)/i.exec(label.trim());
    return !match || pathText.test(label) || !names.some((name) => normalize(match[1]) === normalize(name));
  });

  const numberedSources = /\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]|\(\s*(?:sources?|refs?)\s*:?\s*\d+|\b(?:sources?|refs?|citations?)\s*[:#]?\s*\d+|^(?:\s*\d+[.)]\s*)[^\n]*\.(?:docx|pdf|pptx)\b/im;
  // Markdown link destinations are hidden. Only inspect the displayed answer and link labels.
  const knownRelativePath = files.some((file) => file.includes('/') && normalize(visibleAnswer).includes(normalize(file)));
  const badSourceStyle = numberedSources.test(visibleAnswer) || /\[[^\]\n]+\.(?:docx|pdf|pptx)\s*\]/i.test(visibleAnswer)
    || pathText.test(visibleAnswer) || knownRelativePath || links.some(({ label }) => /^\s*\[?\d+\]?\s*$/.test(label));
  const readSourcesLinked = coverage.filter(({ result }) => result === 'read')
    .every(({ file }) => links.some((link) => link.expectedFile === file));
  const passageLinks = links.filter((link) => link.hasPassage);
  const linkCounts = {
    total: links.length,
    rightDocument: links.filter((link) => link.opensRightDocument).length,
    withPassage: passageLinks.length,
    onClaim: passageLinks.filter((link) => link.landsOnClaim === 'yes').length,
  };
  const pendingClaims = passageLinks.filter((link) => !['yes', 'no'].includes(link.landsOnClaim)).length;
  const requiredPassages = Math.ceil(linkCounts.total * 0.9);
  const passageLinksPass = readSourcesLinked && linkCounts.total > 0 && linkCounts.rightDocument === linkCounts.total
    && linkCounts.onClaim + pendingClaims >= requiredPassages;
  const result = (ok) => ok ? 'pass' : 'fail';
  return {
    coverage, slides, badSteps, passwordLine, linkCounts,
    criteria: {
      1: customQuestion ? 'n/a' : result(coverage.every(({ result: coverageResult }) => coverageResult !== 'missing')),
      2: customQuestion ? 'n/a' : result(!duplicateSlide && slideRows.size === slides.length && slides.every((slide) => slide.notes)),
      3: result(stepLabels.length > 0 && badSteps.length === 0),
      4: customQuestion ? 'n/a' : passageLinksPass ? pendingClaims ? 'to check' : 'pass' : 'fail',
      5: customQuestion ? 'n/a' : result(Boolean(passwordLine && wayForward.test(passwordLine))),
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

export async function retryDestroyedContext(evaluate, refreshTarget, target, expression) {
  try {
    return await evaluate(target, expression);
  } catch (error) {
    if (!/execution context (?:was destroyed|is not available)|cannot find (?:default )?context|inspected target navigated/i.test(error.message)) throw error;
    return evaluate(await refreshTarget(target), expression);
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
          const exception = reply.result?.exceptionDetails;
          if (reply.error || exception) {
            const detail = reply.error?.message ?? exception.exception?.description ?? exception.text;
            finish(reject, new Error(`CDP ${method} failed: ${detail}`));
          } else finish(resolve, reply.result);
        };
      });
    } finally {
      socket.close();
    }
  }

  const evaluateOnce = async (target, expression) => (await request(target, 'Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })).result.value;
  const evaluate = (target, expression) => retryDestroyedContext(evaluateOnce, async (old) => {
    const current = await targets();
    return current.find(({ id }) => id === old.id)
      ?? current.find(({ type, url }) => type === old.type && url === old.url)
      ?? old;
  }, target, expression);
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
  const turnAnchor = [...d.querySelectorAll('[data-turn-anchor]')].at(-1);
  let turn = turnAnchor?.nextElementSibling;
  while (turn && !turn.matches('.space-y-2') && !turn.hasAttribute('data-turn-anchor')) turn = turn.nextElementSibling;
  if (turn?.hasAttribute('data-turn-anchor')) turn = null;
`;

async function ask(ui, ai, runtime, question, report) {
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
  const selected = () => ui.chat(`return {title: ${modelButton}?.title, value: ${modelButton}?.dataset.modelValue};`);
  const matchesRuntime = (model) => model?.title?.startsWith(`${runtime.label} · `)
    && (!runtime.modelPrefix || model.value?.startsWith(runtime.modelPrefix));
  if (!matchesRuntime(await selected())) {
    await ui.waitFor(() => ui.clickChat(modelButton), 20, 'The AI model picker is unavailable.');
    const selector = '[role="option"]:not([aria-disabled="true"])'
      + (runtime.modelPrefix ? `[data-model-value^="${runtime.modelPrefix}"]` : '');
    const option = `[...d.querySelectorAll('[role="group"]')].find(el =>
      d.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim() === ${JSON.stringify(runtime.label)}
    )?.querySelector(${JSON.stringify(selector)})`;
    await ui.waitFor(() => ui.clickChat(option), 30, runtime.modelPrefix
      ? 'OpenCode has no selectable Google model. Check Google key readiness and the model catalog.'
      : 'The requested AI has no selectable model. Check the test build and vault setup.');
  }
  report.model = await ui.waitFor(async () => {
    const current = await selected();
    return matchesRuntime(current) && current.title;
  }, 15, 'The composer did not select the requested AI and provider.');
  const textarea = 'd.querySelector(\'textarea[aria-label="Message"]\')';
  if (!(await ui.clickChat(textarea))) throw new Error('The message box could not be focused.');
  await ui.insert(question);
  await ui.waitFor(() => ui.chat(`return ${textarea}?.value === ${JSON.stringify(question)};`),
    10, 'The question did not reach the message box.');
  if (!(await ui.clickChat('d.querySelector(\'button[aria-label="Send"]:not(:disabled)\')'))) throw new Error('Send is unavailable.');

  const answer = await ui.waitFor(() => ui.chat(`
    ${lastTurn}
    if (!turn?.textContent.includes(${JSON.stringify(question)}) || d.querySelector('button[aria-label="Stop"]')) return null;
    const failure = turn.querySelector('[data-turn-failure]');
    const errors = [...d.querySelectorAll('[data-turn-failure], [data-activity-state="error"], [data-activity-state="failed"], [role="alert"]')]
      .filter(el => el.getClientRects().length).map(el => el.innerText.trim()).filter(Boolean);
    if (failure || d.querySelector('[data-activity-state="error"], [data-activity-state="failed"]')) return { failure: {
      turnFailure: failure?.textContent.trim() ?? null,
      sidebarError: [...new Set(errors)].join('\\n'),
    } };
    const markdown = [...turn.querySelectorAll('.rendered-markdown')].at(-1);
    if (!markdown) return null;
    // Read the same raw Markdown prop the renderer consumed, without clipboard or DOM-to-Markdown conversion.
    let fiber = markdown[Object.keys(markdown).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.memoizedProps?.content !== 'string') fiber = fiber.return;
    return fiber ? {
      answer:fiber.memoizedProps.content,
      visibleAnswer:markdown.innerText,
      readFold:[...turn.querySelectorAll('details:not([open]) > summary, button[aria-expanded="false"]')]
        .find(el => /^Read /.test(el.innerText))?.innerText ?? null,
      links:[...markdown.querySelectorAll('a[href]')].map(a => ({
        label: a.innerText, href: a.getAttribute('href'), sourceLinkId: a.dataset.sourceLink ?? null,
      })),
    } : null;
  `), 240, 'The turn did not produce a completed answer within 240 seconds.');
  if (answer.failure) {
    report.failure = answer.failure;
    throw new Error('The selected model returned a turn failure.');
  }

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
  return { ...answer, stepLabels };
}

export async function tryLinks(ui, folder, facts, links, results) {
  const files = [...facts.documents.map(({ file }) => file), facts.deck.file, facts.passwordDocument];
  const front = async () => ui.evaluate(await ui.page(), `(() => {
    const tab = document.querySelector(${JSON.stringify(activeTab)});
    return tab?.getAttribute('data-resource-name') ?? '';
  })()`);
  const entries = links.map((link) => {
    const destination = sourceDestination(link.href, folder);
    const targetFile = files.find((file) => file.normalize('NFC') === destination?.relative) ?? null;
    return {
      ...link, targetFile, expectedFile: targetFile,
      hasPassage: destination?.passage ?? false, openedDocument: null,
      opensRightDocument: false, findMarkedPassage: false, landsOnClaim: destination?.passage ? 'to check' : 'no',
    };
  });
  results.push(...entries);
  for (const [index, entry] of entries.entries()) {
    const { targetFile, expectedFile, href } = entry;
    let step = 'validate destination';
    try {
      // Click only links whose destination is a known fixture. A realpath check also excludes symlinks out of the folder.
      if (!targetFile) continue;
      const filePath = path.join(folder, targetFile);
      if (!fs.existsSync(filePath) || fs.realpathSync(filePath).normalize('NFC') !== filePath.normalize('NFC')) continue;

      // Close the destination even if it is inactive, so a previous open or find mark
      // cannot satisfy the next check (including repeated links to the same deck).
      const fileName = path.posix.basename(targetFile).normalize('NFC');
      const fixtureTabs = `[...document.querySelectorAll('.part.editor .tab[data-resource-name]')]
        .filter(tab => tab.getAttribute('data-resource-name').normalize('NFC') === ${JSON.stringify(fileName)})`;
      step = 'close destination tab';
      await ui.evaluate(await ui.page(), `(${fixtureTabs}).forEach(tab =>
        tab.dispatchEvent(new MouseEvent('auxclick', {button: 1, bubbles: true, cancelable: true})))`);
      if (!(await ui.waitFor(async () => ui.evaluate(await ui.page(), `(${fixtureTabs}).length === 0`), 5))) {
        throw new Error('Could not close the existing destination tab.');
      }
      // Invoke the rendered anchor itself. Coordinate clicks can land on the
      // hover preview or the composer when the sidebar scrolls to a wrapped link.
      step = 'read active tab before click';
      const previous = await front();
      step = 'click answer link';
      const clicked = await ui.chat(`
        ${lastTurn}
        const markdown = [...(turn?.querySelectorAll('.rendered-markdown') ?? [])].at(-1);
        const anchors = [...(markdown?.querySelectorAll('a[href]') ?? [])];
        const matches = (anchor) => anchor?.getAttribute('href') === ${JSON.stringify(href)};
        const sourceLinkId = ${JSON.stringify(entry.sourceLinkId ?? null)};
        const anchor = (sourceLinkId && anchors.find(a => a.dataset.sourceLink === sourceLinkId && matches(a)))
          || (matches(anchors[${index}]) ? anchors[${index}] : anchors.find(matches));
        if (!anchor) return false;
        anchor.click();
        return true;
      `);
      if (!clicked) {
        throw new Error('The rendered link was unavailable.');
      }
      step = 'wait for destination tab';
      entry.openedDocument = await ui.waitFor(async () => {
        const open = await front();
        if (open === previous) return null;
        return files.find((file) => path.posix.basename(file).normalize('NFC') === open.normalize('NFC'));
      }, 10);
      entry.opensRightDocument = Boolean(expectedFile && entry.openedDocument === expectedFile);
      if (!entry.openedDocument) {
        throw new Error('No fixture tab opened after the rendered link click.');
      }
      step = 'check find mark';
      let findProbeError;
      entry.findMarkedPassage = Boolean(await ui.waitFor(async () => {
        for (const target of (await ui.targets()).filter(({ type, url }) => type === 'iframe' && url.startsWith('vscode-webview://'))) {
          const found = await ui.evaluate(target, ui.frameCode(`
            return /^[1-9]\\d* of \\d+$/.test(d?.querySelector('[data-find-bar] .find-bar-count')?.innerText || '');
          `)).catch((error) => {
            findProbeError = error;
            return false;
          });
          if (found) return true;
        }
        return false;
      }, new URLSearchParams(href.split('#')[1]).has('q') ? 5 : 1));
      if (!entry.findMarkedPassage && findProbeError) throw findProbeError;
    } catch (error) {
      entry.error = error.message;
      entry.errorStep = step;
    }
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
  const { total, rightDocument, withPassage, onClaim } = run.linkCounts;
  const share = (count) => total ? `${count}/${total} (${(100 * count / total).toFixed(1)}%)` : '0/0';
  return `#### Run ${run.number}

- Date — ${run.date}
- Build — ${run.build ?? 'unavailable'}
- Model — ${run.model ?? 'unavailable'}
- Question — ${run.question}
- Completed read fold — ${run.readFold ?? 'None recorded.'}
- Password document's line — ${run.passwordLine ?? 'None recorded.'}
${run.error ? `- Run error — ${run.error}\n` : ''}
**Answer (verbatim)**

${fence}markdown
${run.answer}
${fence}

**Step labels**

${bullets(run.stepLabels)}

**Links tried**

- Opened the right document — ${share(rightDocument)}
- Include a passage target — ${share(withPassage)}
- Confirmed to land on the claim — ${share(onClaim)}

${bullets(run.links.map((link) => `${link.label} — \`${link.href}\` — opened ${link.openedDocument ?? 'none'} — opens the right document ${link.opensRightDocument ? 'yes' : 'no'} — find marked a passage ${link.findMarkedPassage ? 'yes' : 'no'} — lands on the claim ${link.landsOnClaim}${link.error ? ` — ${link.errorStep}: ${link.error}` : ''}`))}

**Criteria**

${Object.entries(run.criteria).map(([n, status]) => `${n}. ${criteriaLabels[Number(n) - 1]} — ${status}`).join('\n')}
`;
}

async function main() {
  const { values } = parseArgs({ options: { ai: { type: 'string' }, folder: { type: 'string' }, out: { type: 'string' },
    question: { type: 'string' }, 'user-data-dir': { type: 'string' } } });
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
  const question = values.question?.trim() ?? fs.readFileSync(template, 'utf8').match(/^> (Review the whole folder[^\r\n]*)/m)?.[1];
  if (!question) throw new Error('Pass a nonempty --question or restore the fixed question in reading-test.md.');
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
      fs.closeSync(fs.openSync(stem + '.json', 'wx', 0o600));
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  const report = { number, ai: values.ai, platform: 'Mac', date: new Date().toISOString(), question, customQuestion: values.question !== undefined, answer: '', stepLabels: [], links: [] };
  let runDir;
  const abort = new AbortController();
  const interrupt = () => abort.abort(new Error('Run interrupted.'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const started = launch(['start', '--name', `reading-${values.ai}`, '--folder', folder, `--user-data-dir=${profile}`,
      ...(values.ai === 'opencode' ? ['--runtime-trace'] : [])]);
    runDir = field(started.stdout ?? '', 'RUN_DIR');
    const port = Number(field(started.stdout ?? '', 'PORT'));
    if (started.status !== 0 || !runDir || !port) throw new Error('dev-launch-isolated.sh start failed. Check the dev build, launch window and empty test profile.');
    const buildRoot = field(started.stdout, 'BUILD_ROOT') ?? repo;
    const version = JSON.parse(fs.readFileSync(path.join(buildRoot, 'extensions/ritemark/package.json'), 'utf8')).version;
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: buildRoot, encoding: 'utf8' });
    report.build = `${version} dev (${revision.stdout?.trim() || 'revision unavailable'})`;
    const ui = browser(port, abort.signal);
    Object.assign(report, await ask(ui, values.ai, runtime, question, report));
    const anchors = report.links;
    report.links = [];
    await tryLinks(ui, folder, facts, anchors, report.links);
    if (report.links.some((link) => link.error)) process.exitCode = 1;
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    const redact = evidenceRedactor();
    const writeReport = () => fs.writeFileSync(stem + '.json',
      JSON.stringify(report, (_key, value) => redact(value), 2) + '\n');
    if (report.failure && values.ai === 'opencode' && runDir) {
      report.failure.runtimeStderr = null;
      try {
        const trace = fs.readFileSync(path.join(runDir, 'trace', 'ritemark-acp-trace.log'), 'utf8');
        const stderr = [...trace.matchAll(/^\[[^\]\n]+\] \[stdio:stderr\] message (.+)$/gm)]
          .map(([, value]) => {
            try { return JSON.parse(value); } catch { return value; }
          });
        if (stderr.length) report.failure.runtimeStderr = stderr.join('\n');
      } catch (error) {
        if (error.code !== 'ENOENT') report.failure.runtimeStderrError = error.message;
      }
    }
    if (report.failure && values.ai === 'opencode') {
      try {
        const failureDir = stem + '-failure';
        fs.mkdirSync(failureDir, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(failureDir, 'failure.txt'), redact([
          report.error,
          ...Object.entries(report.failure).map(([name, value]) => `${name}\n${value ?? 'Unavailable'}`),
        ].join('\n\n') + '\n'), { mode: 0o600 });
        writeReport();
      } catch (error) {
        report.error += ` Could not save failure evidence: ${error.message}`;
      }
    }
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
    writeReport();
    fs.writeFileSync(stem + '.md', redact(formatRun(report)));
    if (report.error) console.error(redact(report.error));
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
