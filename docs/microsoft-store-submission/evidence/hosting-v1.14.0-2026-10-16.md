# v1.14.0 Store-host publication evidence — 2026-10-16

## Candidate

- R2 bucket: `ritemark-downloads-prod`
- Object key: `windows/v1.14.0/Ritemark-Setup.exe`
- Public URL: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`
- Size: `475059168` bytes
- SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`
- Source commit: `ed0b6226863759da109f396f50dee51226c69468`
- Windows workflow run: `38565576037`

Before upload, the guarded `plan` hashed the complete local GitHub Release asset and required the public destination to return `404`. The attended uploader required the operator to type the complete object key. It uses Content-MD5, `If-None-Match: *`, and the bucket's indefinite `windows/` lock.

## Anonymous post-upload verification

Checked at `2026-10-16T17:03:34.262Z` (`2026-10-16 20:03` Europe/Tallinn) through `npm run store-hosting -- verify` without credentials, cookies, or a prior session.

| Check | Result |
|---|---|
| HTTP status | `200` |
| Redirects | `0` |
| TLS verification | Passed; the HTTPS fetch completed without an override |
| Content-Type | `application/vnd.microsoft.portable-executable` |
| Content-Length | `475059168` |
| Cache-Control | `public, max-age=31536000, immutable` |
| Content-Disposition | `attachment; filename="Ritemark-Setup.exe"` |
| Accept-Ranges | `bytes` |
| Location | Absent |
| Set-Cookie | Absent |
| Fresh-download SHA-256 | `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48` |

The verifier streamed the complete public response directly through SHA-256. It did not leave a second installer copy behind.

## Fresh pre-submit verification — 2026-10-17

The public URL was downloaded anonymously again immediately before the submission approval boundary. The initial connection was reset by the network, so its partial hash was discarded. A new temporary download was resumed from the server's advertised byte range until the exact `475059168`-byte length was present. The initial and resumed responses exposed the same ETag, `"2bf534053f50f409b9dd7734eb1cae82"`.

Completed at approximately `2026-10-17T04:41Z` (`2026-10-17 07:41` Europe/Tallinn).

| Check | Result |
|---|---|
| Initial HTTP status | `200` |
| Resume HTTP status | `206`, `Content-Range: bytes 450707357-475059167/475059168` |
| Redirects | `0` |
| TLS verification | Passed; `ssl_verify=0` |
| Content-Type | `application/vnd.microsoft.portable-executable` |
| Final local length | `475059168` bytes |
| Cache-Control | `public, max-age=31536000, immutable` |
| Location | Absent |
| Set-Cookie | Absent |
| Fresh-download SHA-256 | `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48` |

Only the completed file's SHA-256 is evidence. The discarded partial-stream hash is intentionally not a candidate identity. The temporary download was removed after recording these results.

## Post-submission recheck — 2026-10-17

After Partner Center accepted the submission, an anonymous request and a new complete download were run without a session or cookie jar:

- HTTP: `200`
- `Content-Type`: `application/vnd.microsoft.portable-executable`
- `Content-Length`: `475059168`
- `Cache-Control`: `public, max-age=31536000, immutable`
- ETag: `"2bf534053f50f409b9dd7734eb1cae82"`
- downloaded size: `475059168` bytes
- SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`

This confirms that the submitted public URL still serves the approved immutable bytes.

## Immutability check

After publication, the same guarded `plan` was run again with the exact local file, size, and SHA-256. It stopped before any authenticated R2 operation with:

```text
ERROR: public destination must return 404 before upload; got HTTP 200
```

This is the expected refusal. Do not overwrite or delete the object. Any different installer must use a new versioned URL and a new candidate record.
