# Quality Assurance Implementation Roadmap

## Purpose

This is the starting document for implementing Ritemark's quality assurance system. The strategy overview explains why the work matters. The implementation plans explain each area in detail. This roadmap explains what to do first.

## Recommended First 3 Moves

Start with these because they are small, high-leverage, and do not require building an automation platform first.

## 1. Define The Quality Standard

Source plan: [01. Quality Standard](./implementation-plans/01-quality-standard.md)

### Why First

Every later review, audit, and automated analysis needs a shared definition of good code. Without this, QA becomes subjective and automation produces generic advice.

### First Deliverable

A short quality standard document that defines:

- architecture boundaries;
- dependency rules;
- error handling and logging expectations;
- user data handling;
- test expectations by change type;
- security-sensitive areas.

### First Week Tasks

- [ ] Pick 5-7 rules that matter most for Ritemark.
- [ ] Link each rule to one existing good or bad example in the codebase.
- [ ] Mark each rule as required, recommended, or situational.
- [ ] Review the standard against 2-3 recent changes.

### Done When

Reviewers can use the standard to make the same decision twice.

## 2. Add A PR Quality Gate

Source plan: [03. PR Quality Gate](./implementation-plans/03-pr-quality-gate.md)

### Why Second

This turns the quality standard into a daily habit. It improves code quality immediately, before larger audits or automation exist.

### First Deliverable

A short PR checklist focused on risks:

- architecture fit;
- security-sensitive boundaries;
- failure modes;
- test coverage for the real risk;
- user data handling;
- maintenance cost;
- local workaround versus system-level fix.

### First Week Tasks

- [ ] Draft the checklist.
- [ ] Test it against 3 recent changes.
- [ ] Remove questions that do not change review decisions.
- [ ] Decide which answers block merge.
- [ ] Add it to the PR template or internal review guide.

### Done When

Every meaningful PR has a short quality and security rationale.

## 3. Start One Sprint-Based Codebase Audit

Source plan: [02. Regular Codebase Audit](./implementation-plans/02-regular-codebase-audit.md)

### Why Third

PR review catches new risk. A sprint audit finds existing risk. Running one narrow audit creates the first real backlog of quality work.

### First Deliverable

One audit report with 5-10 findings, each with:

- risk level;
- affected path;
- recommended next action;
- owner or reviewer;
- decision: fix now, next sprint, or monitor.

### Suggested First Audit Topic

Start with security-sensitive boundaries between VS Code shell, extension host, webview, and local runtime behavior. This is likely where the highest-value Ritemark-specific risks live.

### First Week Tasks

- [ ] Choose one audit topic.
- [ ] Review the relevant paths only.
- [ ] Capture findings in a short structured list.
- [ ] Triage each finding.
- [ ] Convert accepted findings into sprint tasks.

### Done When

The audit creates specific, prioritized work rather than a general report.

## What To Ignore For Now

Do not start with these unless there is an urgent reason:

- dashboards;
- broad quality scores;
- full-repo AI scans;
- new CI infrastructure;
- complex ownership systems;
- coverage percentage targets.

These are useful later, but they are premature until the standard, PR gate, and first audit exist.

## 30-Day Roadmap

## Week 1: Foundation

- Write the first quality standard.
- Draft the PR checklist.
- Identify security-sensitive paths.

## Week 2: First Use

- Apply the PR checklist to active work.
- Run the first focused audit.
- Triage audit findings.

## Week 3: Process Stabilization

- Revise the standard based on real review friction.
- Promote accepted findings into sprint work.
- Define the first recurring QA cadence.

## Week 4: Automation Selection

- Identify repeated manual checks.
- Decide which checks should become scripts, CI gates, or AI-assisted reviews.
- Avoid automating checks that have not yet produced useful manual findings.

## Decision Rule

Automate only after a manual routine has proven that it catches real risk.

## Primary Reading Order

1. Read this roadmap.
2. Read [Strategy Overview](./strategy-overview.md) for context.
3. Read [01. Quality Standard](./implementation-plans/01-quality-standard.md).
4. Read [03. PR Quality Gate](./implementation-plans/03-pr-quality-gate.md).
5. Read [02. Regular Codebase Audit](./implementation-plans/02-regular-codebase-audit.md).

