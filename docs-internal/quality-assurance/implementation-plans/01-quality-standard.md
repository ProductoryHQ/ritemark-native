# 01. Quality Standard

## Objective

Define what "good code" means for Ritemark in practical, reviewable terms.

## First Implementation

- Create a short quality standard document with rules for architecture, error handling, logging, testing, dependencies, and user data handling.
- Keep the first version under 2 pages.
- Link each rule to one preferred project pattern or example.
- Mark rules as required, recommended, or situational.

## Initial Sections

- Architecture boundaries.
- State and data flow.
- Error handling and logging.
- User data and privacy.
- Dependency policy.
- Test expectations by change type.
- Security-sensitive areas.

## Starting Checklist

- [ ] Identify existing project patterns worth preserving.
- [ ] Identify patterns that should be discouraged.
- [ ] Draft the standard.
- [ ] Review it against 3 recent PRs or changes.
- [ ] Convert unclear rules into examples.

## Automation Later

- Static checks for disallowed imports or dependency types.
- AI review prompt grounded in the standard.
- PR template section that asks which standard areas are affected.

