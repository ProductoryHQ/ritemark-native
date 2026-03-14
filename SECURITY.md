# Security Policy

## Scope

This policy covers:

- **Ritemark extension code** (`extensions/ritemark/`)
- **VS Code patches** (`patches/`)
- **Build and release scripts** (`scripts/`)

This policy does **not** cover VS Code OSS itself. For issues in VS Code core, please report them to [Microsoft's VS Code repository](https://github.com/microsoft/vscode).

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | Best effort |

## Reporting

If you discover a security issue, please report it responsibly:

1. **Email:** hello@productory.ai
2. **Subject line:** `[SECURITY] Brief description`
3. **Include:** Steps to reproduce, affected version, potential impact

**Please do not open a public GitHub issue for security reports.**

## Response Timeline

| Step | Timeframe |
|------|-----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Fix or mitigation | Depends on severity |

## What to Report

- Code execution or injection paths in the extension
- Unsafe handling of user files or API keys
- Dependencies with known vulnerabilities
- Build system issues that could compromise distributed binaries

## Out of Scope

- VS Code core vulnerabilities (report to Microsoft)
- Issues requiring physical access to the machine
- Social engineering
- Denial of service against local applications

## Recognition

We appreciate responsible reporting. With your permission, we will credit you in the release notes for any confirmed fix.
