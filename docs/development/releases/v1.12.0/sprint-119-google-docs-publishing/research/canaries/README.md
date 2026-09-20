# Sprint 119 Phase 0 canaries

Disposable research scripts that produced the measurements in [integration-decisions.md](../integration-decisions.md). They are **not product code**, nothing imports them, and they must not grow into the implementation. They are kept so the evidence can be re-run and argued with.

No credential is stored here. The canary client's secret and the tokens lived only in the session scratch directory, mode 0600, and the grant was revoked when the session ended.

## What each script does

| Script | Purpose |
|---|---|
| `oauth-canary.mjs` | the installed-app loopback flow: PKCE, `state`, an ephemeral `127.0.0.1` listener, code exchange, refresh, revoke |
| `drive-canary.mjs` | Drive and Docs behaviour: `about` formats, Markdown import, metadata, export, same-ID update, `files.copy`, `documents.get`, delete |
| `inspect-doc.mjs` | reads a created document back through the Docs API and probes it for comments, scripts, fonts and inline image objects |
| `docx/make-docx.mts` | runs Ritemark's real `exportToWordV2` outside the extension host, to measure the DOCX candidate with the code we would reuse |
| `docx/entity-test.mts` | the minimal reproduction of the entity-decoding defect in the Word exporter |
| `fixtures/corpus.md` | the fidelity corpus: headings, inline styles, code, lists, quotes, table, images, unsafe markup, a Ritemark comment, Unicode |
| `evidence/` | Markdown exported back out of Google after each import path, i.e. the round trips the write-up quotes |

## Re-running them

```bash
cd <scratch>/canary
node oauth-canary.mjs start          # prints REDIRECT_URI and AUTH_URL
# open AUTH_URL in a browser signed in as a test user, approve
node oauth-canary.mjs exchange       # needs .canary-secret next to the script
node drive-canary.mjs import fixtures/corpus.md
```

`CANARY_CLIENT_ID` and `CANARY_CLIENT_SECRET` override the defaults; `CANARY_NO_SECRET=1` reproduces the refusal that proves a desktop client must send its secret.

The DOCX canary needs one extra step, because the exporter imports `vscode`:

```bash
cd extensions/ritemark && npm ci
mkdir -p node_modules/vscode   # then copy docx/vscode-stub.mjs contents into
                               # node_modules/vscode/index.js as CommonJS, with
                               # a package.json naming index.js as main
npx tsx <scratch>/canary/docx/make-docx.mts fixtures/corpus.md out.docx
```

The stub lives in that throwaway `node_modules` on purpose and is deleted afterwards, so nothing in the repository pretends to be the VS Code API. The ESM `hooks.mjs` / `hooks-register.mjs` pair is kept because it is the cleaner route if the exporter ever loads as ESM.

## Known gaps in what was measured

Windows, the cancel/timeout/port-collision matrix, the Picker template grant, Mermaid diagrams, per-image size limits, and the native mapper beyond a small sample. The DOCX run fed the exporter `marked`'s HTML rather than TipTap's, so its structural results need one re-run before the fidelity matrix is frozen.
