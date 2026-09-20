# Sprint 119 Phase 0 canaries

Disposable research scripts that produced the measurements in [integration-decisions.md](../integration-decisions.md). They are **not product code**, nothing imports them, and they must not grow into the implementation. They are kept so the evidence can be re-run and argued with.

No credential is stored here. The canary client's secret and the tokens lived only in the session scratch directory, mode 0600, and the grant was revoked when the session ended.

## What each script does

| Script | Purpose |
|---|---|
| `oauth-canary.mjs` | the installed-app loopback flow: PKCE, `state`, an ephemeral `127.0.0.1` listener, code exchange, refresh, revoke |
| `drive-canary.mjs` | Drive and Docs behaviour: `about` formats, Markdown import, metadata, export, same-ID update, `files.copy`, `documents.get`, delete |
| `inspect-doc.mjs` | reads a created document back through the Docs API and probes it for comments, scripts, fonts and inline image objects |
| `docs-mapper.mts` | the chosen adapter: Markdown -> Docs API, in four passes. Run it with a template id as the second argument to publish into a template copy |
| `docx/make-docx.mts` | runs Ritemark's real `exportToWordV2` outside the extension host, to measure the DOCX candidate with the code we would reuse |
| `docx/image-probe.mts`, `docx/image-html-probe.mts` | why a local image survives one HTML shape and not another |
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

## Reading the mapper

`docs-mapper.mts` is research code, but its structure is the part worth keeping: one `insertText` with placeholders, then only length-neutral styling, then placeholder-located inserts applied last-first, then table cells last cell first. Every index bug this path can have lives in that ordering, so the product implementation should keep the same four passes rather than invent its own.

## Known gaps in what was measured

Windows, the cancel/timeout/port-collision matrix, the Picker template grant, Mermaid diagrams, per-image size limits, and a Sync that rewrites an existing document through the mapper rather than creating a new one.

Every run here fed the pipeline `marked`'s HTML, not TipTap's. That difference already showed its teeth once: `marked` wraps an image in a `<p>`, and the Word exporter drops an image in that position while keeping one at block level. Before the fidelity matrix is frozen, the corpus needs one pass through real editor HTML.
