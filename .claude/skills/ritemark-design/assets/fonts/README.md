# Fonts

## Sofia Sans

Self-hosted. Files in this folder:

- `SofiaSans-latin.woff2` — Latin subset (U+0000–00FF + common punctuation)
- `SofiaSans-latin-ext.woff2` — Latin Extended (Central/Eastern European, turkish, etc.)

Both are variable fonts, weights 100–900.

These are the same files used by the production Ritemark webview at `extensions/ritemark/webview/src/assets/fonts/`. Kept in sync — if one side updates, copy the update to the other.

The skill's `tokens.css` at the repo root loads Sofia Sans via Google Fonts CDN for standalone mocks and previews. In production Ritemark (the webview), the same family loads from these self-hosted files via `@font-face` in `extensions/ritemark/webview/src/index.css`.

## Space Grotesk

**Not self-hosted in this skill.** Space Grotesk is loaded via Google Fonts CDN in the skill's `tokens.css` (for preview/slide templates). It's not currently loaded in the production Ritemark webview.

If Ritemark ships a surface that uses Space Grotesk (welcome screen, onboarding), self-host it in `extensions/ritemark/webview/src/assets/fonts/SpaceGrotesk-VariableFont_wght.woff2`. Download:

```
https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUxKw7Ifmg.woff2
```

(or grab from https://fonts.google.com/specimen/Space+Grotesk with "Download family," then re-compress to woff2 variable.)

Then wire in `index.css`:

```css
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('./assets/fonts/SpaceGrotesk-VariableFont_wght.woff2') format('woff2-variations');
}
```

See `references/typography.md` for strategy on when Space Grotesk should be added.
