# 05. Risk-Based Test Strategy

## Objective

Test what can hurt the business most, rather than treating all code equally.

## Test Model

- Critical user flows: smoke or end-to-end tests.
- Pure logic: unit tests.
- Complex integrations: integration tests.
- Regressions: always get a follow-up test.
- Build and release paths: separate validation.

## First Implementation

- List the top critical user flows.
- Map each flow to existing test coverage.
- Identify untested high-risk flows.
- Define minimum test expectations for change types.

## Starting Checklist

- [ ] Inventory current test commands.
- [ ] List top 10 critical workflows.
- [ ] Map workflows to coverage.
- [ ] Pick first 3 coverage gaps.
- [ ] Define regression test rule.

## Automation Later

- Test coverage map by workflow.
- PR test recommendation based on changed files.
- Release readiness test matrix.
- Automated regression-test reminder when fixing bugs.

