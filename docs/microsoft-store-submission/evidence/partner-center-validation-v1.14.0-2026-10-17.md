# v1.14.0 Partner Center package-validation evidence — 2026-10-17

Observed in Microsoft Partner Center at approximately `2026-10-16T23:47Z` (`2026-10-17 02:47` Europe/Tallinn).

## Candidate identity

- Package ID: `23647104`
- Architecture: `x64`
- Package URL: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`
- Silent parameters: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`
- Candidate SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`

## Partner Center result

The package row displayed **Completed**.

| Check | Displayed result |
|---|---|
| Malware check | `The package is found to be clean.` |
| Code sign check | `Your app has a valid code sign.` |
| Silent install check | `We could not identify if your app is installing silently.` |
| Entry in add or remove programs | Partner Center could not identify the app and publisher names added to Add or remove programs. |
| Bundleware check | Partner Center could not identify the app and publisher names added to Add or remove programs. |

The three `could not identify` results are recorded as inconclusive, not as passes. The repository's independent Windows CI standard-user round-trip evidence remains the installation/uninstallation evidence for this exact SHA-256.

## Submission boundary

This completed automated validation does not authorize submission. Immediately before **Submit to the Store**, freshly verify the public URL and SHA-256, rerun repository QA, review every inherited Partner Center section for accidental changes, and obtain Jarmo's explicit approval for the exact URL and full SHA-256. Any separate warning or **Submit anyway** action requires a separate action-time confirmation.
