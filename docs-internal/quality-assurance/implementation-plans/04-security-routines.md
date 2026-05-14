# 04. Security Routines

## Objective

Run security checks as a separate routine, not as a side effect of general code quality.

## Focus Areas

- Dependency vulnerabilities.
- Secrets.
- IPC and message bridge boundaries.
- Webview CSP and sandboxing.
- File system and local process access.
- Logging of sensitive data.
- Supply chain risk.

## First Implementation

- Define security-sensitive paths.
- Run dependency and secret checks before release.
- Add manual review requirements for sensitive path changes.
- Document accepted security patterns for webview, extension, and native/runtime boundaries.

## Starting Checklist

- [ ] List security-sensitive directories and files.
- [ ] Identify available dependency scan tooling.
- [ ] Identify available secrets scan tooling.
- [ ] Draft a sensitive-change review checklist.
- [ ] Run one baseline security pass and record findings.

## Automation Later

- Sensitive-path detector for PRs.
- Dependency vulnerability report.
- Secrets scan in local validation and CI.
- AI security review for IPC, webview, persistence, and update paths.

