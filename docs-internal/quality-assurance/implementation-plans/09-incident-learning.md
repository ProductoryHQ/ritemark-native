# 09. Incident Learning

## Objective

Make every significant bug or security issue permanently improve the system.

## Rule

Every important incident should create at least one lasting improvement:

- a test;
- a lint or static check;
- a review checklist item;
- a documented pattern;
- a refactor that makes recurrence harder.

## First Implementation

- Create a short post-incident template.
- Require one prevention action for every significant incident.
- Track whether the prevention action was completed.
- Review repeated incident categories monthly.

## Starting Checklist

- [ ] Draft incident learning template.
- [ ] Define what counts as significant.
- [ ] Add prevention action field.
- [ ] Review 3 past bugs and identify missing prevention.
- [ ] Feed prevention actions into triage.

## Automation Later

- Bug-fix PR detector that asks for regression coverage.
- Incident category trend report.
- Follow-up reminder for prevention actions.

