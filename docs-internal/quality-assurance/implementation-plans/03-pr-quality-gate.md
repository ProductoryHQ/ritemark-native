# 03. PR Quality Gate

## Objective

Make each PR review catch architectural, security, testing, and maintainability risks before merge.

## First Implementation

- Add a short PR review checklist.
- Keep the checklist focused on risk, not style.
- Require test rationale for every non-trivial change.
- Require security notes for changes touching IPC, webview bridges, persistence, file system access, auth, update, or release paths.

## Checklist Draft

- Does this fit the existing architecture?
- Does it change a security-sensitive boundary?
- Are failure modes handled?
- Do tests cover the real risk?
- Is user data handled safely?
- Does this increase maintenance cost?
- Is this a system-level fix or a local workaround?

## Starting Checklist

- [ ] Draft PR checklist.
- [ ] Test it on 3 existing changes.
- [ ] Remove vague or low-signal questions.
- [ ] Decide which answers block merge.
- [ ] Add the checklist to the PR template or review guide.

## Automation Later

- AI PR review using the checklist.
- Changed-path risk classifier.
- Automatic request for security review on sensitive paths.
- Required validation command summary.

