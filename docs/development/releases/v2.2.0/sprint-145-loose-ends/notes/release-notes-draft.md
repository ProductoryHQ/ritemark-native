# Release notes lines (E5, S55)

Drafts for 2.2's release notes, one per user-visible change, written for the `release-notes` skill's pass near the release. Plain words: what people can now do.

## PR 1 (#588)

*R1 as revised on 1 November: both changes stay, merged by paragraph.*

- **Fixed:** When an AI or another app saves the document you're writing in, your words and its changes now both stay. Before, a copy made just before your last words could quietly replace them.
- **New:** If you both changed the same paragraph, Ritemark keeps yours and shows Review changes at the top of the document, so you can look at the other version and pick one. Nothing else stops you from typing.
- **Good to know:** One Undo takes back the other app's changes, if you don't want them.
- **Known limit:** If the other copy is a rewrite of almost the whole file, Ritemark can't tell what changed. Within 30 seconds of your last save it asks which version to keep; after that the copy replaces your words, as before.
- **Good to know:** If you discard your changes to a file (or switch branches) within 30 seconds of typing in it, Ritemark asks first; choose Use disk version to finish.

## PR 6 (#515)

*R12: Electron 43.8.6, on Node.js 24.22.1.*

- **Security:** Ritemark now runs on Electron 43.8.6, which includes the Node.js security fixes of 21 October and the newest Chromium security fixes for everything Ritemark shows, the built-in browser included.
