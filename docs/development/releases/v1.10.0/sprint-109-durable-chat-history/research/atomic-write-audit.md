# Sprint 109 Atomic Write Audit

**Date:** 2026-08-22
**Harness:** `research/run-atomic-store-audit.mjs`
**Fixture matrix:** `research/fixtures/atomic-failures.json`

## Selected write contract

1. Serialize all mutations inside one extension host.
2. Write a same-directory uniquely named temp file and close it.
3. Rename temp over the target record.
4. Only after record commit, write+rename the best-effort index.
5. On startup and index mismatch, reconcile `records/*.json` with the index.
6. Ignore stale temp files during listing; report/clean them only after their age
   proves they are not an active writer.
7. Quarantine corrupt original bytes by rename before rebuilding metadata.

Same-directory temp files ensure a same-volume rename. The central index is not a
transaction coordinator: record files are canonical, which prevents an index
failure or concurrent no-folder windows from hiding committed conversations.

## macOS execution

Executed locally on macOS with Node `v22.21.1`: **6/6 checks passed**.

| Harness check | Result |
|---|---|
| Rename over an existing record | Complete revision 2 replaced revision 1 |
| Injected failure before record rename | Prior target remained complete; stale temp remained separately detectable |
| Record committed before injected index failure | Directory reconciliation discovered the record absent from the old index |
| Corrupt index quarantine and rebuild | Original corrupt bytes retained and valid IDs rebuilt |
| Corrupt record isolation | Valid records remained enumerable |
| Windows URI case/order reference model | Equivalent drive/path case and folder order normalized identically |

## Windows semantics review

The repository pins VS Code OSS commit `10c8e557c8b9f9ed0a87f61f1c9a44bde731c409`.
Its disk provider validates overwrite and calls `Promises.rename`; the pinned
`pfs.ts` implementation uses `fs.promises.rename` and retries Windows
`EACCES`/`EPERM`/`EBUSY` failures. File-over-file is explicitly accepted by
`validateMoveCopy`. Temp and target remain in the same directory, so the
cross-device copy/delete fallback is not expected.

Phase 0 therefore freezes the API contract and failure fixtures. A real Windows
runner must execute the same overwrite/failure/quarantine store tests before
Sprint 109 is declared QA-complete; source inspection is not represented as a
native NTFS execution result.

The pure Windows URI model in the harness proves case folding and folder-order
stability independent of the host OS. Phase 1 will turn the same cases into
`projectScope.test.ts` tests, and Phase 6 will run them on Windows CI.

## Failure decisions

| Failure point | Authoritative outcome | User/runtime behavior |
|---|---|---|
| Record temp write | Previous target remains | Send is blocked; visible Retry |
| Record rename | Previous target remains; stale temp ignored | Send is blocked; visible Retry |
| Index temp/rename after record commit | New record remains canonical; index is rebuilt/reconciled | Send may proceed because accepted turn is durable |
| Corrupt index | Original bytes quarantined; records scanned | Valid list remains available with diagnostics |
| One corrupt record | Original bytes quarantined; known metadata may show damaged row | Other rows remain available; no ghost replacement |
| Quarantine rename failure | Do not overwrite/delete corrupt source | Degraded diagnostics; continue listing other independently valid records |

The store must never log-only a failed pre-dispatch record write. It returns a
typed storage error to the controller, which does not call `runtime.prompt()`.
