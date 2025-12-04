# Productory Brand Guidelines for AI Agents

This document provides visual identity instructions for AI agents generating content, designs, or code for Productory.

---

## Logo

### Logo Variants

| Variant | File | Use Case |
|---------|------|----------|
| Horizontal Logo | `PRODUCTORY Logo-horizontal.svg` | Primary logo for most applications. Use on light backgrounds. |
| Logo with Large Icon | `productory-logo-big-icon.svg` | Alternative layout with prominent icon. Good for social media avatars. |
| Logo with Small Icon | `productory-logo-small-icon.svg` | Compact version with smaller icon placement. |
| Logo on Dark Background | `productory-logo-small-icon-on-dark-background.svg` | Inverted version for dark backgrounds and overlays. |
| Logo Mark | `productory-logo-mark.svg` | Icon only. Use when space is limited or brand is already established. |

### Logo Usage Rules

**DO:**
- Use the horizontal logo as the primary choice
- Maintain adequate clear space around the logo (minimum = height of the "P" mark)
- Use the dark background variant on dark surfaces
- Use the logo mark when space is constrained

**DON'T:**
- Stretch or distort the logo proportions
- Change the logo colors outside brand palette
- Place light logo on light backgrounds
- Add effects like shadows or gradients to the logo

### Product Logos

| Product | Description |
|---------|-------------|
| Ritemark | Visual markdown editor for AI tools. Create markdown without learning syntax. |

---

## Colors

### Primary Palette

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| Productory Indigo | `#4338ca` | R: 67, G: 56, B: 202 | Primary Brand Color |
| Electric Cyan | `#2dd4bf` | R: 45, G: 212, B: 191 | Secondary / Highlights |
| Deep Space | `#1e1b4b` | R: 30, G: 27, B: 75 | Backgrounds / Footers |
| Magenta Ray | `#d946ef` | R: 217, G: 70, B: 239 | Accents / CTAs |

### Neutral Colors

| Name | HEX | Usage |
|------|-----|-------|
| Slate 900 | `#0f172a` | Primary Text |
| Slate 600 | `#475569` | Body Text |
| Slate 100 | `#f1f5f9` | Card Backgrounds |
| White | `#ffffff` | Surface |

### Brand Gradients

**Primary Gradient (135deg):**
```css
background: linear-gradient(135deg, #2dd4bf 0%, #4338ca 50%, #d946ef 100%);
```

**Mesh / Surface Gradient:**
```css
background-image:
  radial-gradient(at 0% 0%, #2dd4bf 0px, transparent 50%),
  radial-gradient(at 100% 0%, #d946ef 0px, transparent 50%),
  radial-gradient(at 100% 100%, #4338ca 0px, transparent 50%);
```

**Dark Mesh Background:**
```css
/* Base: Deep Space background */
background-color: #1e1b4b;

/* Mesh overlay (with opacity ~40%) */
background-image:
  radial-gradient(at 0% 0%, #2dd4bf 0px, transparent 50%),
  radial-gradient(at 100% 0%, #d946ef 0px, transparent 50%),
  radial-gradient(at 100% 100%, #4338ca 0px, transparent 50%);
```

### Color Accessibility

- Use white text (`#ffffff`) on: Productory Indigo, Deep Space, Magenta Ray
- Use dark text (`#0f172a`) on: Electric Cyan, Slate 100, White

---

## Typography

### Font Families

| Purpose | Font | Source |
|---------|------|--------|
| Headlines / Display | Space Grotesk | Google Fonts / Local |
| Body / UI | Sofia Sans | Google Fonts |

### Type Scale

| Role | Font | Weight | Size | Line Height | Usage |
|------|------|--------|------|-------------|-------|
| Overline | Space Grotesk | Medium (500) | 12-14px | 1.5 | Section Labels, Category Tags, Uppercase with Letter-spacing |
| Display H1 | Space Grotesk | Bold (700) | 48-64px | 1.1 | Main Hero Titles, Cover Pages |
| Heading H2 | Space Grotesk | SemiBold (600) | 32-40px | 1.2 | Section Headers |
| Heading H3 | Space Grotesk | Medium (500) | 24px | 1.3 | Subsection Titles |
| Body Large | Sofia Sans | Regular (400) | 18px | 1.6 | Lead Paragraphs |
| Body Default | Sofia Sans | Regular (400) | 16px | 1.6 | Standard Content |
| Caption / Label | Sofia Sans | SemiBold (600) | 12px | 1.5 | UI Elements, Metadata, Uppercase |

### Typography Colors

**Headings in Documents:**
- Use `#4338ca` (Productory Indigo) for headings to maintain brand consistency
- Body text uses neutral colors (Slate 600 `#475569` or Slate 900 `#0f172a`)

**Gradient Text (Web/Digital only):**
```css
background: linear-gradient(90deg, #4338ca, #d946ef, #2dd4bf);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```
Note: Gradient text is not supported in MS Word. Use solid Indigo for print.

