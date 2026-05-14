# 07. Dependency And Build Hygiene

## Objective

Keep dependencies, scripts, lockfiles, and build validation predictable.

## First Implementation

- Document the canonical validation commands.
- Compare local validation with CI.
- Review package age and vulnerability status.
- Watch for unexpected lockfile churn.
- Confirm release validation catches build-sensitive failures.

## Starting Checklist

- [ ] Inventory package managers and lockfiles.
- [ ] Inventory validation scripts.
- [ ] Confirm `./scripts/validate-qa.sh` expectations.
- [ ] Identify dependency scan command.
- [ ] Define lockfile review rule.

## Automation Later

- Scheduled dependency report.
- Lockfile change classifier.
- Build script drift detector.
- Release preflight summary.

