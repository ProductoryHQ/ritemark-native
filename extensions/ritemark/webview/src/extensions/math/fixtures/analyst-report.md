# Attrition report

Across the six warehouses, $n = 48$ shift leaders took part. Their mean score rose from $\bar{x}_1 = 3.1$ to $\bar{x}_2 = 3.9$ on the five-point scale.

## How attrition is counted

The share of leaders who left in a year, against the average number in post:

$$
A = \frac{\text{leavers}}{\tfrac{1}{2}\,(N_{\text{start}} + N_{\text{end}})} \times 100\%
$$

## The change, with its margin

The 95% interval for the change in mean score:

$$
\Delta\bar{x} \pm 1.96\,\frac{s}{\sqrt{n}} = 0.8 \pm 0.21
$$

So the change is larger than its margin: it is not noise.

## By warehouse

| Warehouse | Leaders | Mean change |
| --- | --- | --- |
| North | $n_1 = 9$ | $\Delta\bar{x}_1 = 0.7$ |
| South | $n_2 = 7$ | $\Delta\bar{x}_2 = 1.1$ |

Per warehouse, the margin is wider, because each has fewer leaders:

- North: $\pm 1.96 \cdot s / \sqrt{9}$, about $\pm 0.42$
- South: $\pm 1.96 \cdot s / \sqrt{7}$, about $\pm 0.48$

> The programme cost \$12,000 per warehouse, or \$250 per leader. The regression slope was $\hat{\beta}_1 = 0.31$.

The model behind the slope is $y_i = \beta_0 + \beta_1 x_i + \varepsilon_i$, fitted by least squares.
