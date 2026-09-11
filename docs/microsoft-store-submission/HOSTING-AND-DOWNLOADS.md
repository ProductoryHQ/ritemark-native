# Installer hosting and downloads

Last HTTP/TLS recheck: **2026-09-11**. Dashboard configuration verified 2026-09-07; v1.10.1 full download/hash verified 2026-09-10.

## Current status

| Layer | Configuration | State |
|---|---|---|
| Domain and authoritative DNS | Cloudflare-managed `getritemark.com` | Active; public A and AAAA answers verified |
| Object storage | Cloudflare R2 bucket `ritemark-downloads-prod`, Standard storage, Eastern Europe | Active |
| Public route | R2 custom domain `getritemark.com` | Enabled |
| TLS | Minimum TLS 1.2; Cloudflare-managed certificate | Valid certificate and TLS 1.3 connection verified |
| Development URL | Bucket `r2.dev` hostname | Disabled |
| Safe probe | `/probe/hosting-test-v1.txt` | Passed end to end; removed after verification |
| Production installer | `/windows/v1.10.1/Ritemark-Setup.exe` | Published; exact fresh-download size and SHA-256 verified |
| Guarded upload tooling | `scripts/publish-store-installer.mjs` | Implemented; tests, production publish, verification, and existing-key refusal pass |
| Production upload credential | One-year, bucket-scoped R2 Account API token | Created; held by Jarmo outside the repository |
| Production immutability | `windows-immutable`, prefix `windows/`, indefinite retention | Active and verified in Cloudflare Dashboard |

The hosting system passed its production acceptance checks on 2026-09-07. This does not by itself authorize Partner Center submission.

## Architecture

`getritemark.com` is a Cloudflare zone and an R2 custom domain for the `ritemark-downloads-prod` bucket. Cloudflare owns the proxied, read-only DNS record that connects the apex hostname to R2 and manages the public certificate. No Worker, Pages project, VM, origin server, Azure Front Door, HTML download page, or login layer is in the request path.

The bucket root is not a website and does not expose a directory listing. Requests succeed only when they address an existing object key.

## Immutable object-key contract

Production Windows installers use this exact shape:

```text
windows/v{VERSION}/Ritemark-Setup.exe
```

For v1.10.0 the final URL is:

```text
https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe
```

Rules:

1. A new build always gets a new version or candidate URL.
2. Before upload, check that the destination returns `404`. A `200` response is a hard stop.
3. Upload only the release-approved file whose local SHA-256 and size match the candidate record.
4. After upload, download without cookies or credentials and compare the fresh SHA-256 and byte length.
5. After Microsoft receives a URL, never overwrite or delete that object.
6. Credentials live in the operator's protected environment or CI secret store, never in this repository.
7. Keep temporary probes outside `windows/`; remove their complete test prefix immediately after verification with explicit approval, then confirm every former test URL returns `404`.

## Upload procedure

The commands below document the original v1.10.0 publication and must not be rerun to replace it. Both v1.10.0 and v1.10.1 keys already exist: `plan` must refuse them. For a future build, supply its new version/candidate key and approved size/hash. Run dependency setup only at repository root; publishing does not require the VS Code development dependencies.

The v1.10.0 installer is larger than the Cloudflare Dashboard's 300 MB browser-upload limit. Production upload therefore uses Cloudflare R2's S3-compatible API through [`scripts/publish-store-installer.mjs`](../../scripts/publish-store-installer.mjs). The script uses an atomic `PutObject` request with `If-None-Match: *`; R2 returns `412 PreconditionFailed` instead of replacing an existing object.

One-time setup:

1. Create an R2 Account API token named `ritemark-store-installer-publisher`.
2. Grant only **Object Read & Write**, restricted to the single bucket `ritemark-downloads-prod`.
3. Store the Access Key ID and Secret Access Key in the operator's password manager. Do not save them in this repository, a `.env` file, shell history, logs, or evidence.
4. Add the bucket lock rule `windows-immutable` with prefix `windows/` and indefinite retention.
5. Confirm in the dashboard that the rule is enabled before the first production upload.

The current token has a one-year TTL from 2026-09-07. Rotate it before expiry, update the password-manager entry, and revoke the old token after the replacement has passed a read-only authentication check. Token rotation does not change public URLs or stored objects.

For each installer, load the three credential values into an ephemeral shell environment without placing the secret in the command line. Then run the non-mutating plan first:

```bash
npm ci
npm run store-hosting -- plan \
  --version 1.10.0 \
  --file /absolute/path/to/Ritemark-Setup.exe \
  --size 430929984 \
  --sha256 7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3
```

The plan hashes the entire local file and requires a cache-busted public `404` for the destination. It does not access R2 credentials or upload anything.

