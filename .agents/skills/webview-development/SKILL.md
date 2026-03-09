---
name: webview-development
description: Work on the Ritemark webview stack in extensions/ritemark/webview using React, TipTap, Vite, Tailwind, and the VS Code message bridge. Use for blank editor issues, bundle problems, formatting UI bugs, slash commands, and webview-specific build failures.
---

# Webview Development

Use this skill for the editor UI and its build pipeline.

## Use This Skill For

- TipTap editor behavior
- React component bugs in `extensions/ritemark/webview/src/`
- Vite build output and bundle corruption
- Tailwind/CSS processing
- VS Code <-> webview message bridge issues

## Fast Checks

```bash
ls -lh extensions/ritemark/media/webview.js
[ -s extensions/ritemark/webview/postcss.config.js ] && echo OK || echo EMPTY
[ -s extensions/ritemark/webview/tailwind.config.ts ] && echo OK || echo EMPTY
grep -q "@tailwind base" extensions/ritemark/media/webview.js && echo FAIL || echo OK
```

The bundle should be large, roughly around the documented production size. A tiny bundle is a strong signal that the build is broken.

## Build Loop

```bash
cd extensions/ritemark/webview
npm run build
```

When you suspect corrupted dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Debugging Rules

1. Confirm whether the issue is in the bundle, the bridge, or the TipTap/editor setup.
2. Check that extensions are actually registered in `useEditor(...)`, not just imported.
3. Verify message types match on both the extension and webview side.
4. If source changed, make sure the built `media/webview.js` is also regenerated before calling the task done.

## Deep References

Read these only when needed:

- `.claude/agents/webview-expert.md`
- `.claude/skills/flow-testing/SKILL.md` when the UI change touches flow components
