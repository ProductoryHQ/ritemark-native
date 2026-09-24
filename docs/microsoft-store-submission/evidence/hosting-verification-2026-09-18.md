# v1.11.0 Store-hosting verification — 2026-09-18

## Object identity

| Field | Value |
|---|---|
| Bucket | `ritemark-downloads-prod` |
| Object key | `windows/v1.11.0/Ritemark-Setup.exe` |
| Public URL | `https://getritemark.com/windows/v1.11.0/Ritemark-Setup.exe` |
| Size | `444207592` bytes |
| SHA-256 | `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b` |
| R2 ETag | `"215bc154378ab2bf8ab4cce863ebaf9d"` |

The interactive repository publisher uploaded the approved local file with the exact confirmed key. The object now exists and must never be retried with different bytes or overwritten. The bucket's indefinite `windows/` lock and the publisher's `If-None-Match: *` condition provide independent overwrite protection.

## Anonymous public response

A fresh request after the upload completed returned:

```text
HTTP/2 200
content-type: application/vnd.microsoft.portable-executable
content-length: 444207592
content-disposition: attachment; filename="Ritemark-Setup.exe"
etag: "215bc154378ab2bf8ab4cce863ebaf9d"
accept-ranges: bytes
cache-control: public, max-age=31536000, immutable
```

There was no redirect, login, HTML confirmation page, or authenticated session. Cloudflare served the object over valid HTTPS. The repository's anonymous streaming verifier completed without error against the expected size and SHA-256; it would exit non-zero on an HTTP, size, or hash mismatch.

An immediate post-upload check initially returned `404` while the long-running upload was still completing. The same exact URL returned the successful response above after completion. No second object and no replacement upload were attempted.

## Result

The v1.11.0 URL meets the Store package-hosting contract: direct HTTPS, exact content length, executable content type, immutable caching, anonymous access, and a fresh-download SHA-256 matching the approved installer.
