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
| Store listing language | English (United Kingdom); live listing exists |
| Minimum OS | Windows 10 x64-compatible; clean Windows 11 is the certification and Smart App Control baseline |
| Category | `Productivity` — confirmed in the live Partner Center taxonomy |
| Pricing | `Freemium: optional in-app purchases` — inherited accepted value; covers optional third-party AI account, subscription, or API-credit requirements, while Ritemark sells no in-app subscription |
| Markets | All 240 regions; do not add future regions automatically |
| Age rating | Live rating exists; preserve the accepted answers unless product behavior changed |

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
| Public support email | `info@productory.eu` |
| Developed by | `Productory Services OÜ` |
| Copyright and trademark | `Copyright 2024–2026 Productory Services OÜ. Ritemark is released under the MIT License.` |

## Package fields

Current candidate: v1.14.0 candidate 2. Exact release bytes are hosted and public hash verification passed. Partner Center validation completed on 2026-10-17: malware clean, code sign valid, and three identification checks inconclusive. Jarmo approved the exact URL/hash and the separate Freemium warning; the update was submitted at approximately 15:00 EEST and is now `Update in review`.

| Field | Stable value / candidate source |
|---|---|
| Expected filename | `Ritemark-Setup.exe` |
| Package URL | `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe` |
| Installer parameters | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER` |
| Installer type | Standalone/offline EXE; no setup-time payload downloads |
| Signature publisher | `Productory Services OÜ` |
| SHA-256 | `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48` |
| Version | `1.14.0` |
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
| What's new | Use the v1.14.0 copy in `release-candidates/v1.14.0-candidate-2.md` |
| Search terms | Seven prepared terms; within the current Store limit |
| Applicable license terms | Use `https://www.productory.ai/en/terms/` |
| Screenshot set | Preserve the accepted live Windows screenshots unless Jarmo requests a listing-media update |
| 1:1 Store logo | `assets/store-logo-1x1.png` |
| 2:3 poster art | Accepted live asset exists; do not replace during this package-only update |

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
