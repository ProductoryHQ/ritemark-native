// Preload: make the Windows CI build resilient to EMFILE ("too many open files").
//
// Two layers, because the build hits the Windows per-process fd limit through
// two different fs APIs:
//
//   1. graceful-fs.gracefulify() — queues/retries the LEGACY callback + sync fs
//      API (fs.createReadStream, fs.open, fs.readFile-callback, ...). This covers
//      yazl, which streams every file of the ritemark extension's production
//      node_modules tree when packaging the .vsix.
//
//   2. An EMFILE backoff wrapper on fs.promises.* — graceful-fs 4.x DELIBERATELY
//      does not patch the promise API. But `gulp vscode-win32-x64-min` processes
//      all ~107 built-in VS Code extensions concurrently via vsce.listFiles(),
//      which reads each extension's .vscodeignore through fs.promises.readFile
//      (@vscode/vsce package.js). With ritemark's ~17k-file node_modules tree
//      scanned at the same time, the unqueued promise opens blow past the Windows
//      fd limit -> EMFILE on a random extension's .vscodeignore (v1.7.3: powershell).
//      v1.7.2 passed by the barest margin; adding one production dep (ACP SDK,
//      +34 files) was enough to cross the threshold. macOS has a high fd limit and
//      never reproduces this.
//
// Loaded via NODE_OPTIONS=--require in the Windows gulp build step.
// __dirname is ritemark-native/scripts; graceful-fs lives in vscode/node_modules
// (a VS Code OSS build dependency, installed by `npm ci` in r/vscode).
'use strict';
const path = require('path');

// --- Layer 1: legacy fs API ------------------------------------------------
const gracefulFs = require(path.join(__dirname, '..', 'vscode', 'node_modules', 'graceful-fs'));
gracefulFs.gracefulify(require('fs'));

// --- Layer 2: fs.promises API ----------------------------------------------
// require('fs').promises and require('fs/promises') are the same object in
// Node.js, so mutating these methods in place covers both access patterns.
// Wrap the read/open-side methods that open file descriptors under concurrency.
const fsPromises = require('fs').promises;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withEmfileRetry(fn) {
  return function (...args) {
    const deadline = Date.now() + 60000; // match graceful-fs's 60s patience
    let delay = 10;
    const attempt = () =>
      fn.apply(fsPromises, args).catch((err) => {
        if (err && (err.code === 'EMFILE' || err.code === 'ENFILE') && Date.now() < deadline) {
          return sleep(delay).then(() => {
            delay = Math.min(Math.round(delay * 1.2), 100);
            return attempt();
          });
        }
        throw err;
      });
    return attempt();
  };
}

for (const method of ['open', 'readFile', 'readdir', 'opendir', 'stat', 'lstat', 'copyFile', 'realpath']) {
  if (typeof fsPromises[method] === 'function') {
    const orig = fsPromises[method];
    fsPromises[method] = withEmfileRetry(orig);
  }
}
