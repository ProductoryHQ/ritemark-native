# Sprint 57 Research 03: Official Claude Code VSIX Inspection

Date: 2026-05-01  
Purpose: verify how the official Anthropic VS Code extension packages Claude Code on Windows.

## Summary

The official `Anthropic.claude-code` VSIX confirms the extension-level bundled-runtime architecture.

For Windows x64, the official extension ships a native `claude.exe` inside the VSIX. It does not rely on global npm, user-installed Node, `install.ps1`, or PATH as the happy path.

Sprint 57 should use this as the primary technical pattern for Claude:

```text
Ritemark package -> extension/app resources -> bundled Claude runtime -> spawn directly
```

System-installed Claude should remain only as an advanced override or recovery path.

## Download Commands Used

The generic `latest` package download:

```bash
curl -L -o /tmp/anthropic-claude-code-latest.vsix \
  'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/Anthropic/vsextensions/claude-code/latest/vspackage'
```

The version-pinned Windows x64 package download:

```bash
curl -L -o /tmp/anthropic-claude-code-2.1.126-win32-x64.vsix \
  'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/Anthropic/vsextensions/claude-code/2.1.126/vspackage?targetPlatform=win32-x64'
```

Note: `latest` plus `targetPlatform=win32-x64` returned a Marketplace error saying latest had no support for that target platform. The version-pinned URL downloaded the package correctly, and its manifest declares `TargetPlatform="win32-x64"`.

## Package Format

The downloaded package is gzip/tar, not a zip-readable VSIX:

```bash
file /tmp/anthropic-claude-code-latest.vsix
# gzip compressed data

tar -tzf /tmp/anthropic-claude-code-latest.vsix
```

## Key Files

Relevant file list:

```text
extension.vsixmanifest
extension/package.json
extension/extension.js
extension/resources/audio-capture/x64-win32/audio-capture.node
extension/resources/native-binary/claude.exe
extension/webview/index.css
extension/webview/index.js
```

Important sizes:

```text
VSIX compressed: about 79 MB
extension/resources/native-binary/claude.exe: about 242 MB extracted
```

Binary type:

```text
extension/resources/native-binary/claude.exe:
PE32+ executable (console) x86-64, for MS Windows
```

## Manifest Findings

`extension.vsixmanifest`:

```xml
<Identity Language="en-US" Id="claude-code" Version="2.1.126" Publisher="Anthropic" TargetPlatform="win32-x64"/>
<Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
<Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true" />
```

`extension/package.json`:

```json
{
  "name": "claude-code",
  "version": "2.1.126",
  "publisher": "Anthropic",
  "dependencies": {},
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": false,
      "description": "untusted workspaces are not supported"
    }
  }
}
```

The extension declares no npm dependencies in `package.json`, which supports the conclusion that the bundled native runtime is the Windows happy path.

## Runtime Resolution Findings

The minified `extension.js` includes runtime resolution logic equivalent to:

```text
binaryName = process.platform === "win32" ? "claude.exe" : "claude"
try resources/native-binaries/<platform>-<arch>/<binaryName>
if win32 arm64, try resources/native-binaries/win32-x64/<binaryName>
try resources/native-binary/<binaryName>
if no native binary exists, try resources/claude-code/cli.js and require Node >= 18
```

The relevant implementation detail is that the native binary is resolved before the JS/Node fallback.

The extension also has a setting:

```text
claudeCode.claudeProcessWrapper
```

This appears to support wrapping or overriding process launch behavior.

## Windows Shell Findings

The extension code checks:

- `CLAUDE_CODE_GIT_BASH_PATH`
- common Git Bash install locations
- `where.exe git`
- Windows PowerShell and `pwsh`

The error text says Claude Code on Windows requires either Git for Windows or PowerShell, and lets users set `CLAUDE_CODE_GIT_BASH_PATH`.

For Ritemark, this means bundled Claude runtime likely removes Node/npm/PATH from onboarding, but it does not automatically remove every shell/tool dependency from all Claude tool behavior.

## Workspace Trust Finding

The official Anthropic extension declares:

```json
"capabilities": {
  "untrustedWorkspaces": {
    "supported": false
  }
}
```

So Anthropic's pattern is not "run in untrusted workspaces." It requires trusted workspaces for full operation.

Ritemark still needs a separate Workspace Trust decision:

- disable Workspace Trust at product level for a document-first app, or
- mark the Ritemark extension as supporting untrusted workspaces only if all startup behavior is safe without trust, or
- keep Workspace Trust and make the first-run trust step explicit.

## Development Implications

Actionable Sprint 57 implications:

- Do not use `install.ps1` for Claude onboarding.
- Do not require global `npm install -g @anthropic-ai/claude-code`.
- Do not require user-installed Node for the happy path if a native runtime is bundled.
- Build Ritemark runtime resolution around an app/extension-owned binary path first.
- Keep a system-installed binary override for advanced troubleshooting.
- For the implementation spike, assume redistributed bundled runtimes so the technical path can be tested.
- Verify redistribution rights before public release if the technical path works.

## Sources

- Official Marketplace page: https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code
- Anthropic setup docs: https://docs.anthropic.com/en/docs/claude-code/getting-started
- Anthropic IDE integration docs: https://docs.anthropic.com/en/docs/claude-code/ide-integrations
- Local inspection artifact: `/tmp/anthropic-claude-code-2.1.126-win32-x64.vsix`
