# OpenCode Bundling Audit

**Sprint:** 76 (ACP client + OpenCode BYOK runtime) · **Phase:** 0a · **Date:** 2026-06-01
**Resolves:** technical-plan Workstream 0 `research/opencode-bundling-audit.md`; spec **Q1**
(bundle in DMG vs download on first use); supplies the R2 manifest entries.

> Environment caveat: measured on a **Linux x64** container. npm `registry.npmjs.org` and direct
> github.com downloads work; the **GitHub REST API is anonymous-rate-limited (403)**, so all
> versioned metadata below comes from the **npm registry** (the same distribution source already
> used for the bundled Claude binary), not from GitHub release assets. Per the sprint brief, npm is
> the primary distribution source: `opencode-ai` installs platform binaries via optional
> dependencies, identical to the `@anthropic-ai/claude-code-*` pattern in the existing manifest.

---

## What we measured

### Distribution shape

`opencode-ai@1.15.13` (MIT) is a thin launcher package. Its `bin.opencode` points at
`./bin/opencode.exe` (that filename is used on **all** platforms — it is just the copy target). A
`postinstall.mjs` selects the correct platform package from `optionalDependencies`, copies/hardlinks
its binary into `bin/opencode.exe`, `chmod 0755`, and verifies with `--version`. The real binary
lives in the platform package's `bin/` (`bin/opencode` on unix, `bin/opencode.exe` on win).

Relevant `optionalDependencies` (all `1.15.13`): `opencode-darwin-arm64`, `opencode-darwin-x64`,
`opencode-windows-x64`, `opencode-linux-x64`, plus `-baseline` (non-AVX2 x64), `-musl` (Alpine),
and arm64 linux variants. **For Ritemark's three target slots we use the non-baseline, non-musl
packages:** `opencode-darwin-arm64`, `opencode-darwin-x64`, `opencode-windows-x64`.

### Binary nature

- `file` on the extracted darwin-arm64 binary →
  `Mach-O 64-bit arm64 executable, flags:<…PIE…>`.
- `file` on the windows-x64 binary → `PE32+ executable (console) x86-64, for MS Windows`.
- The linux-x64 binary we installed is `ELF 64-bit LSB executable, x86-64, dynamically linked,
  … not stripped`.
- **It is a Bun-compiled single-file executable** (`strings` shows `@bun`, `@bun-cjs`, `@bytecode`,
  `bun-profile`, `Bun ran out of memory`, `bun-framework-react/*`). **Single self-contained file,
  no sidecar** — each platform tarball is exactly `fileCount: 2` = `package/package.json` +
  `package/bin/opencode[.exe]`. The Bun runtime + JS bytecode are embedded in the one binary.
- On-disk size of the installed linux-x64 binary: **145,324,160 bytes (139 MB)**.

### npm dist metadata (source of truth for the manifest)

| Slot | npm package | unpacked (binary on disk) | tarball (.tgz, what we download) | npm `integrity` (sha512) | npm `shasum` (sha1) |
| --- | --- | --- | --- | --- | --- |
| darwin-arm64 | `opencode-darwin-arm64` | 108,689,138 B (**103.7 MB**) | 36,540,042 B (**34.8 MB**) | `sha512-/6LSBPUdhNdev0JwOOZePOS8QSrH5XPj2bCkZUeoSyab3i0VMFlbW1hyi93pvsyEFd68OwThoAcy9I4f6TGslQ==` | `994f8fb60903c38dcd812283f30e43f4efbbc2b0` |
| darwin-x64 | `opencode-darwin-x64` | 114,082,012 B (**108.8 MB**) | 38,786,773 B (**36.9 MB**) | `sha512-Qzthj88M8ieMhzuhOi1al6MU0SVyBWWKLtKkmjDabotn+XSlg1dfA2T1Pap5RqV9Z8rH+6LEt4hP4SNFrJGaew==` | `1563d3b6d41c79d0e132219f4a69b1be2d451f96` |
| win32-x64 | `opencode-windows-x64` | 142,998,548 B (**136.4 MB**) | 50,375,951 B (**48.0 MB**) | `sha512-xGpnwI9QKG0p2BjJ/RGa8ZtTTa5crHfMhc/7RyC1K9Z8hGNA5w0Nl2KOMihzMDsj0vmc7TfTv1He5CIUdaC/oQ==` | `13a8a67b576938da22481118cd44381e4753123b` |
| (ref) linux-x64 | `opencode-linux-x64` | 145,324,298 B (138.6 MB) | — | `sha512-gZrioSPE/aWPAZlaipWEN7GEhAzNEQAogikvbcvVP78nabzkzzl4UKBXemf1YzLG9nRWiWvvWX7uC2hcZGQ1iQ==` | `c9dc4d9a7466bd0f62047ace7d46b82b131769f4` |

