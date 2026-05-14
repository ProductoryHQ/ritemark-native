# 02. Regular Codebase Audit

## Objective

Create a repeated audit routine that maps codebase risks before they become urgent.

## Cadence

Run once per sprint, or weekly when release pressure is high.

## Audit Topics

- Architecture drift.
- Duplicated logic.
- Dead code.
- Large or complex modules.
- Weak error handling.
- Untested critical flows.
- Security-sensitive boundaries.
- Outdated or risky dependencies.

## First Implementation

- Pick one audit topic per cycle.
- Produce a short findings list, not a long essay.
- Give each finding a risk level, affected path, recommended next action, and owner.
- Feed accepted findings into the sprint backlog.

## Starting Checklist

- [ ] Define audit template.
- [ ] Choose first 3 audit topics.
- [ ] Run one manual audit.
- [ ] Tag findings as fix-now, next-sprint, or monitor.
- [ ] Review whether the audit produced actionable work.

## Automation Later

- Scheduled AI codebase scan per topic.
- Hotspot report for files with high churn, size, or complexity.
- Duplicate logic detection.
- Audit history trend dashboard.

