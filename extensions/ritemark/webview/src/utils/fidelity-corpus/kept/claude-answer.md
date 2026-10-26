I'd split this into two steps: first make the report reproducible, then make it faster.

## Step 1: make it reproducible

The report pulls from three places today:
- the CRM export (`deals.csv`)
- the finance sheet
- a manual list of renewals

Put all three behind one script, so the numbers come from the same run:

```python
def build_report(deals, finance, renewals):
    rows = merge(deals, finance)
    rows = add_renewals(rows, renewals)
    return summarize(rows)
```

## Step 2: make it faster

Once it is one script, two things help most:

1. Cache the CRM export for the day.
2. Only recompute the quarters that changed.

> **Note:** the finance sheet uses `snake_case` column names like `net_revenue` and `close_date`, so the merge has to rename them.

A few things to check before you start:
- [ ] Who owns the finance sheet?
- [ ] Can the export run at night?
- [x] Is the renewals list still needed?

Let me know if you'd like me to write the merge function.
