# Windows release-guard harness fixes — apply on macOS

These changes cannot be committed from the Windows machine that produced them,
so they travel as a patch file. Apply and commit them on a Mac, where the gate
that blocks them actually runs.

## Why a patch and not a commit

Pre-commit Check 12 runs `scripts/test-release-source-integrity.sh` and
`scripts/test-worktree-hygiene.sh` whenever a build-governance file is staged.
Every file these fixes touch is itself on that trigger list, and both suites
fail under Git Bash for POSIX-only assumptions. So on Windows the gate blocks
its own repair. On macOS the suites pass, the gate runs, and the commit proves
itself.

## What is in the patch

| File | Fix |
|---|---|
| `scripts/test-worktree-hygiene.sh` | The audit prints native Windows paths while assertions were built from MSYS `pwd -P` output, so every path-bearing check failed. Normalises through `cygpath -m`. |
| `scripts/test-release-source-integrity.sh` | `ln -s` silently deep-copies in Git Bash, so two checks that assert the tool REJECTS a symlinked tree asserted nothing, and the paired non-recursive `rm` failed on a real directory. Adds a portable `make_dir_link` that uses a junction on Windows. |
| `scripts/verify-release-source.sh` | Required the extension link to carry the literal relative target `../../extensions/ritemark`. Windows cannot create that without elevation; a junction always reports an absolute target. POSIX behaviour is unchanged — the relative form is still required there. Windows accepts a junction, and both forms are then held to the property the check actually protects: the link must resolve to this worktree's own extension source. |

## How to apply

```bash
git checkout -b codex/windows-harness-fixes
git apply docs/development/releases/v1.10.1/windows-harness-fixes.patch
./scripts/test-worktree-hygiene.sh
./scripts/test-release-source-integrity.sh
```

Both must pass on macOS. They did before these changes too — the point is that
they must still pass, since the Windows fixes must not regress the platform
where the gate already worked.

## Known incomplete

`scripts/test-release-source-integrity.sh` still fails on Windows at a third
layer: `create-release-worktree.sh` hands an absolute POSIX path to Node through
MSYS path conversion, producing a mangled `C;C:\Program Files\Git\...` path. Not
fixed here. On macOS it is not reachable.

## The change this unblocks

`build-windows.yml` writes `store_url=https://downloads.ritemark.app/windows/v<version>/Ritemark-Setup.exe`
into `Ritemark-Setup.sha256.txt`. That host has never resolved — a DNS failure
recorded in `docs/microsoft-store-submission/evidence/url-check-2026-09-01.md`
on 2026-09-01 and confirmed again on 2026-09-08. The working host is
`getritemark.com`, verified by fetching the v1.10.0 installer from it with a
matching size and SHA-256.

Nothing automated reads that string; it is the URL a human carries to Partner
Center. So it is needed before the store submission, not before the build.
Staging `build-windows.yml` is what trips Check 12, which is why it waited for
these harness fixes.
