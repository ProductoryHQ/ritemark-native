---
name: codereview
description: Perform high-signal code review focused on bugs, regressions, security risks, and missing tests. Use when asked to review commits, pull requests, branches, patches, or modified files; when findings must be prioritized by severity with file/line evidence; or when deciding whether code is safe to merge.
---

# Codereview

Deliver a risk-first review of code changes with concrete evidence and minimal noise.

## Review Workflow

1. Define scope before reviewing.
- Identify the exact diff to inspect (`git diff`, commit range, PR branch, or file list).
- Confirm base branch and any relevant constraints (performance, compatibility, security, migrations).

2. Build intent context.
- Read ticket text, commit messages, and nearby code paths to infer expected behavior.
- Flag uncertainty explicitly instead of guessing requirements.

3. Inspect changes deeply.
- Prioritize correctness, data integrity, security boundaries, error handling, and concurrency.
- Check behavioral regressions, API contract breaks, and edge-case handling.
- Review nearby unchanged code when risk likely extends beyond edited lines.

4. Validate with tests and execution.
- Run targeted tests or linters when possible.
- If execution is not possible, state exactly what was not verified and the impact on confidence.

5. Report only actionable findings.
- Prioritize by severity and include direct file/line evidence.
- Explain why the issue matters and the likely runtime/user impact.
- Suggest the smallest safe fix direction.

## Findings Contract

Use this response shape:

1. Findings (ordered by severity)
- Include: severity, short title, impact, evidence (`path:line`), and fix direction.
- Report only real risks or likely regressions.

2. Open Questions / Assumptions
- List requirement gaps or ambiguous behaviors that affect confidence.

3. Change Summary (brief)
- Give a short overview only after findings.

If no issues are found, state that explicitly and include residual risk and testing gaps.

## Severity Guidance

Use [references/severity-rubric.md](references/severity-rubric.md) to classify findings consistently.

## Coverage Checklist

Use [references/review-checklist.md](references/review-checklist.md) when scanning risk areas.
