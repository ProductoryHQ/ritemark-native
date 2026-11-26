# Ritemark 2.4.0 Test Checklist

- **Fresh** rows run in a test instance with its own throwaway folders and AI homes. Follow [2.2’s How to start](../v2.2.0/TEST-CHECKLIST.md#how-to-start).
- Tick a row only when it passes. Record the issue number for a failure or the reason a row stayed unticked.

## Decks

1. [ ] **Decks off before launch.** Write `"ritemark.features.decks": false` into a fresh profile's user settings before its first start. The Slide library is absent from the places row from the first frame and the rest of the row stays in place. Repeat with a window last closed on the Slide library. It opens on Documents with no flash of the library. With a separate fresh profile and no Decks setting, the library appears after Tasks from the first frame. **Fresh** <sub>#924</sub>
