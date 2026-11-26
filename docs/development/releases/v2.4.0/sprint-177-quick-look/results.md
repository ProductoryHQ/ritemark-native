# Sprint 177 proof and remaining coverage

The Quick Look provider proof in [run 45717696429](https://github.com/ProductoryHQ/ritemark-native/actions/runs/45717696429) was green on macOS 15 arm64, macOS 26 arm64 and macOS 26 Intel. It uses the production native extensions in an ad-hoc-signed proof host. The live cache checks reported by the Development manager passed for the project sweep, redraw after save, PDF text fit within 0.5% of the wall, folder move and deck deletion. The cache, event and job tests are in [PR 2](https://github.com/ProductoryHQ/ritemark-native/pull/1073).

| Scenario | Evidence | Remaining coverage |
| --- | --- | --- |
| S1 · First shown slide | Runner thumbnail and provider logs verify PDF page 1 and the deck icon at small sizes. The live cache proof measured the PDF fit against the wall. | Compare the full set of looks in the scenario in real Finder, including whether Finder's own “DECK” label doubles the label on the icon. |
| S2 · Space preview | Runner preview OCR and provider replies verify the matching two-page PDF with the expected first-page text. | Inspect paging, page size and the shown/omitted material in a real deck in Finder. |
| S3 · Stale drawing | Runner mismatch proof checks the icon and current source text. | Verify what a warmed Finder actually displays after changing a deck with Ritemark closed, including a same-size edit with restored mtime. |
| S4 · Missing or invalid drawing | Runner thumbnail, request logs and direct preview payload checks cover missing and invalid entries and fallback. | Check malformed JSON, no shown slides, denied access, and the unrelated and legacy file handlers in the installed app. |
| S5 · Save | Live cache proof passed save redraw and PDF fit within 0.5% of the wall. PR 2 job/cache tests cover publication safeguards. | Verify the saved result in Finder and confirm a failed save or print creates no usable entry. |
| S6 · Disk change | PR 2 event, job and cache tests exercise scheduling, superseded jobs and an interrupted cache write across two writers. Runner mismatch proof covers the reader fallback while a current drawing is absent. | Exercise interrupted writes and reordered jobs across two live windows and check editing responsiveness. |
| S7 · Reopen | Live cache proof passed the sweep and folder move. PR 2 job and event tests cover freshness and invalidation. | Repeat with theme and local picture changes on the candidate. |
| S8 · Removal and pruning | Live cache proof passed deck deletion. PR 2 tests exercise pruning, owner removal and cancellation of a pending job. PR 4 validates the sandbox entitlement allowlist. | Exercise project removal with a pending job, the cache limit and offline drawing together in the installed candidate. |
| S9 · Clean install or update | The runner proof covers first launch discovery, pre/post-launch election snapshots and matching/mismatching requests for all three target runner combinations. The Settings results are below. | Repeat on the signed candidate as a clean install and as an upgrade from 2.3 with a warmed thumbnail. macOS 12–14 have deployment-target coverage only. |
| S10 · Release build | [PR 4](https://github.com/ProductoryHQ/ritemark-native/pull/1079) adds bundle/layout validation, source and pre-sign PlugIns digest checks, and post-sign checks of both slices for Team ID, hardened runtime and exact sandbox entitlements. | Run these checks against clean release candidates, verify Developer ID signatures and notarization, and smoke-test Windows for absence of Quick Look cache jobs. |
| S11 · Turned off | PR 5 tests cover the election parser, first-save and once-only guidance, version gating, the non-Mac path, synchronous guidance registration and Home’s slot decisions on reopen and dismissal. Runner evidence confirms the Settings wording for macOS 15 and 26. | Verify the guidance and Help in the candidate. |

Gate 1 supplies the signed, notarized app and real Finder evidence, including warmed thumbnail behavior and the potential duplicate “DECK” label. Experience acceptance and Gate 2 remain open.

## PR 5 System Settings runner evidence

Quick Look passed on macOS 15 arm64, 26 arm64 and 26 Intel in [run 45739682719](https://github.com/ProductoryHQ/ritemark-native/actions/runs/45739682719) on `a2dcdf88`. The Settings check confirmed the wording on both arm64 runners and recorded a coverage gap on 26 Intel. The aggregate matched the checked-in app gate `[15, 26]`.

Selected artifacts from the earlier [run 45738118813](https://github.com/ProductoryHQ/ritemark-native/actions/runs/45738118813) show the same verdicts.

| Runner artifact | Settings verdict | Evidence |
| --- | --- | --- |
| `quicklook-macos-15` | Confirmed | `settings/scroll-end.png` and `settings/scroll-end.ocr.txt` show Extensions and Quick Look with both Ritemark providers. |
| `quicklook-macos-26` | Confirmed | `settings/scroll-2.png` and `settings/scroll-2.ocr.txt` show Quick Look with Ritemark. `settings/scroll-end.ocr.txt` shows the Ritemark row with “Quick Look, Quick Look” in the By App view. |
| `quicklook-macos-26-intel` | Coverage gap | `settings/scroll-end.ocr.txt` and `settings/scroll-*.ocr.txt` show the sidebar moving while the title stays on Login Items & Extensions and the Extensions section remains out of view. `settings/capture.log` records the window and capture attempts. |

The aggregate confirms a macOS major version when at least one runner confirms the wording and no runner reaches Extensions without seeing Quick Look.
