# Deck icons: proof

Run on 16 November 2026 after 18:00 EET, on macOS arm64, by the builder. There was one dev window of this branch, started with `scripts/qa/dev-launch-isolated.sh` (a fresh profile, throwaway AI homes, `--use-mock-keychain`). It was launched once and quit at once (`LEFT=0`). `ritemark.features.decks` was turned on in its settings, followed by Reload Window. The project was a copy of Sprint 157's demo project, with one ordinary document added (`Harbour Logistics/Session notes.md`). The window is 1440 × 900 and the shots are 2×. The CDP helper is new-deck's `cdp.mjs`, with a `clip` step added for the close-ups. Light theme only.

- `deck-tab-documents-rail-1440.png`: the deck "AI assistants and agents" is open. Its tab and its Documents row show the easel (Phosphor `presentation`). `Session notes.md` beside it keeps the document page, and `README.md` keeps its book. The rail's fourth place is the Slide library, drawn with Phosphor `cards`.
- `rail-closeup.png`: a close-up of the rail and the Documents rows.
- `home-last-changed-and-quick-open-1440.png`: on Home, Last changed shows both decks with the easel and `Session notes.md` and `README.md` with the page. Quick open (⌘P, "assistants and agents") shows the deck with the easel. The project's folder line under its name was painted out afterwards, because it named a local path.
- `deck-library-slide-strip-1440.png`: slide 5 is a copy from the library. With the AI column folded, the strip has room and shows.
- `from-the-library-line-closeup.png`: "From the library · Agents" under the slide, drawn with `cards`.
- `strip-thumb-menu-closeup.png`: the menu of a library slide in the strip. Show in the library is drawn with `cards`.
- `slide-library-place-1440.png`: the Slide library place is chosen (the `cards` place in the rail). Each topic ("Agents", "AI assistants") and the other deck show the easel, as before this PR.

**Before and after the Experience lead's three changes.** The shots above are the "before". They show the library as `cards`, a deck's name split as "…deck" with only ".md" muted, and the notes preview cut at the divider (`deck-tab-documents-rail-1440.png`). The "after" shots come from a second run at head `b8b5713` (#751 merged in, patch 018 changed, the client transpiled), the same evening, launched once and quit at once (`LEFT=0`). After its second Reload Window, that run's window came back at 1728 × 1084 rather than 1440 × 900, and Electron's CDP offers no way to set the window size. So the "after" full shot is 1728 wide, and the close-ups are cropped from it:

- `documents-deck-and-md-closeup.png`: in Documents, the deck reads "AI assistants and agents" with the whole ".deck.md" muted. `Session notes.md` beside it keeps the page with ".md" muted. The DOM shows `<span class="label-extension">.deck.md</span>`. This close-up comes from the 1440 × 900 window, before it changed size.
- `strip-thumb-menu-closeup.png`: the strip's ⋯ menu on a library slide. Show in the library uses `cards-three`, and Duplicate keeps `copy`.
- `from-the-library-line-closeup.png`: "From the library · Agents" with `cards-three`.
- `notes-preview-ellipsis-closeup.png`: "Speaker notes · Welcome everyone. Ask who …" on one line. It ends with the stylesheet's "…" inside the stage, before the dotted divider (`scrollWidth > clientWidth`, `text-overflow: ellipsis`).
- `after-library-slide-strip-1728.png`: the whole window. It shows the rail's `cards-three` place, the deck tab, Documents, the strip and slide 5 with its library line.

That run also showed a toast, "Activating extension 'GitHub.copilot-chat' failed: The default value for setting chat.cli.planExitMode.enabled is different in packageJson and in code." This branch did not cause it. In the dev tree cloned from `rundev-main`, the built-in Copilot extension's `package.json` gives `github.copilot.chat.cli.planExitMode.enabled` the default `true`, while its prebuilt `dist/extension.js` registers it with `false`: the dev tree's built-in Copilot extension is out of step with its `package.json`. This PR touches neither.

Not shot: Search's results (covered by `search.test.ts`), New → Deck (it already used `presentation` through the product icon `ritemark-deck`), the strip's + menu "From the library…" (the same Icon change as the thumbnail menu), the dark theme and the flag-off run.
