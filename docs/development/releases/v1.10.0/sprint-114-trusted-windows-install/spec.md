# Sprint 114 Specification — Trusted Windows Install

## Outcome

A new Windows user can install Ritemark through a Microsoft-trusted primary channel, while the direct installer remains independently verifiable and works with Windows security protections enabled.

## Requirements

### R1 — Evidence-backed failure classification

The sprint must test the exact current shipping Windows asset and record its SHA-256, outer signature, nested setup/uninstaller signatures, publisher, certificate chain, timestamp, SmartScreen/SAC result, and relevant Code Integrity events. The audit distinguishes:

- browser/download reputation warnings;
- SmartScreen run prompts;
- Smart App Control or WDAC execution blocks;
- Defender malware/PUA quarantine;
- installer or application failure unrelated to Windows trust.

The implementation must address the measured failure and must not use “new app reputation” as a blanket explanation for an unsigned or invalid nested binary.

### R2 — Complete Authenticode chain

All Portable Executables that Ritemark installs or loads must have a valid trusted Authenticode signature. Inventory is content-based so native modules with extensions such as `.node` are included. Valid trusted third-party signatures may be preserved; Ritemark-owned and unsigned PEs are signed through Productory Services OÜ's Azure Artifact Signing Public Trust profile using RSA/SHA-256 and RFC 3161 timestamping.

Branding/resource mutation occurs before signing. No signed artifact is changed afterward.

### R3 — Inno internal-component signing

Release builds invoke Inno Setup with `SignTool` enabled during compilation. The registered Azure signing command signs the generated setup engine/loader and uninstaller, and the final outer installer is also signed and verified. Applying a signature only to the completed outer EXE does not satisfy this requirement.

### R4 — Fail-closed release CI

The release workflow has explicit release and non-release modes:

- Release mode requires signing credentials, signs and verifies the complete PE set, builds and verifies the installer, and only then uploads a canonical artifact.
- Non-release/canary mode may skip signing only when the output is visibly marked non-release and cannot be promoted or uploaded under the canonical release artifact name.

Missing credentials, skipped signing, invalid chain, wrong publisher, missing timestamp, unsigned required PE, signature-breaking mutation, or failed verification blocks the release job.

### R5 — Smart App Control verification

The exact release candidate is installed on a clean Windows 11 system with Smart App Control **On**. Installation, first launch, representative bundled-native paths, updater-sensitive behavior, and uninstall complete without Ritemark-attributable Code Integrity 3076/3077 block events. The test records OS version, SAC state, installer hash, signatures, event-log evidence, and result.

### R6 — Microsoft Store primary channel

Ritemark uses the Microsoft Store MSI/EXE submission path for v1.10.0 unless certification proves it infeasible and Jarmo approves a scope change. The submitted installer is:

- standalone/offline rather than a downloader stub;
- capable of silent install and uninstall under Store requirements;
- hosted at a versioned immutable HTTPS URL;
- identical by hash to the verified channel manifest;
- fully signed, including all PE payloads;
- represented by accurate listing, privacy, support, architecture, and system-requirement metadata.

Store certification and a clean Store-origin install are release blockers unless explicitly deferred by a dated Jarmo decision.

### R7 — Honest direct-download fallback

The direct installer remains available as a secondary channel. It uses the same canonical build hash and publisher identity as the Store submission. Download copy identifies Productory Services OÜ, publishes SHA-256 verification information, and explains that direct-channel reputation may still produce a temporary warning. It never recommends disabling Windows security.

### R8 — Support and release truth

User, release, and operator documentation distinguishes SmartScreen reputation, SAC/WDAC signature enforcement, and Defender detection. A real Defender malware/PUA false positive is routed to Microsoft's developer submission process; an “unrecognized app” reputation prompt is not misrepresented as malware.

Release notes may claim “trusted Windows install” only after the Store install and SAC-on direct-installer matrix pass on the exact shipping hash.

## Non-Requirements

- MSIX migration is not required for the first Store submission.
- EV signing is not required and is not treated as a reputation shortcut.
- The sprint does not modify or bypass user/enterprise Windows security policy.
- Direct-download SmartScreen reputation cannot be guaranteed for every new hash; the Store path provides the deterministic consumer experience.
- Windows ARM64 and a new updater are not part of this sprint.

## Release Blockers

Any of the following blocks v1.10.0 Windows publication:

- canonical installer produced while signing is disabled or unverifiable;
- unsigned/invalid Ritemark PE, setup loader, or uninstaller;
- SAC/WDAC block on the release candidate;
- Store installer hash differs from the verified release manifest;
- Store submission is uncertified without an explicit defer decision;
- user guidance still instructs consumers to disable Smart App Control or Defender.
