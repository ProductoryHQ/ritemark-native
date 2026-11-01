# A7: The two log lines (R8, S39, S40, #582)

Run on 31 October 2026 on the Mac, in one hidden dev instance of `main` at `39b4e37f`: a fresh profile under `/private/tmp`, scratch homes for the AIs, `--use-mock-keychain`, the three backgrounding flags, CDP on a port checked to be free. The shell is a copy-on-write clone of a sibling worktree's VS Code 1.142 tree (Electron 43.8.3) whose `patches/vscode/` is byte-identical to `main`'s; every file the patch stack creates is in its `src/` and `out/` (checked file by file). It is not a pristine reset-and-apply: that is PR 5's tree.

## 1. The refused font: found (measured)

`main.log` of the fresh launch, once, 5 s after start:

```
[error] vscode-file: Refused to load resource /phosphor.woff2 from vscode-file: protocol (original URL: vscode-file://vscode-app/phosphor.woff2)
```

The workbench page's style sheets, read over CDP, hold two `@font-face` rules for the family `phosphor`, weight 400:

| Where | `src` |
|---|---|
| `out/vs/base/browser/ui/codicons/codicon/codicon.css` (patch 001's `codicon.css` hunk) | `url("./phosphor.woff2")`, which resolves next to the style sheet, where the font ships |
| `<style id="codiconStyles">`, which VS Code writes from the icon registry's fonts | **`url("vscode-file://vscode-app/phosphor.woff2")`**: the refused URL, at the app root |

The second comes from patch 001's `iconRegistry.ts` hunk: `phosphorFontDefinition` has `src: [{ location: URI.parse('phosphor.woff2'), format: 'woff2' }]`. A bare name parses as `file:///phosphor.woff2`, which the browser side turns into `vscode-file://vscode-app/phosphor.woff2`. So the request comes from Ritemark's own registration, not from a third party, and the icons still draw because `codicon.css` declares the same family at its real place.

**The fix** belongs in patch 001 (shell-tier, PR 5): register the font at its real place, the way VS Code registers the codicon font (`FileAccess.asBrowserUri` of the font beside `codicon.css`), or drop the registry's `src` if VS Code allows a font with none. Checked after the fix by `main.log` of a fresh launch (S39) and a screenshot of the icons. The tier line already names patch 001; no change.

## 2. DEP0169: not reproduced in the dev build; the caller is not Ritemark's own code

- **The dev instance logs no DEP0169.** Its `exthost.log` and the launch's stdout/stderr have no `DEP0169` and no `url.parse` warning after the first extension host start.
- **Node's deprecation trace can't be turned on from outside.** The instance was started with `NODE_OPTIONS=--trace-deprecation`; the extension host's environment, read with `ps eww`, has no `NODE_OPTIONS` (it has the scratch `CODEX_HOME`, `CLAUDE_CONFIG_DIR` and `XDG_*`). VS Code drops it for the extension host.
- **This dev tree differs from a release in the extensions that start.** Its built-in extensions have no `out/` (only VS Code's own `out/` was built), so `git`, `git-base`, `github-authentication`, `emmet` and the rest fail to activate here (`exthost.log`: "Cannot find module …/extensions/git-base/out/extension.js"). In 2.1.0's candidate they start with every window, and #582 counts one DEP0169 per extension host start.
- **Ritemark's bundle does not use Node's `url` module.** `out/extension.js` built from `main` has no `require("url")` / `"node:url"` import at all, so it can't call `url.parse()`. Its esbuild externals (`@anthropic-ai/claude-agent-sdk`, `@agentclientprotocol/sdk`, `pdfkit`, `mathml2omml`) are loaded only when an agent runs or a document is exported, not at every start.
- Read, not run: in 2.1.0's x64 app (`.worktrees/release-7852c9f38fa1/VSCode-darwin-x64`), the built-in extensions that import Node's `url` are `configuration-editing`, `emmet`, `extension-editing`, `git`, `github-authentication`, `markdown-language-features` (its server) and `npm`; a search for `.parse(` on the identifier bound to that import finds none in the first six, and the one in `npm` is `js-yaml`'s. A destructured `parse` or a call inside a dependency would not show in this search, so the caller is **not found**.

**What this means for R8's DEP0169 half:** the caller is VS Code's or a built-in extension's, not Ritemark's own (the bundle can't call it). Finding the exact module needs the stack, which needs a build where the built-in extensions start: PR 5's patched tree, built with its extensions, with `process.traceDeprecation` set in the extension host for one run, or 2.2's candidate. Until then nothing changes in code for it (R8: "nothing in VS Code changes without a reason"), and PR 2 has no DEP0169 item. The log level question (a Node warning in the extension host's stderr logged as `[error]`) is VS Code's own handling and stays as it is unless the caller turns out to be ours.

No tier change: the font is patch 001 (already named), DEP0169 is nothing for now.

## 3. PR 5, 1 November: the font fixed (S39); DEP0169 still not reproduced

**Reproduced first**, in PR 5's tree (a copy-on-write clone patched at the pin with the 19 patches, `main`'s code): `main.log` of a fresh hidden launch has the line once, 5 s after start, and the workbench page's style sheets hold the two `@font-face` rules for `phosphor` described above, the second one in `<style id="codiconStyles">` with `src: url("vscode-file://vscode-app/phosphor.woff2")`. A second fresh launch on another profile with `main`'s files (the frame check's) logged it again.

**The fix** (patch 001): the icon registry's `phosphorFontDefinition` has no source (`src: []`), and `iconsStyleSheet.ts` writes no `@font-face` for a font without one. The registry still names the family for Phosphor's icons (`.codicon-phosphor-…:before { font-family: 'phosphor' }`), and `codicon.css` declares the font where the build puts it: beside the style sheet in a dev build, `out/media/phosphor.woff2` in a release (2.1.0's bundled CSS reads `../../media/phosphor.woff2`). Registering the real place from TypeScript was not possible: the two builds put the file in different folders, so any one path would be refused in the other build.

**After:** the style sheets hold one `phosphor` face, `codicon.css`'s; `<style id="codiconStyles">` has none (read over CDP after Reload Window). `main.log` of a fresh launch of PR 5's build (one more launch, the S47 run's, with every reload and switch it made) has no "Refused to load resource" line. The icons draw from the product icon theme's font (`pi-phosphor-400`, loaded) as before, and the frame check gave the same pixels with `main`'s build and PR 5's in every scene but the dev build's notices. The only icon the registry's `phosphor` family draws, `settings-view-bar-icon`, is not on any 2.0 surface at rest. Check: `ritemarkPhosphorFont.test.ts` (fails on `main`: the sheet has a `@font-face` for `phosphor`).

**DEP0169:** still not seen. This tree's built-in extensions have no `out/` either, so `git`, `emmet`, `github-authentication` and the rest still fail to start in a dev launch; the stack has to come from a build where they start, 2.2's candidate (S41). Nothing in code changes for it in PR 5.
