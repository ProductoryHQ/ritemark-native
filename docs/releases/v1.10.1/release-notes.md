# Ritemark 1.10.1 — Codex Reliability

A maintenance release for everyone. Most of it is about making Codex behave the
way you already expected it to.

## Codex no longer loops when you set it up

If you had not signed in with Claude, choosing **Use Codex** brought up a setup
pane that vanished and came back every couple of seconds. Clicking the button
became a race you often lost.

Behind the scenes, Ritemark was checking Codex's sign-in status every two
seconds while that pane was open, and each check briefly reset the pane's state.
The pane now stays put while you read it.

This affected macOS and Windows equally.

## Codex can work with your files again on Windows

**Windows only.** Asking Codex to read or change a file did not work. Every
attempt failed, on every turn, with an error like this:

```
orchestrator_helper_launch_failed: setup refresh failed to launch helper:
helper=codex-windows-sandbox-setup.exe, error=program not found
```

Chat itself worked, so Codex looked healthy right up until you asked it to touch
a file. This affected the default and recommended sandbox setting,
**workspace-write** — the one most people are on.

If you worked around it by switching the sandbox to full access, that helped for
a real reason: full access skips the sandbox entirely, so it never needed the
missing piece. You can set it back to workspace-write now.

Codex runs its Windows sandbox through two small helper programs that we simply
were not shipping. They are published separately from the main Codex binary and
our packaging list did not mention them, so they never made it into the
installer. Both are now bundled and verified at build time, and the packaging
checks were extended so a missing helper fails the build instead of shipping
quietly.

macOS was never affected by this one — there the sandbox is built into the
operating system and needs no helper.

## Two editor fixes

- **Saving a document that ends in a list no longer drops the trailing newline**
  ([#254](https://github.com/ProductoryHQ/ritemark-native/issues/254))
- **Home now lists the documents you actually opened recently**
  ([#194](https://github.com/ProductoryHQ/ritemark-native/issues/194))

## Upgrading

Everyone gets this through the normal in-app update: macOS on Apple Silicon and
Intel, and Windows.
