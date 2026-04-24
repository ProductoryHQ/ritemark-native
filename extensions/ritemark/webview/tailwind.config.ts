import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        ui: ['var(--ritemark-ui-font-family)'],
        editor: ['var(--ritemark-editor-font-family)'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--r-accent)',
          foreground: 'var(--accent-foreground)',
          deep: 'var(--r-accent-deep)',
          darker: 'var(--r-accent-darker)',
          soft: 'var(--r-accent-soft)',
          fainter: 'var(--r-accent-fainter)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        surface: {
          DEFAULT: 'var(--r-surface)',
          muted: 'var(--r-surface-muted)',
          soft: 'var(--r-surface-soft)',
        },
        ink: {
          strong: 'var(--r-ink-strong)',
          body: 'var(--r-ink-body)',
          muted: 'var(--r-ink-muted)',
          faint: 'var(--r-ink-faint)',
          disabled: 'var(--r-ink-disabled)',
        },
        hairline: {
          DEFAULT: 'var(--r-hairline)',
          strong: 'var(--r-hairline-strong)',
        },
        ritemark: {
          accent: 'var(--r-accent)',
          'accent-deep': 'var(--r-accent-deep)',
          'accent-darker': 'var(--r-accent-darker)',
          'accent-soft': 'var(--r-accent-soft)',
          'accent-fainter': 'var(--r-accent-fainter)',
          success: 'var(--r-success)',
          'success-soft': 'var(--r-success-soft)',
          warning: 'var(--r-warning)',
          'warning-soft': 'var(--r-warning-soft)',
          error: 'var(--r-error)',
          'error-soft': 'var(--r-error-soft)',
        },
      },
      borderRadius: {
        lg: 'var(--ritemark-radius-lg, 10px)',
        md: 'var(--ritemark-radius-md, 6px)',
        sm: 'var(--ritemark-radius-sm, 4px)',
        pill: 'var(--ritemark-radius-pill, 999px)',
      },
      boxShadow: {
        'ritemark-accent': 'var(--ritemark-shadow-indigo-sm)',
        'ritemark-accent-md': 'var(--ritemark-shadow-indigo-md)',
        'ritemark-lg': 'var(--ritemark-shadow-lg)',
      },
    },
  },
  plugins: [],
}

export default config