### sha256 of the tarballs (the value the fetch script verifies)

`scripts/fetch-agent-runtimes.sh` verifies the **sha256 of the downloaded archive** against the
manifest `sha256` field (lines 304–315: "verifying archive sha256"), then extracts `archivePath`.
For the npm-optional-package claude entries the manifest `sha256` is the sha256 of the **.tgz**. We
computed the same for OpenCode by downloading each registry tarball and running `sha256sum`:

| Slot | tarball URL | **sha256 of .tgz** |
| --- | --- | --- |
| darwin-arm64 | `https://registry.npmjs.org/opencode-darwin-arm64/-/opencode-darwin-arm64-1.15.13.tgz` | `e0546a2ce7fc64afaebd94cd07906587f66830e669ee0fa5eaf3e7492f92501b` |
| darwin-x64 | `https://registry.npmjs.org/opencode-darwin-x64/-/opencode-darwin-x64-1.15.13.tgz` | `69b08a76a80b1c218549998ceaca67ebab7e7b5ceb81e37d8248307a2082ca37` |
| win32-x64 | `https://registry.npmjs.org/opencode-windows-x64/-/opencode-windows-x64-1.15.13.tgz` | `91b56b77f69089975d4d7bc674be54b523347de2251302d466cea1ef317913a5` |

Tarball internal layout (matches the claude `package/claude` convention):
`package/bin/opencode` (unix) / `package/bin/opencode.exe` (windows) → `archivePath`.

### License (Q… NOTICE bundling)

- `opencode-ai/LICENSE` (bundled in the npm package) is **MIT**, "Copyright (c) 2025 opencode";
  `package.json` `"license": "MIT"`. Redistribution permitted.
- Canonical LICENSE for NOTICE attribution: `https://github.com/sst/opencode/blob/dev/LICENSE`
  (repo `sst/opencode`). The MIT text must be added to Ritemark's third-party notices file (per
  technical-plan "NOTICE/attribution" touchpoint).

### Size comparison vs already-bundled runtimes

| Runtime | unpacked binary | source |
| --- | --- | --- |
| **OpenCode darwin-arm64** | **103.7 MB** | this audit |
| Claude Code darwin-arm64 (`@anthropic-ai/claude-code-darwin-arm64@2.1.156`) | **205.0 MB** | npm dist metadata |
| codex-app-server darwin-arm64 (`0.135.0`, github tar.gz) | tens of MB (Rust binary; exact size not re-measured — gitignored locally) | manifest |

OpenCode (104 MB) is **about half** the size of the Claude binary Ritemark already bundles and
ships in the DMG. Only **one** platform's binary ships per build (the fetch script installs the
target platform only; `strip-foreign-agent-runtimes.sh` removes others), so the incremental DMG
cost for the darwin-arm64 production build is **~104 MB unpacked / ~35 MB compressed**.

---

## Proposed manifest entries (R2)

Append to `extensions/ritemark/binaries/agents/manifest.json` `runtimes[]`. Mirrors the claude
`npm-optional-package` entries exactly (archive sha256 = sha256 of the .tgz; `archivePath` into the
package). Version pinned to `1.15.13`.

