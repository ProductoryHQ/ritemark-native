#!/usr/bin/env node
/**
 * search-measure.mjs - M1 and M3 for Sprint 148's search index, on the folder search-fixture.mjs writes.
 *
 * Usage: node scripts/qa/search-measure.mjs --fixture <dir> [--cache <dir>] [--queries 200] [--json <file>]
 *
 * Starts the built worker (extensions/ritemark/out/search/searchWorker.js; run `npm run compile` in
 * extensions/ritemark first) in a worker thread with the host's heap cap, as SearchHost does, and talks to it
 * over the same protocol (src/search/protocol.ts). It measures:
 *
 * - M1, the cold index (the copies' folder emptied first): the walk, every name listed, Markdown and CSV read,
 *   Word and PDF read, ready; the worker's heap at its peak. Then a warm start that finds decision 3's copies.
 * - M3, this thread's event-loop delay while the worker reads: the host's side of the work (messages in and out),
 *   with a query every 100 ms during the read, as someone typing would send.
 * - The worker's own query time once the index is read (E1: at most 15 ms at the 95th percentile), and the round trip.
 *
 * Prints counts and timings only. The copies go to --cache (default: a folder under /private/tmp, removed after);
 * it is emptied first, so it must be under /private/tmp or the system temp folder.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.resolve(here, '../../extensions/ritemark/out/search/searchWorker.js');

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
}

const fixture = path.resolve(arg('fixture', '/private/tmp/ritemark-search-fixture'));
const cacheDir = path.resolve(arg('cache', '/private/tmp/ritemark-search-measure-cache'));
// The copies' folder is emptied before the cold run: only ever one under /private/tmp or the system temp folder.
const tmp = fs.realpathSync(os.tmpdir());
if (!cacheDir.startsWith('/private/tmp/') && !cacheDir.startsWith(`${tmp}${path.sep}`)) {
  console.error(`--cache must be under /private/tmp or ${tmp}: it is emptied first`);
  process.exit(2);
}
const queryCount = Number(arg('queries', '200'));
const jsonOut = arg('json', null);

// DEFAULT_SEARCH_LIMITS in src/search/protocol.ts; SEARCH_WORKER_HEAP_MB and SEARCH_CACHE_BYTES in SearchHost.ts.
const LIMITS = {
  maxDocuments: 20_000,
  maxNames: 100_000,
  markdownBytes: 10 * 1024 * 1024,
  csvBytes: 10 * 1024 * 1024,
  docxBytes: 50 * 1024 * 1024,
  pdfBytes: 50 * 1024 * 1024,
  textPerDocument: 2 * 1024 * 1024,
  textBudget: 80 * 1024 * 1024,
  // (chats, not in this folder, may take a quarter of the text budget: CHAT_SHARE in indexer.ts)
  textPerChat: 1024 * 1024,
};
const HEAP_MB = 512;
/**
 * monitorEventLoopDelay records each whole interval between its timer's ticks, so an idle loop sampled every
 * 10 ms reads about 12 ms. The delay reported is the interval less the resolution, beside an idle baseline.
 */
const RESOLUTION_MS = 10;
const delayOf = (histogram) => {
  const ms = (ns) => round(Math.max(0, ns / 1e6 - RESOLUTION_MS));
  return { p50: ms(histogram.percentile(50)), p95: ms(histogram.percentile(95)), p99: ms(histogram.percentile(99)), max: ms(histogram.max) };
};

function idleBaseline() {
  return new Promise((resolve) => {
    const histogram = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
    histogram.enable();
    setTimeout(() => {
      histogram.disable();
      resolve(delayOf(histogram));
    }, 2000);
  });
}

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const round = (value) => (value === null ? null : Math.round(value * 10) / 10);

/** Words to type: taken from the fixture's own Markdown, so the queries hit. */
function sampleWords() {
  const words = [];
  const visit = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (words.length > 4000) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'build') continue;
      const target = path.join(dir, entry.name);
      if (entry.isDirectory() && depth < 3) visit(target, depth + 1);
      else if (entry.name.endsWith('.md')) words.push(...(fs.readFileSync(target, 'utf8').match(/[\p{L}\p{N}]{3,}/gu) ?? []));
    }
  };
  visit(fixture, 0);
  return words;
}

let seed = 7;
const random = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

function queryText(words) {
  const count = 1 + Math.floor(random() * 3);
  const typed = [];
  for (let i = 0; i < count; i++) {
    const word = words[Math.floor(random() * words.length)];
    typed.push(word.slice(0, Math.max(2, Math.min(word.length, 2 + Math.floor(random() * 6)))));
  }
  return typed.join(' ');
}

