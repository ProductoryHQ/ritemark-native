# Ritemark 2.4.0 Test Checklist

- **Fresh** rows run in a test instance with its own throwaway folders and AI homes. Follow [2.2’s How to start](../v2.2.0/TEST-CHECKLIST.md#how-to-start).
- Tick a row only when it passes. Record the issue number for a failure or the reason a row stayed unticked.

## Decks

1. [ ] **Decks off before launch.** Write `"ritemark.features.decks": false` into a fresh profile's user settings before its first start. The Slide library is absent from the places row from the first frame and the rest of the row stays in place. Repeat with a window last closed on the Slide library. It opens on Documents with no flash of the library. With a separate fresh profile and no Decks setting, the library appears after Tasks from the first frame. **Fresh** <sub>#924</sub>

## AI chat

1. [ ] **A web link opens once (#1091).** In an AI answer that contains a web link, click it. The browser opens the page once, and back in Ritemark no "Do you want Ritemark to open the external website?" dialog is waiting. Also click a project file link in the same answer: it opens in Ritemark, with no dialog.