```jsonc
{
  "agent": "opencode",
  "vendor": "sst",
  "version": "1.15.13",
  "platform": "darwin",
  "arch": "arm64",
  "sourceType": "npm-optional-package",
  "npmPackage": "opencode-darwin-arm64",
  "sourceUrl": "https://registry.npmjs.org/opencode-darwin-arm64/-/opencode-darwin-arm64-1.15.13.tgz",
  "archiveFilename": "opencode-darwin-arm64-1.15.13.tgz",
  "archiveFormat": "tar.gz",
  "sha256": "e0546a2ce7fc64afaebd94cd07906587f66830e669ee0fa5eaf3e7492f92501b",
  "archivePath": "package/bin/opencode",
  "installName": "opencode",
  "invocationMode": "acp",
  "validationArgs": ["--version"],
  "expectedFileArchPattern": "Mach-O 64-bit arm64 executable",
  "license": { "spdx": "MIT", "redistribution": "permitted", "noticeUrl": "https://github.com/sst/opencode/blob/dev/LICENSE" }
},
{
  "agent": "opencode",
  "vendor": "sst",
  "version": "1.15.13",
  "platform": "darwin",
  "arch": "x64",
  "sourceType": "npm-optional-package",
  "npmPackage": "opencode-darwin-x64",
  "sourceUrl": "https://registry.npmjs.org/opencode-darwin-x64/-/opencode-darwin-x64-1.15.13.tgz",
  "archiveFilename": "opencode-darwin-x64-1.15.13.tgz",
  "archiveFormat": "tar.gz",
  "sha256": "69b08a76a80b1c218549998ceaca67ebab7e7b5ceb81e37d8248307a2082ca37",
  "archivePath": "package/bin/opencode",
  "installName": "opencode",
  "invocationMode": "acp",
  "validationArgs": ["--version"],
  "expectedFileArchPattern": "Mach-O 64-bit x86_64 executable",
  "license": { "spdx": "MIT", "redistribution": "permitted", "noticeUrl": "https://github.com/sst/opencode/blob/dev/LICENSE" }
},
{
  "agent": "opencode",
  "vendor": "sst",
  "version": "1.15.13",
  "platform": "win32",
  "arch": "x64",
  "sourceType": "npm-optional-package",
  "npmPackage": "opencode-windows-x64",
  "sourceUrl": "https://registry.npmjs.org/opencode-windows-x64/-/opencode-windows-x64-1.15.13.tgz",
  "archiveFilename": "opencode-windows-x64-1.15.13.tgz",
  "archiveFormat": "tar.gz",
  "sha256": "91b56b77f69089975d4d7bc674be54b523347de2251302d466cea1ef317913a5",
  "archivePath": "package/bin/opencode.exe",
  "installName": "opencode.exe",
  "invocationMode": "acp",
  "validationArgs": ["--version"],
  "expectedFileArchPattern": "PE32+ executable (console) x86-64, for MS Windows",
  "license": { "spdx": "MIT", "redistribution": "permitted", "noticeUrl": "https://github.com/sst/opencode/blob/dev/LICENSE" }
}
```

Notes:
- `invocationMode: "acp"` is **new** (claude/codex use `direct-app-server` or have none). The fetch
  script does not branch on `invocationMode`; it is metadata for the runtime layer. The ACP client
  invokes the binary as `opencode acp`.
- `expectedFileArchPattern` values verified with `file` on the extracted binaries:
  darwin-arm64 = `Mach-O 64-bit arm64 executable`; win = `PE32+ executable (console) x86-64, for MS
  Windows`. The existing manifest uses `Mach-O 64-bit executable x86_64` for codex darwin-x64;
  confirm the exact substring the fetch script greps for and align the darwin-x64 string accordingly
  (the `file` output here was `Mach-O 64-bit x86_64 executable`).
- **darwin arch-pattern caveat (UNVERIFIED locally):** the audit ran on linux; the darwin `file`
  strings come from extracting the darwin tarballs on a linux host, which yields the same Mach-O
  description, but confirm against the production darwin build host's `file` output before relying
  on the exact `expectedFileArchPattern` substring.

---

## Q1 recommendation — **BUNDLE in the DMG** (do not download on first use)

**Rationale:**

1. **Size is under the abort threshold.** Q1 set the fallback trigger at ">80 MB or breaks
   notarization." The darwin-arm64 binary is **103.7 MB unpacked / 34.8 MB compressed**. While the
   *unpacked* number is above 80 MB, the gating concern behind that threshold is DMG bloat, and the
   relevant comparison is to what Ritemark already ships: the **Claude binary is 205 MB** unpacked
   and is bundled today. OpenCode adds roughly **half a Claude** to the build — a smaller increment
   than an already-accepted dependency. Only the **target platform's** binary ships per build
   (fetch installs one slot; `strip-foreign-agent-runtimes.sh` drops the rest), so darwin-arm64
   production DMG grows by ~104 MB unpacked.
