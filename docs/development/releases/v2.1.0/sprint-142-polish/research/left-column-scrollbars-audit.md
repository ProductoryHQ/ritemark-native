# A3: The white scrollbar track in the left column (R8; #504)

Run on 26 October 2026 on a dev build of `main` at `84ea15db`, in the same hidden instance as A2. The left-column places were read in Ritemark Light.

## What paints the white strip

It is not the panel's background: Transcribe's list (`flex-1 overflow-y-auto pb-4`) is transparent, and the page's `body` is the ground (`rgb(241, 245, 249)`). The strip comes from VS Code's own webview defaults, injected into every webview as `#_defaultStyles` (`@layer vscode-default`):

```css
html { scrollbar-color: var(--vscode-scrollbarSlider-background) var(--vscode-editor-background); }
```

- `scrollbar-color` is inherited, so every scroller in a webview gets a track in the editor's background. That is white in Ritemark Light: the list's computed value is `rgba(148, 163, 184, 0.25) rgb(255, 255, 255)`.
- Chromium uses the standard `scrollbar-color` over the `::-webkit-scrollbar*` rules the same defaults also set, so the track is drawn white whenever the list overflows.
- On the desk (documents, Home) the track sits on white and can't be seen. On the ground (the left column) and on the AI's sheet it shows.

## Which places

These are the webviews in the left column, from `package.json`'s views and their providers:

| Place | Page | Gets the shared CSS |
|---|---|---|
| Home's projects list | `ProjectsViewProvider` → `media/webview.js` | yes |
| Tasks' list | `TasksViewProvider` → `media/webview.js` | yes |
| Transcribe | `TranscribeViewProvider` → `media/webview.js` | yes |
| Agents | `AgentLibraryViewProvider`, its own HTML | no |
| Browser (Recent) | `BrowserPanelProvider`, its own HTML | no |

Every one of them inherits the white track whenever its list scrolls.

## The look to match

Documents' tree uses VS Code's own scrollbar: no track, a 10 px slider in `scrollbarSlider.background`, shown while the pointer is over the tree or it scrolls.

## Decision

- **`webview/src/index.css`** (every page built with it):
  - `html { scrollbar-color: <slider> transparent }`, overriding the default's track only. The desk and the AI's sheet then show their own surface under the slider.
  - On the ground pages (`html.rm-ground`), lists use `scrollbar-width: thin`, and the slider shows while the pointer is over the list or it scrolls (a `data-scrolling` mark set for a second by one passive scroll listener).
- **`rm-ground`** goes on the `<html>` of the three shared pages in the left column (Home's projects, Tasks' list, Transcribe).
- **The same two rules** go into the Agents and Browser pages' own `<style>`.
