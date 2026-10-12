# Bundled native binaries

Two kinds of native payload live here:

| Folder | What | Provenance |
|---|---|---|
| `agents/` | Claude Code, Codex and OpenCode runtimes | Fetched at build time and pinned by `agents/manifest.json` (see `agents/README.md`) |
| `darwin-arm64/`, `darwin-x64/`, `win32-x64/` | The whisper.cpp speech engine for voice dictation and Transcribe's on-device engine | Built in CI and **committed**. Every file's SHA-256 is in `whisper-manifest.json` |

Everything under `binaries/` is shell-tier (`CLAUDE.md`, Release Tiers): it reaches users only with a full app release.

## Whisper speech engine

- **Source:** [whisper.cpp](https://github.com/ggml-org/whisper.cpp) v1.8.3, commit `2eeeba56e9edd762b4b38467bab96c2517163158`. The build scripts refuse any other commit.
- **Built by:** `.github/workflows/build-whisper.yml` on GitHub's standard runners. `scripts/build-whisper.sh` builds the macOS targets and `scripts/build-whisper-windows.ps1` builds Windows. Each build is checked by `scripts/qa/whisper-contract-test.mjs` (transcript, JSON, exit codes, Unicode paths, architecture, dependencies, minimum macOS). The run each file came from is recorded in `whisper-manifest.json`.
- **macOS** (`whisper-cli`, one static file per architecture): minimum macOS 12.0, enforced at compile time (`-Werror=unguarded-availability-new`). Metal is embedded on Apple silicon. On Intel there is no Metal; ggml's own CPU code runs with an AVX2 baseline. ggml's BLAS backend is off, because Accelerate's new BLAS interface needs macOS 13.3.
- **Windows** (`whisper-cli.exe` + DLLs, "config V"):
  - The CPU code is chosen at run time (`ggml-cpu-*.dll`), so older processors run more slowly instead of crashing.
  - The Microsoft VC++ runtime DLLs sit beside the exe, so no Redistributable install is needed.
  - A UTF-8 code-page manifest lets paths contain any characters.
  - OpenMP is off.
- **Signing:**
  - macOS: `scripts/codesign-app.sh` signs every file named `whisper-cli`.
  - Windows: the release workflow signs every unsigned PE file it finds (`scripts/verify-windows-signatures.ps1`). The Microsoft runtime DLLs keep Microsoft's signature.
- **Checked at release:** `scripts/validate-build-output.sh` Check 5b. Every file in the target's folder must match `whisper-manifest.json` (hashes are compared before signing) and have the right architecture, and no other platform's folder may be present.

### Rebuilding

1. Change the pinned commit in `scripts/build-whisper.sh`, `scripts/build-whisper-windows.ps1` and `.github/workflows/build-whisper.yml` (all three).
2. Let `build-whisper.yml` run on the pull request, and check that every contract test passed.
3. Download the `whisper-<target>` artifacts, check them against their `info/SHA256SUMS`, and replace the target folders.
4. Regenerate `whisper-manifest.json` with each file's SHA-256 and the run URL. Retest dictation and on-device Transcribe on every platform.

### Licences

- whisper.cpp and ggml: MIT, © 2023–2026 The ggml authors (https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE).
- `win32-x64/VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`, `MSVCP140.dll`: Microsoft Visual C++ runtime, redistributed app-locally as "Distributable Code" under the Visual Studio licence terms, unmodified and Microsoft-signed.
- Speech models are not bundled. They are downloaded on first use from a pinned Hugging Face revision and checked by size and SHA-256 (`src/voiceDictation/modelManager.ts`).
