---
name: ritemark-automation
description: Drive the Ritemark dev instance from the terminal via Chrome DevTools Protocol — for end-to-end testing, demo recordings, and release screenshots. Use whenever you need to launch Ritemark, interact with its UI (AI sidebar, integrated browser, Settings, command palette), or capture screenshots/screen recordings programmatically. Built on agent-browser + the launch skill, with Ritemark-specific knowledge (trust dialog, separate browser-tab CDP targets, workspace requirement for AI features, feature-flag JSON layer).
allowed-tools: Read, Bash, Glob, Grep
metadata:
  version: 1.0.0
---

# Ritemark Automation Skill

Companion to the upstream `launch` skill in `vscode/.claude/skills/launch/`. The launch skill teaches generic VS Code automation via CDP. This skill layers on the **Ritemark-specific** gotchas that bit us during Sprint 69 e2e validation.

## When to use

- E2E validation of any AI or browser feature in the dev instance.
- Recording demo videos for release marketing (run the flow, screen-record the window).
- Generating release screenshots (Settings, AI sidebar in action, browser-aware chat, browser control consent, etc.).
- Reproducing user-reported bugs in a reproducible environment.

If the task is just "launch Ritemark dev so I can poke at it manually," use the normal dev launch workflow instead. This skill is for driving the UI without a human in the loop.

## Prerequisites — verify once per session

```bash
# 1. agent-browser binary present? (it lives inside vscode/node_modules, not globally)
ls /Users/jarmotuisk/Projects/ritemark-native/vscode/node_modules/.bin/agent-browser
# If missing: cd vscode && npm install (or run `./scripts/code.sh` once which auto-installs)

# 2. arm64 Node available? (dev launch needs arm64, NOT the x86_64 v23.0.0 nvm default)
ls /Users/jarmotuisk/.nvm/versions/node/v22.21.1/bin/node && \
  file /Users/jarmotuisk/.nvm/versions/node/v22.21.1/bin/node | grep -q arm64 && echo "arm64 ✓" || echo "MISSING arm64 node"

# 3. Port 9224 free?
lsof -t -i :9224 && echo "port in use" || echo "port free"
```

## Canonical launch incantation

There is exactly one correct way to launch Ritemark for automation. Memorize the shape:

```bash
# Pick a fresh user-data-dir for each automation run so prior consent dialogs,
# auto-share state, and feature-flag toggles don't leak between runs.
USERDATA="/tmp/ritemark-automation-userdata"
WORKSPACE="/tmp/ritemark-automation-workspace"
SCREENSHOT_DIR="/tmp/ritemark-screenshots/$(date +%Y-%m-%dT%H-%M-%S)"
mkdir -p "$WORKSPACE" "$SCREENSHOT_DIR"
[ -f "$WORKSPACE/README.md" ] || echo "# Automation Workspace" > "$WORKSPACE/README.md"

cd /Users/jarmotuisk/Projects/ritemark-native/vscode

# Launch in background. The three knobs that matter:
#   --remote-debugging-port=9224       — enables CDP (the whole point)
#   --user-data-dir=$USERDATA          — isolates from your daily Ritemark profile
#   $WORKSPACE (positional)            — gives Ritemark a workspace folder
#                                        WITHOUT THIS, agent execution blocks with
#                                        "No workspace folder open. Please open a folder first."
#                                        and you'll waste a debugging session.
VSCODE_SKIP_PRELAUNCH=1 \
  PATH=/Users/jarmotuisk/.nvm/versions/node/v22.21.1/bin:$PATH \
  ./scripts/code.sh \
    --remote-debugging-port=9224 \
    --user-data-dir=$USERDATA \
    $WORKSPACE &

# Connect with retry — first launch is slow.
for i in 1 2 3 4 5 6 7 8 9 10; do
  if npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode \
       agent-browser connect 9224 2>/dev/null; then
    echo "Connected on try $i"; break
  fi
  sleep 3
done
```

**`VSCODE_SKIP_PRELAUNCH=1`** skips the `preLaunch.ts` step that checks/installs node_modules and runs Electron build. After your first launch it's safe to skip; if the launch fails saying Electron is missing, remove the env var for one launch and add it back.