After an operator confirms the exact bucket, key, file, size, and hash, publish with the exact confirmation key:

```bash
npm run store-hosting -- publish \
  --version 1.10.0 \
  --file /absolute/path/to/Ritemark-Setup.exe \
  --size 430929984 \
  --sha256 7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3 \
  --confirm-key windows/v1.10.0/Ritemark-Setup.exe
```

`publish` repeats the local identity and public `404` checks, performs an authenticated R2 `HeadObject`, and makes the conditional upload. It sets a binary content type, attachment filename, and `public, max-age=31536000, immutable` cache policy. It then streams a fresh anonymous download directly into SHA-256 verification without leaving another installer file on disk. Unset the credential environment variables immediately afterwards.

For an attended release from Codex, prefer [`scripts/publish-store-installer-interactive.sh`](../../scripts/publish-store-installer-interactive.sh). It runs the same plan first, reads all three credential values with terminal echo disabled, displays the exact pending external change, and requires the operator to type the full object key before invoking `publish`. The credential variables are unset on exit and are never written to disk or shell history.

The Cloudflare references supporting this implementation are the [R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/), [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [R2 authentication](https://developers.cloudflare.com/r2/api/tokens/), and [bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/).

The approved v1.10.0 source asset is the GitHub Release file `Ritemark-Setup.exe`, size `430929984` bytes, SHA-256 `7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3`. A fresh source download matched both values on 2026-09-07. Those exact bytes were published to the locked R2 key and independently downloaded again from the final public URL with the same size and SHA-256.

## Current Store candidate

v1.10.1 candidate 3 is hosted at `https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe`, 436614200 bytes, SHA-256 `93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250`. See [candidate record](./release-candidates/v1.10.1-candidate-3.md). v1.10.0 remains immutable but is superseded for Store submission.

## Verification commands

Run these from a clean shell without a cookie jar or authenticated proxy:

```bash
npm run store-hosting -- verify \
  --version 1.10.0 \
  --size 430929984 \
  --sha256 7ada28ad639eb798205a13f22bf1f9844e1856e032737c924738c1b8033232f3

curl -sS --max-redirs 0 --dump-header headers.txt --output Ritemark-Setup.downloaded.exe --write-out 'status=%{http_code}\nredirects=%{num_redirects}\ncontent_type=%{content_type}\nsize_download=%{size_download}\nssl_verify=%{ssl_verify_result}\n' https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe
shasum -a 256 Ritemark-Setup.downloaded.exe
```

Acceptance requires HTTP `200`, zero redirects, successful TLS verification, `Content-Type: application/vnd.microsoft.portable-executable`, `Content-Length: 430929984`, no `Location` or `Set-Cookie` header, and the approved SHA-256. Remove the manual verification download after recording its hash.

## Rollback and failure handling

- DNS or certificate failure: disable the custom-domain route only as an emergency outage action; do not change or delete stored installer bytes.
- Upload fails before the object becomes public: rerun `plan`; retry the conditional upload only if both public and authenticated destination checks still report the key as absent.
- Credential is lost, exposed, or expired: revoke it, create a replacement with the same one-bucket scope, and run a read-only destination check before the next release. Stored objects and public URLs do not depend on that credential.
- Wrong bytes at an unused, not-yet-submitted key: leave the locked key untouched and publish the corrected candidate at a new version/candidate URL. There is deliberately no overwrite or delete mode in the repository tool.
- Wrong bytes at a URL already supplied to Microsoft: do not replace them. Withdraw or amend the submission and publish a new candidate at a new URL.
- R2 outage: retain the GitHub Release asset as the verified source of truth. Do not silently redirect the Store URL to bytes whose hash has not been reverified.

## Ownership

| Responsibility | Owner |
|---|---|
| Domain registration, Cloudflare account, and billing | Jarmo |
| DNS, R2 custom-domain configuration, and certificate checks | Release operator, approved by Jarmo |
| Windows candidate identity, size, and SHA-256 | Release manager plus Jarmo |
| Upload credential custody | Jarmo or an explicitly designated release operator |
| Final anonymous download and Store hash evidence | Release operator; Jarmo approves the exact hash |

## Evidence

The safe end-to-end probe and its subsequent cleanup are recorded in [`evidence/hosting-probe-2026-09-07.md`](./evidence/hosting-probe-2026-09-07.md). No probe objects remain in the bucket. The guarded-tooling, production publish, existing-key refusal, and v1.10.0 verification results are in [`evidence/hosting-automation-2026-09-07.md`](./evidence/hosting-automation-2026-09-07.md). The release-specific identity is recorded in [`release-candidates/v1.10.0-candidate-1.md`](./release-candidates/v1.10.0-candidate-1.md).
