# Partner Center, Hosting, and SAC Handoff

**Owners:** Jarmo (account, legal/listing approval, final submit/publish), engineering (candidate and evidence), Kristiina (clean Windows 11 validation)
**Publisher/signing identity:** `Productory Services OÜ`
**Status:** Partner Center setup, name reservation, immutable hosting, signed runner proof, and clean-machine evidence remain external gates.

## 1. Jarmo — Partner Center Setup and Name Reservation

1. Enroll or confirm the organization account in Partner Center using the legal identity **Productory Services OÜ**. Complete business verification, payout/tax prompts only when Partner Center requires them, and give no broader account access than necessary.
2. Confirm the public publisher/display name shown to customers is the approved Productory Services OÜ identity and matches the installer signature.
3. Choose **New product → EXE or MSI app**, reserve **Ritemark**, and record the product ID plus reservation date. A reservation is time-limited if no submission follows, so track its expiry in the release plan.
4. Complete availability/discoverability, pricing, category, privacy-policy URL, support URL/contact, age ratings, system requirements, and listing metadata. The listing must describe an x64 Windows desktop app and must not promise Store availability before certification passes.
5. Prepare the required descriptions, logos, screenshots, license terms, and certification notes. Jarmo approves the customer-facing listing and performs the final submit/publish action.

If the exact `Ritemark` name cannot be reserved, stop and bring the available names to Jarmo. Do not silently rename the product or publisher.

## 2. Engineering — Immutable Candidate Contract

The Partner Center URL is publisher-controlled and versioned:

```text
https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe
```

Requirements before submission:

- HTTPS succeeds without redirects to a mutable or third-party `latest` object.
- The object is write-once. If candidate bytes change, publish a new candidate path and update the submission; never overwrite an already submitted object.
- Record URL, retrieval time, HTTP status, content length/type, ETag if available, SHA-256, workflow run, git ref, and commit.
- The fetched bytes equal the workflow channel manifest and the secondary GitHub Release `Ritemark-Setup.exe` byte for byte.
- Upload is allowed only for an exact-tag `release` workflow result that passed payload, installer, installed-tree, uninstaller, and silent-lifecycle verification.
- Keep GitHub Release as the secondary direct-download/recovery source, not the Store ingestion URL.

Store package settings:

- installer type: standalone/offline EXE;
- architecture: x64;
- silent install parameters: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-`;
- declared version: exact `branding/product.json` release version;
- publisher: `Productory Services OÜ`;
- package URL: the immutable versioned URL above;
- certification notes: state the silent switches, default install scope/location, launch behavior, and any test account or network prerequisites.

Record preprocessing and certification output. If certification changes require new bytes, build a new exact candidate, publish it at a new immutable path, and repeat every hash-bound test.

## 3. Kristiina — Clean Windows 11 SAC-On Matrix

Use a clean Windows 11 machine that has not run the candidate before. Smart App Control must read **On**, not Evaluation or Off, and Defender security intelligence must be current.

Before installation, record:

- Windows edition, version, OS build, and update state;
- Smart App Control state and Defender security-intelligence version;
- source channel (signed direct canary for runner proof; Store for final certification);
- installer filename, size, SHA-256, signature status, timestamp, and publisher;
- `citool.exe -lp`/Code Integrity policy state where available.

Test in this order:

1. Download or install the exact recorded candidate without weakening SmartScreen, SAC, Defender, or organization policy.
2. Complete silent and ordinary installation, then launch Ritemark.
3. Open a Markdown document and exercise representative bundled native/runtime paths: start Claude, Codex, and OpenCode setup/session paths as available, plus a native-module-backed feature included in the release matrix.
4. Exercise update-sensitive behavior required by the v1.10.0 release process without substituting another build.
5. Uninstall and confirm the generated uninstaller completes normally.
6. Export **Microsoft-Windows-CodeIntegrity/Operational** events covering the whole test. Record any 3076 (audit) or 3077 (enforcement) event whose path or hash belongs to Ritemark.
7. Check Defender Protection History. A malware/PUA detection is a Defender false-positive investigation, not a SmartScreen-reputation result.

Return screenshots for SAC state and any visible warning, the Code Integrity export, install/uninstall logs, exact hash/signature output, and a short pass/fail note. Any Ritemark-attributable block, unsigned loaded PE, hash mismatch, or required path not exercised blocks the candidate.

## 4. Two Evidence Stages

1. **Signed canary runner proof:** proves Azure Artifact Signing action + SignTool/dlib + Inno repeated signing + silent lifecycle on the GitHub runner. It is visibly non-release and cannot be submitted or published.
2. **Exact v1.10.0 candidate:** built from tag `v1.10.0` after Gate 1, uploaded immutably, submitted to Partner Center, certified, and installed from Store. Jarmo/Kristiina approval applies only to its exact SHA-256. Any rebuild resets approval.

## Handoff Checklist

- [ ] Jarmo confirms Partner Center organization enrollment and legal publisher.
- [ ] `Ritemark` name is reserved; product ID/date/expiry are recorded privately.
- [ ] Listing, privacy, support, category, age rating, screenshots, and certification notes are approved.
- [ ] `downloads.ritemark.app` versioned path is provisioned with write-once controls.
- [ ] Signed-canary runner proof passes and its evidence is reviewed.
- [ ] GitHub `windows-signing` environment has required reviewers, environment-scoped Azure secrets, and allowed deployment refs limited to the approved canary branch and `vX.Y.Z` tags.
- [ ] Exact-tag release candidate passes Windows workflow verification.
- [ ] Hosted URL, GitHub asset, and manifest share one SHA-256.
- [ ] Partner Center preprocessing and certification pass.
- [ ] Kristiina's clean Windows 11 SAC-On direct and Store matrices pass.
- [ ] Jarmo explicitly clears Windows Gate 2 for the exact hash.

## Microsoft References

- [Reserve an app name](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/reserve-your-apps-name)
- [Create an EXE/MSI submission](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/create-app-submission)
- [Upload EXE/MSI packages](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages)
- [EXE/MSI package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- [Test with Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control)
