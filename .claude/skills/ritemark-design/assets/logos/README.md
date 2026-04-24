# Logos

Ritemark logos live in the ritemark-native repo at:

- `branding/icons/` — app icons (macOS, Windows, Linux)
- `branding/PRODUCTORY Logo-horizontal.svg` and other SVGs — Productory parent-company marks
- `branding/welcome/` — welcome-screen branding

**This skill does not bundle Ritemark-specific logo files.** When producing an artifact that needs the actual Ritemark logo (release banner, marketing hero, social-share image), fetch it from the ritemark-native repo at the path above.

## The Ritemark mark

For mock / prototype work (preview HTMLs, slide templates, skill-authored examples), the "R" mark is rendered in CSS, not as an SVG:

```html
<div style="
  width: 48px; height: 48px;
  border-radius: 10px;
  background: var(--r-accent);
  color: #FFFFFF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ritemark-font-display);
  font-weight: 700;
  font-size: 22px;
  box-shadow: var(--ritemark-shadow-indigo-sm);
">R</div>
```

Sizes:
- 32×32 — inline, email, dense contexts
- 48×48 — welcome, marketing hero
- 64×64 — slide cover, social share

Radius is always proportional: `~20%` of the square. Never a circle. Never a hexagon. Never rounded to a pill.

## Usage rules (same as branding/)

**DO:**
- Use the rounded-square indigo mark at the sizes above.
- Match the indigo drop-shadow on the mark when it appears on welcome/splash/marketing surfaces.
- Invert to the white-on-Deep-Space version on dark backgrounds.

**DON'T:**
- Distort the aspect ratio.
- Change the mark color outside `var(--r-accent)` (light) / `var(--ritemark-dark-indigo)` (dark).
- Add shadows beyond the indigo signature shadow.
- Replace the "R" with a different letter or glyph.
- Pair the mark with the Productory parent-company gradient. Ritemark has its own brand; gradient belongs to `productory-design`.