**`PATH=...v22.21.1...`** forces the arm64 Node. The system default `node` is x86_64 under Rosetta — esbuild and tsx blow up with arch-mismatch errors. v22.21.1 is the documented dev-mode Node (see `.claude/skills/vscode-development/SKILL.md`).

## After-launch UI gotchas — handle these first

### 1. Workspace trust dialog

If `$WORKSPACE` is a path Ritemark hasn't seen before, you get:

> Do you trust the authors of the files in this folder?

It's a modal — every other click will fail with `Element ... is blocked by another element (likely a modal or overlay)`. Dismiss it FIRST:

```bash
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser snapshot -i | grep -E "trust the authors"
# Find the "Yes, I trust the authors" ref, then:
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser click @e27   # ref will vary
```

To avoid re-prompting on every run, reuse the same `$USERDATA` across runs after the first time — the trust decision is persisted there.

### 2. The Browser activity-bar tab vs. integrated browser tabs

`agent-browser tab` will show **multiple CDP targets** as soon as you open any integrated browser tab. Example after opening one:

```
  [0] sprint69-workspace — vscode-file://.../workbench-dev.html      ← the workbench window
→ [1] Sprint 69 Test — file:///tmp/sprint69-test.html               ← the browser tab webview
```

agent-browser **auto-switches to the most recently activated target** (the loaded webview). To take screenshots of the AI sidebar or interact with workbench UI again, switch back:

```bash
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser tab 0
```

This is the single most common foot-gun. Symptom: `screenshot --full` produces just the loaded HTML page, not Ritemark. Fix: `tab 0`.

### 3. Browser control is enabled on macOS

`browser-agent-control` is a stable macOS feature flag. You should not need to edit `settings.json` to enable Sprint 69 browser-control tools. If a browser action is ignored, verify that the active platform is macOS and that the extension bundle was reloaded after rebuilding.

### 4. AI features require a workspace folder

`_handleAgentExecution` in `UnifiedViewProvider.ts` short-circuits with `"No workspace folder open."` if `_workspacePath` is undefined. **Always pass `$WORKSPACE` as a positional arg to `code.sh`** (see the canonical incantation). If you forgot and the agent errors out, kill + relaunch with the workspace — there's no in-app fix.

## Interacting with the AI sidebar

Ritemark's AI sidebar uses Monaco for its composer. The launch skill warns that `keyboard type` may silently fail on Code OSS Monaco, but in practice — **on the Ritemark dev build, `keyboard type` works for the chat input.** Try it first; only fall back to per-character `press` if text doesn't appear.

```bash
# 1. Focus chat input. The AI sidebar exposes this shortcut globally.
# (If your prompt doesn't end up in the chat, the secondary side bar may not be open.
#  Open it with Cmd+Opt+B or click the Ritemark AI tab.)
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser press Control+Meta+i
sleep 1

# 2. Type the prompt. keyboard type works:
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser keyboard type \
  'Summarize what is on this page in one sentence.'

# 3. Send.
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser press Enter
```

**Fallback for character-by-character typing** (only if `keyboard type` produces empty text — verify with a screenshot):

```bash
PROMPT='Hello world'
for ((i=0; i<${#PROMPT}; i++)); do
  CHAR="${PROMPT:$i:1}"
  case "$CHAR" in
    " ") npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser press Space > /dev/null ;;
    '"') npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser press Shift+Quote > /dev/null ;;
    *)   npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser press "$CHAR" > /dev/null ;;
  esac
done
```

## Opening an integrated browser tab

```bash
# 1. Click the Browser activity-bar tab (left strip). Discover its ref via snapshot.
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser snapshot -i | grep -E 'tab "Browser"'
# Example output: - tab "Browser" [ref=e9]
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser click @e9

# 2. Click "New Browser Tab".
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser snapshot -i | grep -E 'New Browser Tab'
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser click @e12    # ref will vary

# 3. URL bar — keyboard type works here.
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser snapshot -i | grep -E 'Enter a URL'
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser click @e22
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser keyboard type "file:///tmp/test.html"
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser press Enter

# 4. !!! Switch CDP back to the workbench tab — see gotcha #2 above.
sleep 2
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser tab 0
```

## Screenshots — paper trail for demos and release notes

