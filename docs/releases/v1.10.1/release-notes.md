# Ritemark 1.10.1 — Windows Codex Fix

**Windows only.** If you are on macOS, 1.10.0 is current and this update does
not apply to you.

## What was broken

On Windows, asking Codex to read or change a file did not work. Every attempt
failed, on every turn, with an error like this:

```
orchestrator_helper_launch_failed: setup refresh failed to launch helper:
helper=codex-windows-sandbox-setup.exe, error=program not found
```

Chat itself worked, so Codex looked healthy right up until you asked it to
touch a file. This affected the default and recommended sandbox setting,
**workspace-write** — the one most people are on.

If you worked around it by setting the sandbox to full access, that appeared to
help for a real reason: full access skips the sandbox entirely, so it never
needed the missing piece. You can set it back to workspace-write now.

## What was wrong

Codex runs its Windows sandbox through two small helper programs that we simply
were not shipping. They are published separately from the main Codex binary,
and our packaging list did not mention them, so they were never included in the
installer.

They exist only on Windows — on macOS the sandbox is built into the operating
system and needs no helper. That is why macOS was never affected, and why this
release is Windows-only.

## What changed

Both helpers are now bundled and verified at build time. Our packaging checks
were also extended so that a missing helper fails the build rather than
shipping quietly: a component can now be declared as belonging to one platform
instead of all of them, and the two helpers are checked for presence rather
than by running them (they are not designed to be run directly).

## Also in this build

Two unrelated fixes landed after 1.10.0 was cut and ride along in the Windows
build:

- **Saving a document that ends in a list no longer drops the trailing
  newline** ([#254](https://github.com/ProductoryHQ/ritemark-native/issues/254))
- **Home now lists the documents you actually opened recently**
  ([#194](https://github.com/ProductoryHQ/ritemark-native/issues/194))

## Upgrading

Windows users get this through the normal in-app update.

macOS stays on 1.10.0. The Codex fix does not apply there, but the two fixes
above do — they will reach macOS in the next release that builds for it. We
chose not to spend a full macOS rebuild and two notarization cycles on them
while the Windows defect was live in users' hands.