function run(label, words) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const worker = new Worker(bundle, { resourceLimits: { maxOldGenerationSizeMb: HEAP_MB }, stdout: true, stderr: true });
    worker.stdout.resume();
    worker.stderr.resume();
    const delay = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
    delay.enable();
    let requestId = 0;
    let queryId = 0;
    const pending = new Map();
    const request = (message) =>
      new Promise((done) => {
        const id = ++requestId;
        pending.set(id, { done, sent: performance.now() });
        worker.postMessage({ ...message, requestId: id });
      });
    const query = (text) =>
      request({ type: 'query', queryId: ++queryId, text, options: { matchCase: false, wholeWords: false, kinds: ['document', 'chat', 'task'] }, perKind: 5 });
    let heapPeak = 0;
    let firstReading = null;
    let readyAt = null;
    const duringRead = [];
    let typing = null;
    let polling = null;

    worker.on('message', async (message) => {
      if (message.type === 'status') {
        if (message.status.state === 'reading' && firstReading === null) {
          firstReading = performance.now() - started;
          typing = setInterval(async () => {
            const answer = await query(queryText(words));
            duringRead.push(answer.roundTrip);
          }, 100);
        }
        if (message.status.state === 'ready' && readyAt === null && message.status.documents.total > 0) {
          readyAt = performance.now() - started;
          clearInterval(typing);
          clearInterval(polling);
          delay.disable();
          const hostDelay = delayOf(delay);
          const after = [];
          const workerMs = [];
          let hits = 0;
          for (let i = 0; i < queryCount; i++) {
            const answer = await query(queryText(words));
            after.push(answer.roundTrip);
            workerMs.push(answer.answer.tookMs);
            if (answer.answer.groups.length > 0) hits++;
          }
          const stats = (await request({ type: 'stats' })).stats;
          heapPeak = Math.max(heapPeak, stats.heapUsedBytes);
          await worker.terminate();
          resolve({
            label,
            readyMs: round(readyAt),
            workerTimings: stats.timings,
            documents: stats.documents,
            withText: stats.withText,
            terms: stats.terms,
            textMB: round(stats.textChars / 1e6),
            heapPeakMB: round(heapPeak / 1e6),
            cache: stats.cache,
            hostDelayMs: hostDelay,
            queriesDuringRead: { count: duringRead.length, p50: round(percentile(duringRead, 50)), p95: round(percentile(duringRead, 95)), max: round(Math.max(0, ...duringRead)) },
            queriesAfter: {
              count: after.length,
              withResults: hits,
              workerP50: round(percentile(workerMs, 50)),
              workerP95: round(percentile(workerMs, 95)),
              workerMax: round(Math.max(...workerMs)),
              roundTripP50: round(percentile(after, 50)),
              roundTripP95: round(percentile(after, 95)),
            },
          });
        }
        return;
      }
      if (message.type === 'log') return;
      const entry = pending.get(message.requestId);
      if (!entry) return;
      pending.delete(message.requestId);
      if (message.type === 'stats') heapPeak = Math.max(heapPeak, message.stats.heapUsedBytes);
      entry.done({ ...message, roundTrip: performance.now() - entry.sent });
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (readyAt === null) reject(new Error(`worker exited (${code}) before it was ready`));
    });
    polling = setInterval(() => void request({ type: 'stats' }), 250);
    worker.postMessage({
      type: 'init',
      config: {
        roots: [{ path: fixture, name: path.basename(fixture) }],
        filesExclude: { [fixture]: ['**/.ritemark', '**/.claude/worktrees'] },
        platform: process.platform,
        oneDriveRoots: [],
        cacheDir,
        cacheBytes: 200 * 1024 * 1024,
        chats: null,
        limits: LIMITS,
      },
    });
  });
}

async function main() {
  if (!fs.existsSync(bundle)) throw new Error(`no worker bundle at ${bundle}: run npm run compile in extensions/ritemark`);
  if (!fs.existsSync(fixture)) throw new Error(`no fixture at ${fixture}: run scripts/qa/search-fixture.mjs`);
  fs.rmSync(cacheDir, { recursive: true, force: true });
  const words = sampleWords();
  const idleHostDelayMs = await idleBaseline();
  const cold = await run('cold', words);
  const warm = await run('warm', words);
  const result = { node: process.version, platform: `${process.platform}-${process.arch}`, fixture: path.basename(fixture), idleHostDelayMs, cold, warm };
  console.log(JSON.stringify(result, null, 2));
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
  if (!arg('cache', null)) fs.rmSync(cacheDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