```bash
# Save with timestamped name inside SCREENSHOT_DIR. Always use --full to capture
# the whole workbench window, NOT just the active webview.
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser \
  screenshot --full "$SCREENSHOT_DIR/$(date +%H-%M-%S)-state.png"

# If you need an element-specific screenshot:
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser \
  screenshot ".part.auxiliarybar" "$SCREENSHOT_DIR/sidebar.png"
```

**For release notes / marketing assets:**
- Always switch to `tab 0` before screenshotting workbench surfaces.
- Use `--full` for hero shots; element selectors for cropped UI elements.
- Set OS appearance to Light or Dark deliberately — Ritemark's theme follows `window.autoDetectColorScheme`. To force a theme:
  ```bash
  # in $USERDATA/User/settings.json
  "workbench.preferredLightColorTheme": "ritemark-light"
  "workbench.preferredDarkColorTheme": "ritemark-dark"
  # then macOS: defaults write -g AppleInterfaceStyle Dark   (or remove key for Light)
  ```
- Hide PII before screenshotting — the title bar shows the workspace path. Either screenshot before opening files, or set `window.titleBarStyle` to something that omits the path.

**macOS Screen Recording permission:** if `screenshot` returns "Permission denied," your terminal needs **System Settings → Privacy & Security → Screen Recording** access. Fallback: use the verification snippet in `launch` SKILL.md to confirm UI state without a real screen capture.

## Demo recordings

agent-browser doesn't record video, but Ritemark windowed on macOS can be captured via:

```bash
# Whole window, lossless, while your automation script runs in another shell:
WID=$(osascript -e 'tell application "System Events" to get id of window 1 of application process "Code - OSS"')
# Or just use built-in screen recording: Cmd+Shift+5 → record selected window.
# Run your agent-browser flow with deliberate sleeps so cuts read well.
```

Practical pattern: write the automation as a single bash script with `sleep 2` between visible steps so the recording reads as a deliberate sequence rather than a blur of instant transitions.

## Cleanup — always do this

Leaving Code-OSS running consumes 1–4 GB of RAM and holds the CDP port. After every automation run:

```bash
npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser close
pids=$(lsof -t -i :9224)
if [ -n "$pids" ]; then kill $pids; fi
# Verify:
lsof -i :9224 && echo "still running" || echo "stopped"
```

## Common failure modes — quick reference

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `Cannot connect to 9224` after launch | code.sh still building; never started; another instance on port | `lsof -i :9224`; wait longer; or kill + relaunch |
| `Element @eN is blocked by another element` | Modal open (trust dialog, consent dialog, error popup) | `snapshot -i` to find + dismiss the modal first |
| `screenshot --full` shows just an HTML page | CDP target auto-switched to integrated browser webview | `agent-browser tab 0` to switch back |
| AI sidebar replies "No workspace folder open" | Launched without positional workspace arg | Kill, relaunch with `$WORKSPACE` as last arg |
| Browser-control tools are unavailable | Extension was not rebuilt/reloaded, or not running on macOS | Rebuild extension, reload window, verify platform and feature flag status |
| esbuild arch error / `darwin-arm64 ... needs darwin-x64` | x86_64 Node from nvm v23 | Prefix PATH with `/Users/.../v22.21.1/bin` (arm64) |
| `keyboard type` produces empty text | Monaco editor not focused / dropped silently | Re-press `Ctrl+Cmd+I` to focus chat; fall back to per-char `press` |
| Two CDP targets and `snapshot` returns sparse output | Connected to the wrong target (the browser webview, not workbench) | `tab` to list, `tab 0` to switch back |

## Calling convention

Every `agent-browser` invocation from this skill uses `--prefix /Users/jarmotuisk/Projects/ritemark-native/vscode` so we pick the binary out of the vscode submodule's node_modules rather than depending on a global install. Keep the prefix to avoid "command not found" surprises when the repo is the only place the dep is declared.

A short shell function helps readability if you write a longer automation script:

```bash
ab() {
  npx --no-install --prefix /Users/jarmotuisk/Projects/ritemark-native/vscode agent-browser "$@"
}
ab connect 9224
ab snapshot -i | head -30
ab screenshot --full "$SCREENSHOT_DIR/state.png"
ab tab 0
```
