# Severity Rubric

Use consistent severity levels so findings are easy to triage.

## P0 - Critical

Use for issues that can cause severe production impact:
- Data loss or corruption
- Privilege escalation or major security bypass
- System-wide outage or crash loop
- Broken financial/legal critical path

Expectation: block merge until fixed.

## P1 - High

Use for major functional or reliability risks:
- High-probability runtime failure in common paths
- Backward-incompatible contract changes without migration
- High-impact performance degradation
- Missing validation/sanitization on sensitive input

Expectation: fix before merge unless explicitly accepted by owner.

## P2 - Medium

Use for meaningful but contained risks:
- Edge-case logic bug with moderate user impact
- Insufficient error handling likely to surface in production
- Partial test gaps around risky logic changes

Expectation: fix soon; merge may proceed with explicit follow-up.

## P3 - Low

Use for minor quality issues:
- Maintainability concerns with low immediate risk
- Non-critical clarity issues that can cause future mistakes

Expectation: optional before merge; good cleanup candidates.

## Confidence Tag

Attach confidence when useful:
- High: directly demonstrated by code path and conditions.
- Medium: strongly inferred, minor unknowns remain.
- Low: plausible risk, needs confirmation.
