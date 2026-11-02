# Sprint 152: lines for 2.2's release notes

Written with the `release-notes` skill, for `docs/releases/v2.2.0/release-notes.md` when the release writes it. The truth check runs on 2.2's candidate: these lines were seen on the Mac only (Windows is 2.2's Gate 2).

## What you can do (PR 2, the shell)

- **Nothing moves while Ritemark starts.** The window opens in its final shape: your places, your project's Home and its tabs are there from the first moment. A new project opens on its Home, and a first start opens on the welcome.

## What you can do (PR 3, the loading look)

- **A quiet sign while Ritemark starts.** When a tab or the welcome takes a moment, a small turning mark shows after a second, and after ten seconds a line says Ritemark is still starting.

## Smaller changes (PR 2)

- **No more "Git not found" message.** Ritemark no longer asks you to download Git when a folder uses it.

## Left out, and why

- PR 3's progress lines in ink and the terminal tab's half-pixel: too small to notice on their own. The changelog has them.

- The switch question's fix (#623) has no line: it needs another app's question to stop a switch at once, which none of Ritemark's own do. The changelog has it.

## PR 1 (already merged, for the same notes)

- **The AI column draws once.** While Ritemark checks that you are signed in, the AI column shows one turning mark, then your chat or the sign-in.
- **The AI column you closed stays closed.** Open it again with its button.
