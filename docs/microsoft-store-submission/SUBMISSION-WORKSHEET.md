# Microsoft Store submission worksheet

This is the canonical copy/paste worksheet for Ritemark's **EXE or MSI app** submission. Values marked **Pending** require a live Partner Center or final-candidate decision.

## Product identity

| Partner Center field | Value / decision |
|---|---|
| Product name | `Ritemark` — reserved as an EXE/MSI app |
| Partner Center ID | `3a2a9010-fbe3-47cf-ae87-4d338f587830` |
| Publisher display name | `Productory Services OÜ` |
| App type | `EXE` |
| Architecture | `x64` |
| Install context | Per-user / current user; normal install does not require an administrator account |
| Package language | English (`en`) |
| Store listing language | English (United Kingdom), subject to confirmation in the live draft |
| Minimum OS | Windows 10 x64-compatible; clean Windows 11 is the certification and Smart App Control baseline |
| Category | Proposed: `Productivity`; confirm the current Partner Center taxonomy |
| Pricing | **Pending Jarmo decision** |
| Markets | **Pending Jarmo decision** |
| Age rating | Complete the live Partner Center questionnaire; do not infer a rating |

## Publisher and public information

| Field | Value |
|---|---|
| Legal company name | `Productory Services OÜ` |
| Registry code | `14781142` |
| Company website | `https://productory.ai` |
| Product website | `https://ritemark.app/en/` |
| Support URL | `https://ritemark.app/en/support/` |
| Privacy policy URL | `https://www.productory.ai/en/privacy/` |
| License / terms URL | `https://www.productory.ai/en/terms/` |
| Public support email | **Pending explicit confirmation** |
| Developed by | `Productory Services OÜ` |
| Copyright and trademark | `Copyright 2024–2026 Productory OÜ. Ritemark is released under the MIT License.` |

## Package fields

| Field | Stable value / candidate source |
|---|---|
| Expected filename | `Ritemark-Setup.exe` |
| Package URL | Copy from the approved release-candidate record; expected pattern: `https://downloads.ritemark.app/windows/v{VERSION}/Ritemark-Setup.exe` |
| Installer parameters | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER` |
| Installer type | Standalone/offline EXE; no setup-time payload downloads |
| Signature publisher | `Productory Services OÜ` |
| SHA-256 | Copy from the approved release-candidate record |
| Version | Copy from the approved release-candidate record |
| Uninstall | Inno Setup uninstaller; standard-user silent uninstall and cleanup must pass |
| Custom return-code handling | Leave unset unless final installer testing identifies a required mapping |
| Non-Microsoft driver or NT service dependency | None expected; verify for every candidate |

The package URL and SHA-256 must never be entered from a placeholder. Once a URL is submitted, do not replace its bytes.

## English listing

Copy the full text from [`LISTING-COPY.md`](./LISTING-COPY.md).

| Field | Decision |
|---|---|
| Description | Prepared |
| Short description | Prepared; under Microsoft's recommended 270-character display threshold |
| Product features | Prepared; enter one feature per field without manual bullet characters |
| What's new | Leave blank for the first Store submission; use version-specific copy for later updates |
| Search terms | Seven prepared terms; within the current Store limit |
| Applicable license terms | Use `https://www.productory.ai/en/terms/` |
| Screenshot set | **Pending installed-Windows capture** |
| 1:1 Store logo | `assets/store-logo-1x1.png` |
| 2:3 poster art | Optional/recommended; no final asset prepared |

## Properties and disclosures

Complete these against the shipping Windows candidate and current product behavior:

- Supported device family: PC/Desktop only unless engineering explicitly expands support.
- System requirements: x64-compatible Windows 10 or later; add hardware requirements only if the app truly requires them.
- Internet access: optional for local editing, required for selected network-connected AI/provider features and online content.
- Personal information/privacy: answer using the approved privacy policy and actual product data flows.
- AI features: describe honestly; users choose/configure supported providers and network-connected AI processing can send selected context off-device.
- Drivers/services: disclose only if a final binary audit finds a non-Microsoft driver or NT service dependency.
- Login/test account: not expected for ordinary local editing; provide certification access instructions if any reviewed feature requires credentials.

## Final authorization fields

Before submission, all of the following must contain exact values:

| Approval item | Required record |
|---|---|
| Release version and commit | Approved release-candidate record |
| CI workflow run | Link or immutable run ID |
| Hosted package URL | Direct versioned HTTPS URL |
| Hosted SHA-256 | Exact match with CI artifact |
| Signature evidence | Publisher and timestamp verification |
| Clean Windows evidence | Same SHA-256, Smart App Control On |
| Partner Center draft review | All sections complete, no placeholders |
| Submit authority | Explicit approval from Jarmo |
