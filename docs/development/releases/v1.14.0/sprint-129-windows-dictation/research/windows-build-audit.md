# Sprint 129 A1 — Windows (and macOS) build audit

**Date:** 2026-10-11 · **Workflow:** `build-whisper.yml`, run [38130971199](https://github.com/ProductoryHQ/ritemark-native/actions/runs/38130971199) on PR #399 · **Source:** whisper.cpp v1.8.3, commit `2eeeba56`

## Result

| Build | Runner | Payload | Contract test |
|---|---|---|---|
| win32-x64 **config V** | windows-latest (image 20260925) | 16 files, ~10.4 MB (3.4 MB zipped): `whisper-cli.exe`, `whisper.dll`, `ggml.dll`, `ggml-base.dll`, 9 CPU variants (`x64`, `sse42`, `sandybridge`, `haswell`, `skylakex`, `cannonlake`, `cascadelake`, `icelake`, `alderlake`), app-local `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`, `MSVCP140.dll` | All functional checks pass (transcript, JSON, per-word confidence, progress, dictation stdout, exit 2, exit 3, **Unicode folder `Tõõ-äöü Тест`**). The dependency check failed only on a parser bug in the test: dumpbin's `Dump of file …\x.dll` header line was read as a dependency. Fixed; re-run pending |
| win32-x64 **config S** | windows-latest | `whisper-cli.exe`, 2,276,352 bytes | 10/10 |
| darwin-x64 | macos-15-intel | `whisper-cli`, 2.5 MB, x86_64, minos 12.0 | 11/11 |
| darwin-arm64 (candidate) | macos-15 | `whisper-cli`, 2.8 MB, arm64, minos 12.0, Metal embedded | 11/11 |
| darwin-arm64 (candidate) | **macos-14** (14.8.9) | same file | 11/11 |

## Decision

**Config V ships** (the W0 rule: it builds and passes the contract test). Its CPU code is chosen at run time, so a processor without AVX2 gets the `x64`/`sse42`/`sandybridge` path instead of an illegal-instruction crash. The cost is 10 MB on disk instead of 2.3 MB. Config S stays in the workflow as the fallback.

## Facts worth keeping

- **UTF-8 manifest works.** The runner's code page is 1252. Without the manifest, the Cyrillic folder could not be opened (whisper-cli reads arguments in the system code page); with it, the check passes on both configs.
- **No VC++ Redistributable needed:** config V loads the Microsoft-signed runtime DLLs from its own folder, and config S links the CRT statically. Both are verified by the dependency check, which treats VC++ redist DLLs found only in System32 as missing.
- **macOS 12 floor needs ggml's BLAS backend off.** Accelerate's new BLAS interface (`cblas_sgemm`, `ACCELERATE_NEW_LAPACK`) is macOS 13.3+. With `-Werror=unguarded-availability-new` the macOS builds now fail on any API newer than 12.0. Matrix work runs on Metal (Apple silicon) or ggml's own CPU kernels (Intel), the same as on Windows.
- **GitHub's Apple silicon runners are not a speed reference.** The paravirtualized GPU makes the tiny model take 13–40 s there, against 0.6 s on an M-series Mac. Use them only for "it runs".
- **CPU-only speed is the open risk.** With the *tiny* test model (about 1/90th of large-v3-turbo's encoder work), one dictation call took 1.9 s on the 4-vCPU Windows runner and 6.6 s on the Intel Mac runner. A2 measures the real model on Jarmo's machine.

## Local check (Apple silicon, 2026-10-11)

The shipped `binaries/darwin-arm64` (built 2026-01-21) passes every check except **minos 15.0**: it does not start on macOS 12–14, which Ritemark supports. The candidate built by `build-whisper.sh --target darwin-arm64` passes all 11 checks at the same speed (dictation call 0.58 s vs 0.57 s). Whether to ship it is a scope decision for Jarmo (see sprint-plan.md).
