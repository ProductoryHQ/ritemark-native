# v2.0.0 Store-host publication evidence — 2026-10-22

Copied at Sprint 136's closeout from ritemark-dev `releases/v2.0.0/store-hosting-evidence.md`, the record the Development manager kept on the day.

## Candidate

- R2 bucket: `ritemark-downloads-prod`
- Object key: `windows/v2.0.0/Ritemark-Setup.exe`
- Public URL: `https://getritemark.com/windows/v2.0.0/Ritemark-Setup.exe`
- Size: `532642016` bytes
- SHA-256: `5364a56e7d1b5f8c60084f69039b344d28605b0d82b67ff9c7e6c735ade884fe`
- Content-MD5: `jieUkrh/XSXN6lG1tF7SBg==`; R2 ETag `"8e279492b87f5d25cdea51b5b45ed206"`
- Source commit: `c04eabf2fe02648bb872c6f65b6645ac5a2009f2`
- Windows workflow run: `39598992733`
- Local file: the release worktree's `dist/Ritemark-Setup.exe`, which passed Gate 2 ("windows approved"). The same bytes are the GitHub release asset (`docs/releases/v2.0.0/evidence/published-assets.txt`).

## Steps

1. **Plan.** The Development manager ran `npm run store-hosting -- plan` from the main checkout, whose scripts were identical to origin/main's. The plan hashed the full local file and found the public destination unused (`404`), so `safeToAttemptConditionalUpload: true`.
2. **Upload.** Jarmo asked for it a day before release day ("paneme juba täna r2 üles!"). He ran `scripts/publish-store-installer-interactive.sh` in his own terminal, typed the R2 credentials himself and confirmed the exact key. The upload used `If-None-Match: *` under the bucket's indefinite `windows/` lock.
3. **The uploader's own anonymous check**, at `2026-10-22T17:57:52.644Z`: `200`, 0 redirects, `application/vnd.microsoft.portable-executable`, Content-Length `532642016`, `public, max-age=31536000, immutable`, `attachment; filename="Ritemark-Setup.exe"`, Accept-Ranges `bytes`, no Location, no Set-Cookie. The SHA-256 matches.
4. **An independent anonymous check** with `npm run store-hosting -- verify`, at `2026-10-22T18:08:24.173Z`: the same results, SHA-256 `5364a56e…84fe`.

The key exists and is locked. It is never retried with other bytes or overwritten.
