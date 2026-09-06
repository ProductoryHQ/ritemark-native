# Windows package and certification gates

The Microsoft Store receives a direct HTTPS link to Ritemark's EXE. Microsoft does not host or replace this EXE for us, so identity, signing, hosting, and immutability must be controlled as one chain of evidence.

## Candidate chain

```text
Approved release commit
  → signed Windows CI artifact
  → local signature/install/uninstall audit
  → versioned immutable HTTPS upload
  → fresh-download SHA-256 comparison
  → Partner Center validation/certification
  → clean Windows 11 + Smart App Control test
  → Store-origin install verification
```

Any binary change breaks the chain and creates a new candidate, URL, hash, and evidence record.

## Release Gate 1 — authorize the Windows build

Before dispatching the final Windows workflow:

- the exact release commit/ref is approved;
- the release manager records the Gate 1 result;
- dependency/security disposition is explicit;
- the build is not being run merely to populate a Partner Center placeholder.

## Package requirements

| Requirement | Ritemark decision / evidence |
|---|---|
| Package format | `Ritemark-Setup.exe` |
| Architecture | x64 |
| Hosting | Productory-controlled HTTPS infrastructure/CDN |
| URL shape | `https://downloads.ritemark.app/windows/v{VERSION}/Ritemark-Setup.exe` |
| URL behavior | Direct installer response; no HTML/interstitial/login |
| URL mutability | Immutable after submission |
| Installer type | Standalone/offline; no setup-time payload download |
| Install context | Current user / standard user |
| Silent install | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER` |
| Silent uninstall | Inno uninstaller with `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART` |
| Publisher | `Productory Services OÜ` |
| Signatures | Installer and every Ritemark-owned PE in payload/installed tree |
| Timestamp | Valid trusted timestamp on signed Ritemark-owned files |
| Discovery | One Start menu entry and one Apps/Programs registration |
| Cleanup | Uninstall removes app directory, Start menu group, and app registration |

Microsoft's current EXE/MSI rules require a versioned immutable HTTPS URL, a silent standard-user install, a standalone installer, and digitally signed installer/PE files. See [`OFFICIAL-REFERENCES.md`](./OFFICIAL-REFERENCES.md).

## Engineering audit

The Windows workflow must produce at least:

- `Ritemark-Setup.exe`;
- `Ritemark-Setup.sha256.txt`;
- signature-verification evidence for payload and installed PE files;
- silent install/uninstall evidence;
- the workflow run ID and source commit.

Verify:

1. Installer Authenticode status is valid.
2. Signer identity matches `Productory Services OÜ`.
3. A trusted timestamp is present.
4. Every Ritemark-owned PE in the packaged payload is signed.
5. Every Ritemark-owned PE in the installed tree is signed.
6. ProductName, Publisher, Version, and language metadata are correct in Windows Apps/Programs data.
7. Standard-user silent install shows no UI other than an allowed UAC prompt.
8. The app launches, opens/edits/saves Markdown, and degrades safely without network connectivity.
9. Silent uninstall leaves no Ritemark app registration, install directory, or Start menu group.
10. Microsoft Defender or another current consumer antivirus scan reports no malware or unwanted application.
11. The installer does not install unrelated software or depend on an undisclosed non-Microsoft driver/NT service.

## Hosting audit

After uploading the exact tested installer:

1. Confirm DNS resolves and TLS is valid.
2. Confirm the URL is a direct link to an `.exe` response.
3. Download to a clean location.
4. Compute SHA-256 and compare it with the CI record.
5. Verify Authenticode again on the downloaded file.
6. Record response timestamp, final URL after redirects, content length, and SHA-256.
7. Lock the object against in-place replacement.

If a rebuild is required, use a new path such as `v1.10.0-candidate-2`. Do not replace the previous bytes.

## Clean Windows 11 / Smart App Control test

Use a clean Windows 11 machine with current Defender intelligence and Smart App Control **On**.

1. Record Windows version, Defender version/state, SAC state, installer URL, and SHA-256.
2. Confirm installer Properties → Digital Signatures shows `Productory Services OÜ` and a valid signature.
3. Download and run normally without disabling SmartScreen, SAC, Defender, or organization policy.
4. Confirm silent install as a standard user.
5. Launch Ritemark; open, edit, and save a Markdown file.
6. Exercise bundled runtime/agent paths available on the test machine.
7. Confirm exactly one Ritemark entry in Start and Apps/Programs.
8. Uninstall and confirm app directory, Start menu group, and registration are removed.
9. Inspect Defender Protection History and CodeIntegrity/Operational events for Ritemark-related blocks.

Any Ritemark warning/block, signature mismatch, install failure, crash, or material cleanup residue fails the candidate.

## Partner Center validation and certification

Before Submit:

- package preprocessing/validation is green;
- certification notes explain any non-obvious access or workflow;
- the privacy URL and listing accurately describe network-connected processing;
- no incomplete pages, placeholder URLs, unavailable features, or test-only UI remain;
- Jarmo approves the exact candidate and SHA-256.

After Submit, record Microsoft's certification status and any errors in the candidate record. A certification fix creates a new candidate; it does not justify replacing the existing URL.

## Release Gate 2 — ship decision

Gate 2 requires one coherent evidence set:

- approved commit and Windows workflow run;
- signed installer audit;
- immutable hosted URL and matching SHA-256;
- Partner Center certification pass;
- clean Windows 11 / SAC-On pass;
- Store-origin install/launch/edit-save/uninstall pass;
- direct-download file matches the approved Store candidate where both channels offer the same version;
- Jarmo's explicit final approval.

Only then may the Microsoft Store distribution channel be described as shipped.
