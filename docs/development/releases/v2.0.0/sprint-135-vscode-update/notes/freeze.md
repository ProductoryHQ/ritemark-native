# The frozen target (R1, S1)

Frozen on **2026-10-19**, the day Jarmo approved the plan ("Approved, all five as recommended"), by D1's rule: the newest stable release that day.

| | |
|---|---|
| Tag | **1.142.0** (released 2026-10-14 19:46 UTC) |
| Commit | `d956e8a6ac5d904486557eea07e1d6bd62a4d36f` |
| Node (`.nvmrc`) | 24.18.0 |
| Electron (`.npmrc` `target`) | 43.7.7 |
| Server Node (`remote/.npmrc` `target`) | 24.21.0 |
| The pin it replaces | 1.117.0, `10c8e557c8b9f9ed0a87f61f1c9a44bde731c409` (Node 22.22.1, Electron 39.8.7) |

How it was read:

```bash
gh api 'repos/microsoft/vscode/releases?per_page=8' --jq '.[] | [.tag_name, .published_at, .prerelease] | @tsv'
gh api repos/microsoft/vscode/git/ref/tags/1.142.0 --jq .object.sha
gh api 'repos/microsoft/vscode/contents/.nvmrc?ref=1.142.0' --jq .content | base64 -d
```

The releases list that day, newest first: 1.142.0 (14 Oct), 1.141.2 (14 Oct), 1.141.1 (13 Oct), 1.141.0 (7 Oct), 1.140.0 (30 Sep). No pre-releases among them. The shallow `vscode/` submodule's tags were not used (they stop at 1.119.0).

## What may replace it

- **A recovery release of 1.142** (1.142.1, 1.142.2, …), before the merge, only after the stack is dry-applied on it and upstream's diff from 1.142.0 is read for the patched files (S2). 1.141 had two within a week, so one is likely.
- **Never a new minor.** VS Code ships on Wednesdays (16, 23 and 30 September, 7 and 14 October), so 1.143.0 is expected on 21 October. It is noted for after 2.0 (S3, D2).

## Recovery releases seen during the sprint

None yet.
