# Sprint 114 Scenarios — Trusted Windows Install

Each scenario records the exact artifact hash, Windows version, security state, command/output or screenshot evidence, and pass/fail result.

## Audit and Classification

### S1 — Current shipping asset baseline

Given the current canonical `Ritemark-Setup.exe`, when it is downloaded and run on a clean Windows 11 machine, then the audit records the download UI, outer signature, extracted setup component, installed payload, uninstaller, SAC/SmartScreen/Defender outcome, and Code Integrity events without assuming one root cause.

### S2 — Defender detection is not treated as reputation

Given Defender quarantines or labels a file as malware/PUA, when support classifies the report, then the exact hash and detection name are recorded and submitted through Microsoft's developer false-positive path; the user is not told to disable Defender.

## Build and Signing

### S3 — Release credentials missing

Given a release-mode Windows job without any required Azure signing secret or profile access, when the job runs, then it fails before canonical artifact upload and reports the missing prerequisite.

### S4 — Explicit non-release build

Given an approved canary/local build with signing intentionally disabled, when it completes, then its output and summary say unsigned/non-release, it uses a non-canonical artifact name, and no release/upload step can promote it.

### S5 — Content-based PE inventory

Given the built application tree, when the signing audit runs, then it discovers PE files by format/magic rather than only `.exe` suffix and includes DLLs and native `.node` modules. Every result has a valid trusted signature or a blocking finding.

### S6 — Signature-breaking mutation

Given a signed PE is modified by icon/resource patching or any later build step, when final verification runs, then the job fails and names that file. Reordering the mutation before signing passes.

### S7 — Inno nested components

Given a release-mode Inno compilation, when the installer is built and installed, then the setup loader, outer installer, and generated uninstaller all verify with a trusted chain and timestamp. An outer-only signature fails this scenario.

### S8 — Wrong publisher or timestamp

Given a valid signature from the wrong profile, a missing timestamp, or an invalid/untrusted chain, when release verification runs, then the build fails with the exact file and signature defect.

## Windows Security and Lifecycle

### S9 — Clean Smart App Control install

Given a clean Windows 11 system with Smart App Control On and current security intelligence, when the exact release candidate is installed, then no setup component is blocked and Code Integrity contains no Ritemark-attributable enforcement event.

### S10 — Launch, native features, and uninstall

Given the SAC-on installation succeeds, when Ritemark launches, representative bundled agent/native module paths execute, and the app is uninstalled, then no unsigned-component block appears and the uninstaller completes normally.

### S11 — Managed-policy honesty

Given an enterprise policy blocks an otherwise valid app, when support documentation is followed, then the user is directed to their administrator/approved deployment channel; no bypass instructions are presented.

## Microsoft Store and Channels

### S12 — Store package preprocessing

Given the v1.10.0 submission URL, when Partner Center fetches the installer, then the URL is HTTPS and versioned, the binary is immutable and offline, silent installation works, all PEs are signed, and the fetched SHA-256 equals the release manifest.

### S13 — Store certification and fresh install

Given the submission passes certification, when a clean Windows user installs from Microsoft Store, then no SmartScreen download warning appears, Ritemark launches, and the installed version/hash matches v1.10.0 evidence.

### S14 — Direct-download fallback

Given the user chooses Direct download, when the installer is fetched from the release page, then it is the same verified build, shows Productory Services OÜ as publisher, and provides SHA-256/support information. A reputation prompt may be documented; a security-disable instruction is not.

### S15 — Channel immutability and update

Given a Store submission has referenced a versioned URL, when a new Ritemark build is produced, then the old URL/object remains byte-identical and a new versioned URL/submission is created. Existing Store and direct installations retain the supported update path.

### S16 — Website and documentation routing

Given Store certification is live, when a Windows visitor follows the primary download CTA, then it opens the Store listing. Direct download is secondary, and user/release docs no longer instruct anyone to turn off Smart App Control.

## Release Regression

### S17 — Exact shipping hash Gate 2

Given Jarmo approves Windows Gate 2, when release publication begins, then the Store URL, direct installer, update metadata, release notes, test checklist, and recorded SAC evidence all identify the exact approved SHA-256. Any rebuilt byte resets Windows approval.