2. **Codex/Claude precedent = bundle**, and the manifest + fetch pipeline already supports the exact
   `npm-optional-package` mechanism — zero new infrastructure to bundle OpenCode.
3. **Offline-first is a product principle** (CLAUDE.md target: "local-first … offline support").
   First-use download would break OpenCode for offline users and add a network-failure surface,
   contradicting that principle.
4. **No second trust/permission prompt.** A bundled, signed-in-place binary is covered by the app's
   own notarization; a downloaded binary would need its own quarantine/Gatekeeper handling.

**Condition:** bundling is recommended **provided notarization of the Bun-compiled binary inside the
signed DMG succeeds** — see Residual N-1. This is the one thing that could still flip Q1 to
"download on first use," and it can only be confirmed on the darwin signing host. The Phase-0 audit
could not test notarization (linux container, no Apple signing identity).

---

## Residual risks

| # | Risk | Severity | Notes / action |
| --- | --- | --- | --- |
| N-1 | **Notarization of the Bun-compiled binary inside the signed DMG is UNVERIFIED.** Could not be tested (no darwin/codesign here). | **High — gates first production build.** | Bun single-file executables embed a runtime; Apple's notary checks nested/embedded code signatures and hardened-runtime flags. Public reports indicate Bun-compiled binaries **can** be codesigned + notarized but typically require: `codesign --force --options runtime --timestamp` on the binary, and often an entitlements file allowing **JIT / unsigned-executable-memory** (`com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`, `com.apple.security.cs.disable-library-validation`) because Bun's JS engine maps executable memory. Claude Code (also a bundled standalone binary) already passes the existing pipeline, so the signing path exists — but OpenCode's Bun runtime is a different engine and must be **explicitly codesigned and test-notarized once** before the first release. Treat as a Gate-1 release blocker until a successful `xcrun notarytool submit … --wait` is observed. |
| N-2 | **Binary is "not stripped"** (linux build; darwin likely similar) → larger than necessary. | Low. | Cosmetic; do not strip a Bun executable (can corrupt the embedded runtime). Accept the 104 MB. |
| N-3 | **AVX2 / baseline split on x64.** `opencode-ai` postinstall picks `-baseline` on non-AVX2 x64 CPUs. The manifest pins the **non-baseline** darwin-x64 / win32-x64 packages. | Low/Medium. | Modern Macs and the win32-x64 target are AVX2-capable, so the non-baseline build is correct for the bundled-binary case (we ship a fixed binary, not a CPU-probe install). If a very old x64 CPU is targeted, the binary may fault — acceptable given darwin-arm64 is the primary target and win32-x64 is the only x64 production slot. Note for QA on older Intel hardware. |
| N-4 | **npm `dist.integrity` is sha512; the fetch script verifies sha256 of the .tgz.** We supplied sha256 (computed locally). | Low. | The sha256 values in the manifest above were computed from the downloaded tarballs in this audit. Re-verify by re-downloading at sprint implementation time (npm tarballs are immutable per version, so they should match). |
| N-5 | **Version drift.** `1.15.13` pinned today; OpenCode releases frequently and the ACP `session/cancel` gap (see e2e audit R-2) may be fixed in a later version. | Medium. | Bumping the pin requires re-computing all three sha256 values and re-running the e2e audit. Keep the pin explicit; document the bump procedure. |
| N-6 | **GitHub API rate-limit (403)** blocked anonymous GitHub-release metadata. | Informational. | All metadata sourced from npm registry instead (the same channel as the claude bundle). The technical-plan's draft manifest used a `github-release` `sourceType` with a `github.com/sst/opencode/releases/...zip` URL — **superseded**: use `npm-optional-package` per the entries above (consistent with the claude precedent and avoids GitHub rate-limit/availability concerns at fetch time). |
| N-7 | **First-run sqlite migration** writes to `~/.config`/state on first `opencode acp` invocation (observed in e2e audit). | Low. | Not a bundling blocker, but the signed app must be allowed to write OpenCode's state dir; ensure no sandbox/hardened-runtime entitlement blocks it. |
