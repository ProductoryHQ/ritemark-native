/*! Ritemark's search worker (Sprint 148) bundles:
 * - pdf.js (pdfjs-dist 5.4.296), Copyright 2024 Mozilla Foundation, Apache License 2.0,
 *   https://www.apache.org/licenses/LICENSE-2.0 (https://github.com/mozilla/pdf.js)
 * - ignore 7.0.12, Copyright (c) 2013 Kael Zhang <i@kael.me>, contributors, MIT License (https://github.com/kaelzhang/node-ignore)
 * - marked 4.3.0, Copyright (c) 2018+, MarkedJS; Copyright (c) 2011-2018, Christopher Jeffrey, MIT License (https://github.com/markedjs/marked)
 * - Papa Parse 5.5.3, Copyright (c) 2015 Matthew Holt, MIT License (https://github.com/mholt/PapaParse)
 * The MIT License's text: https://opensource.org/license/mit
 */
/**
 * Sprint 148 (#591): the search index's own thread. Started by `SearchHost` from
 * `out/search/searchWorker.js` (its own esbuild entry), one per window, for the
 * window's project. Reading and searching never run on the extension host's
 * main thread, where the AIs' turns run (E1).
 *
 * Nothing here sends anything anywhere or writes into the project (E2): it reads
 * the project's documents, the conversation store's records and its own copies
 * in the project's storage folder, and answers the host.
 */
import { promises as fsp } from 'node:fs';
import { parentPort } from 'node:worker_threads';
import type { HostToWorkerMessage, WorkerToHostMessage } from '../protocol';
import { Indexer, type IndexerFs } from './indexer';
import { TextCache } from './textCache';

const port = parentPort;
if (!port) throw new Error('searchWorker runs only as a worker thread');

const post = (message: WorkerToHostMessage) => port.postMessage(message);
const pause = () => new Promise<void>((resolve) => setImmediate(resolve));

const fs: IndexerFs = {
  readdir: (dir) => fsp.readdir(dir, { withFileTypes: true }),
  stat: (target) => fsp.stat(target),
  readHead: async (target, maxBytes) => {
    const handle = await fsp.open(target, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
    } finally {
      await handle.close();
    }
  },
  readFile: async (target) => {
    const buffer = await fsp.readFile(target);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  },
};

let indexer: Indexer | null = null;

port.on('message', (message: HostToWorkerMessage) => {
  switch (message.type) {
    case 'init': {
      if (indexer) return;
      const { config } = message;
      indexer = new Indexer({
        fs,
        cache: new TextCache(config.cacheDir, config.cacheBytes),
        timers: {
          setTimeout: (callback, ms) => setTimeout(callback, ms),
          clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
          now: () => performance.now(),
        },
        pause,
        onStatus: (status) => post({ type: 'status', status }),
        log: (event, counts) => post({ type: 'log', event, counts }),
      });
      void indexer.start(config).catch(() => post({ type: 'log', event: 'start-failed', counts: {} }));
      return;
    }
    case 'fs-events':
      indexer?.onEvents(message.events);
      return;
    case 'rules':
      indexer?.setFilesExclude(message.filesExclude);
      return;
    case 'chats-changed':
      void indexer?.refreshChats();
      return;
    case 'tasks':
      indexer?.setTasks(message.sources);
      return;
    case 'query': {
      const answer = indexer
        ? indexer.query(message.queryId, message.text, message.options, message.perKind, message.expand)
        : { queryId: message.queryId, layer: 'words' as const, tooShort: false, groups: [], reading: null, limited: false, tooLarge: 0, tookMs: 0 };
      post({ type: 'answer', requestId: message.requestId, answer });
      return;
    }
    case 'passages':
      post({ type: 'passages', requestId: message.requestId, passages: indexer?.index.passages(message.words, message.limit) ?? [] });
      return;
    case 'map':
      post({ type: 'map', requestId: message.requestId, entries: indexer?.index.map() ?? [] });
      return;
    case 'stats':
      if (indexer) post({ type: 'stats', requestId: message.requestId, stats: indexer.stats(process.memoryUsage().heapUsed) });
      return;
  }
});