### Font Loading (Web)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Sofia+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
```

### Tailwind CSS Configuration

```javascript
fontFamily: {
  sans: ['Sofia Sans', 'sans-serif'],
  display: ['Space Grotesk', 'sans-serif'],
},
colors: {
  brand: {
    dark: '#1e1b4b',
    primary: '#4338ca',
    secondary: '#2dd4bf',
    accent: '#d946ef',
    surface: '#f8fafc',
  }
}
```

---

## UI Components

### Buttons

**Variants:**

| Variant | Background | Text | Border | Use Case |
|---------|------------|------|--------|----------|
| Primary | `#4338ca` | white | none | Main actions, CTAs |
| Secondary | `#f1f5f9` | `#0f172a` | none | Alternate actions |
| Ghost | transparent | `#4338ca` | 2px `#4338ca` | Subtle actions |
| Accent | gradient `#d946ef` → `#c026d3` | white | none | Highlight CTAs |
| Secondary Accent | `#2dd4bf` | `#0f172a` | none | Alternate highlight |

**Sizes:**

| Size | Padding | Border Radius | Font Size |
|------|---------|---------------|-----------|
| Small (sm) | 0.5rem 1rem | 0.5rem | 14px |
| Medium (md) | 0.75rem 1.5rem | 0.75rem | 16px |
| Large (lg) | 1rem 2rem | 0.75rem | 18px |

**Button Styling:**
```css
/* Primary Button */
.btn-primary {
  background: #4338ca;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  font-family: 'Sofia Sans', sans-serif;
  box-shadow: 0 4px 6px -1px rgba(67, 56, 202, 0.25);
  transition: all 150ms;
}
.btn-primary:hover {
  background: #4338b4;
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Secondary Button */
.btn-secondary {
  background: #f1f5f9;
  color: #0f172a;
  /* same padding, radius, font-weight as primary */
}
.btn-secondary:hover {
  background: #e2e8f0;
}

/* Ghost Button */
.btn-ghost {
  border: 2px solid #4338ca;
  color: #4338ca;
  background: transparent;
}
.btn-ghost:hover {
  background: #4338ca;
  color: white;
}
```

**Button Rules:**
- Use Primary buttons for main actions only (one per section)
- Use consistent border-radius (0.75rem / 12px)
- Include focus states for accessibility
- Always add the brand shadow on elevated primary buttons

### Form Fields

**Input Styling:**
```css
.input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 2px solid #e2e8f0;
  background: white;
  color: #0f172a;
  font-family: 'Sofia Sans', sans-serif;
  font-size: 16px;
  transition: all 150ms;
}
.input::placeholder {
  color: #94a3b8;
}
.input:focus {
  border-color: #4338ca;
  box-shadow: 0 0 0 4px rgba(67, 56, 202, 0.1);
  outline: none;
}
```

**Input States:**

| State | Border Color | Background | Ring |
|-------|--------------|------------|------|
| Default | `#e2e8f0` | white | none |
| Focus | `#4338ca` | white | 4px `rgba(67, 56, 202, 0.1)` |
| Error | `#ef4444` | `#fef2f2` | 4px `rgba(239, 68, 68, 0.1)` |
| Success | `#10b981` | `#ecfdf5` | 4px `rgba(16, 185, 129, 0.1)` |
| Disabled | `#f1f5f9` | `#f8fafc` | none |

**Form Labels:**
- Font: Sofia Sans, Medium (500), 14px
- Color: Slate 700 (`#334155`)
- Margin bottom: 0.5rem

**Helper Text:**
- Font: Sofia Sans, Regular (400), 12px
- Color: Slate 400 (`#94a3b8`)
- Error color: Red 500 (`#ef4444`)
- Success color: Emerald 600 (`#059669`)

### Checkboxes & Toggles

**Checkbox:**
```css
.checkbox {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.5rem;
  border: 2px solid #cbd5e1;
  transition: all 150ms;
}
.checkbox:checked {
  background: #4338ca;
  border-color: #4338ca;
}
.checkbox:hover {
  border-color: rgba(67, 56, 202, 0.5);
}
```

**Toggle Switch:**
```css
.toggle {
  width: 3rem;
  height: 1.75rem;
  border-radius: 9999px;
  background: #cbd5e1;
  padding: 0.25rem;
  transition: background 200ms;
}
.toggle.active {
  background: #4338ca;
}
.toggle-knob {
  width: 1.25rem;
  height: 1.25rem;
  background: white;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 200ms;
}
.toggle.active .toggle-knob {
  transform: translateX(1.25rem);
}
```

### UI Component Rules

**DO:**
- Use 0.75rem (12px) border-radius consistently
- Include focus rings for accessibility (4px spread)
- Show clear error/success states with icons
- Use brand shadows on elevated elements

**DON'T:**
- Use multiple primary buttons in the same section
- Mix border-radius styles (keep rounded-xl / 0.75rem)
- Skip focus states
- Use red for non-destructive actions

---

## Quick Reference

### When generating Productory content:

1. **Headers**: Use Space Grotesk, Bold/SemiBold, in Productory Indigo (`#4338ca`)
2. **Body text**: Use Sofia Sans, Regular, in Slate 600 (`#475569`) or Slate 900 (`#0f172a`)
3. **Backgrounds**: Use Deep Space (`#1e1b4b`) for dark sections, White/Slate 100 for light
4. **Accent elements**: Use Electric Cyan (`#2dd4bf`) for highlights, Magenta Ray (`#d946ef`) for CTAs
5. **Gradients**: Apply the primary gradient (Cyan → Indigo → Magenta) for hero sections or key visual moments

### Brand Voice (Visual):
- Bold and technical
- Human-centric
- Modern with geometric precision
- High contrast between dark backgrounds and vibrant accent colors
