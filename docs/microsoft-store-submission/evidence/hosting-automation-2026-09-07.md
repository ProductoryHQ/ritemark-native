# Installer-hosting automation — 2026-09-07

This evidence covers the repository upload tool, the v1.10.0 production publication, and the final anonymous verification.

## Implementation

- Tool: `scripts/publish-store-installer.mjs`
- S3 client: `@aws-sdk/client-s3`
- Bucket: `ritemark-downloads-prod`
- Key contract: `windows/v{VERSION}/Ritemark-Setup.exe`
- Atomic protection: `PutObject` with `If-None-Match: *`
- Service-side protection: enabled rule `windows-immutable`, prefix `windows/`, indefinite retention
- Secret handling: environment only; no secret argument, file, log, or evidence output
- Attended helper: `scripts/publish-store-installer-interactive.sh`, with hidden credential input and exact-key confirmation
- Overwrite/delete path: deliberately absent

The Windows workflow's generated `store_url` metadata was also changed from the retired `downloads.ritemark.app` host to `https://getritemark.com/windows/v{VERSION}/Ritemark-Setup.exe`.

## Local automated checks

Command:

```text
npm run test:store-hosting
```

Result: **5 passed, 0 failed**.

The tests cover versioned key generation, mandatory exact-key confirmation, complete local file hashing, public `404` enforcement, direct-response header checks, streaming SHA-256 verification, and cleanup of their local temporary directory.

## Real v1.10.0 plan

The plan command read and hashed the entire staged GitHub Release installer, then made a cache-busted anonymous `HEAD` request to the intended public destination. It performed no authenticated R2 request and no upload.

```text
bucket: ritemark-downloads-prod
key: windows/v1.10.0/Ritemark-Setup.exe
public URL: https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe
size: 430929984
SHA-256: 7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3
destination status: 404
safe to attempt conditional upload: true
```

## Remaining external checks

All hosting checks required for the v1.10.0 Store package URL passed. Store package validation, certification, and Windows test evidence are tracked separately.

## Bucket lock evidence

Cloudflare Dashboard showed the following active rule on 2026-09-07:

```text
Rule name: windows-immutable
Prefix: windows/
Lock duration: Indefinite
Status: Enabled
```

## Production credential

Jarmo created the one-year Account API token `ritemark-store-installer-publisher` with **Object Read & Write** limited to `ritemark-downloads-prod`. The Access Key ID and Secret Access Key were stored outside the repository. They were entered through the attended helper with terminal echo disabled and disappeared with the shell process after completion.

No credential value appears in the command line, terminal output, repository, or this evidence record.

## Production publication

The attended helper repeated the full local hash and unused-destination checks before accepting credentials or permitting upload. Jarmo then approved this exact external write by typing the full object key:

```text
bucket: ritemark-downloads-prod
key: windows/v1.10.0/Ritemark-Setup.exe
URL: https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe
size: 430929984
SHA-256: 7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3
R2 last-modified: 2026-09-07T11:19:26Z
```

The object was written with executable content type, attachment filename, one-year immutable cache policy, atomic `If-None-Match: *`, and the already-active indefinite `windows/` bucket lock.

## Anonymous production verification

`npm run store-hosting -- verify` streamed the exact canonical URL without authentication, a cookie jar, redirects, or a temporary output file. Result at `2026-09-07T11:22:05.152Z`:

```text
status: 200
redirects: 0
Content-Type: application/vnd.microsoft.portable-executable
Content-Length: 430929984
Cache-Control: public, max-age=31536000, immutable
Content-Disposition: attachment; filename="Ritemark-Setup.exe"
Accept-Ranges: bytes
Location: absent
Set-Cookie: absent
SHA-256: 7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3
```

TLS verification succeeded as part of the HTTPS request. A separate header request also returned HTTP 200 with the same content type and content length.

## Existing-key refusal

After publication, the same real v1.10.0 `plan` command was run again. It stopped with exit code `1` before credentials or upload:

```text
ERROR: public destination must return 404 before upload; got HTTP 200
```

This client-side refusal is additive to the atomic conditional request and service-side bucket lock. No overwrite was attempted and the public object remained unchanged.
