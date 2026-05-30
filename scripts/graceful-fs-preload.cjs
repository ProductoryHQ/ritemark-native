// Preload: patch the global fs module with graceful-fs EMFILE retry logic.
//
// Why: the Windows CI build (npx gulp vscode-win32-x64-min) packages the
// ritemark extension via vsce/yazl, which opens every file in the production
// node_modules tree with fs.createReadStream concurrently. Since
// @anthropic-ai/claude-agent-sdk@0.3.x peer-requires @modelcontextprotocol/sdk
// (which drags express/hono/ajv/jose/... into the production tree), the file
// count (~21k) exceeds the Windows per-process file-descriptor limit and yazl
// throws EMFILE. graceful-fs queues opens past the limit and retries on EMFILE,
// which fixes the packaging step. macOS has a higher fd limit and does not need
// this. Loaded via NODE_OPTIONS=--require in the gulp build step.
//
// __dirname is ritemark-native/scripts; graceful-fs lives in vscode/node_modules
// (it is a VS Code OSS build dependency, installed by `npm ci` in r/vscode).
'use strict';
const path = require('path');
const gracefulFs = require(path.join(__dirname, '..', 'vscode', 'node_modules', 'graceful-fs'));
gracefulFs.gracefulify(require('fs'));
