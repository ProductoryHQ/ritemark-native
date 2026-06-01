# npm-stubs — peer-dependency stubs for claude-agent-sdk

These tiny local packages stand in for two peerDependencies that
`@anthropic-ai/claude-agent-sdk@0.3.x` declares but **bundles inline** and does
not load at runtime:

- `@anthropic-ai/sdk`
- `@modelcontextprotocol/sdk`

## Why they exist

`@modelcontextprotocol/sdk@1.29.0` drags a large server-transport subtree
(express, hono, @hono/node-server, jose, cors, eventsource, … ~80 packages,
thousands of files) into the production dependency tree. During the Windows
extension-packaging step (`gulp vscode-win32-x64-min`), VS Code's build opens
every production file with `fs.createReadStream`; the file count tipped the
Windows runner over its per-process file-descriptor limit → `EMFILE`.

We cannot simply drop the two SDKs: VS Code's build runs
`npm ls --all --omit=dev --parseable` (build/lib/dependencies.ts) and fails with
ELSPROBLEMS if claude-agent-sdk's declared peers are missing. That check reads
the peer requirement from npm's resolved tree (including the hidden
`node_modules/.package-lock.json`), so patching the installed manifest is not
enough.

## How they work

`extensions/ritemark/package.json` points these two names at `file:` paths here.
`npm ci` installs them as the named packages at peer-satisfying versions
(`@anthropic-ai/sdk@0.100.1`, `@modelcontextprotocol/sdk@1.29.0`), so
`npm ls --all` is satisfied — but they carry **no dependencies**, so the heavy
subtree is never installed or packaged.

The only runtime pieces claude-agent-sdk actually needs from that subtree are
`ajv` and `ajv-formats` (its bundled code does `require("ajv/dist/runtime/*")`),
which are declared as real direct dependencies in package.json.

The stub `index.js` exports an empty object as defensive insurance; nothing in
claude-agent-sdk's bundle or Ritemark's code requires these modules at runtime.

## If you bump @anthropic-ai/claude-agent-sdk

Re-check its `peerDependencies` versions and update the stub `version` fields to
stay within the declared ranges, then regenerate the lockfile with
`npm install --legacy-peer-deps`. If a future SDK actually starts loading these
packages at runtime, replace the stubs with the real dependencies.
