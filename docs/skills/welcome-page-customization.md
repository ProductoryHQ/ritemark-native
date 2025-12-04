# Skill: Updating the RiteMark Welcome Page

## Overview

The Welcome page in RiteMark is a customized version of VS Code's "Getting Started" page. It's built into the VS Code core, **not** in the RiteMark extension.

## Key Files

| File | Purpose |
|------|---------|
| `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` | Main TypeScript logic - layout, content, interactions |
| `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css` | Core CSS styles |
| `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStartedGuide.css` | Guide steps styling (Productory brand colors) |
| `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/ritemark-logo.svg` | RiteMark logo with "BY PRODUCTORY" tagline |

## File Locations

```
vscode/src/vs/workbench/contrib/welcomeGettingStarted/
├── browser/
│   ├── gettingStarted.ts              # Main logic
│   ├── gettingStartedColors.ts        # Theme color registrations
│   ├── gettingStartedInput.ts         # Editor input handling
│   ├── gettingStartedService.ts       # Service for walkthroughs
│   └── media/
│       ├── gettingStarted.css         # Core styles
│       ├── gettingStartedGuide.css    # Guide step styles
│       └── ritemark-logo.svg          # Logo asset
└── common/
    ├── gettingStartedContent.ts       # Start menu entries
    └── media/
        └── *.svg                      # Various VS Code assets
```

## Current Structure (gettingStarted.ts)

The Welcome page layout is defined around line 819-860:

```typescript
// RiteMark: Updated Welcome page with logo
const logoUri = FileAccess.asBrowserUri('vs/workbench/contrib/welcomeGettingStarted/browser/media/ritemark-logo.svg');
const header = $('.header', {},
    $('img.ritemark-logo', { src: logoUri.toString(true), alt: 'RiteMark' }),
    $('p.subtitle.description', {}, localize({...}, "Markdown for AI tools. Without syntax."))
);

const leftColumn = $('.categories-column.categories-column-left', {});   // Start menu
const centerColumn = $('.categories-column.categories-column-center', {}); // Recent files
const rightColumn = $('.categories-column.categories-column-right', {});  // Guide + Walkthroughs
```

### Guide Steps (buildGuideList method, line ~992)

Custom guide with numbered steps:

```typescript
private buildGuideList(): HTMLElement {
    const steps = [
        {
            title: "Create a Project",
            description: "Open a folder to organize your markdown files.",
            button: { label: "Open Folder", command: 'openFolder' }
        },
        {
            title: "Add Content",
            description: "Create a new file to start writing.",
            button: { label: "New File", command: 'selectStartEntry:welcome.showNewFileEntries' }
        },
        {
            title: "Write with AI",
            description: "Use the AI assistant to generate or edit text."
        }
    ];
    // ...
}
```

## CSS: Guide Step Colors (gettingStartedGuide.css)

Uses Productory brand colors for numbered steps:

```css
.getting-started-guide-step:nth-child(2) .step-number { color: #4338ca; } /* Productory Indigo */
.getting-started-guide-step:nth-child(3) .step-number { color: #2dd4bf; } /* Electric Cyan */
.getting-started-guide-step:nth-child(4) .step-number { color: #d946ef; } /* Magenta Ray */
```

## How to Update

### Step 1: Edit Source Files

Make changes in the `vscode/src/` folder:
- **Content/Logic**: Edit `gettingStarted.ts`
- **Styles**: Edit `gettingStarted.css` or `gettingStartedGuide.css`
- **Logo**: Replace `ritemark-logo.svg`

### Step 2: Copy to Output Folder

For immediate testing without full rebuild, copy to `vscode/out/`:

```bash
# Copy SVG
cp vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/ritemark-logo.svg \
   vscode/out/vs/workbench/contrib/welcomeGettingStarted/browser/media/

# Copy CSS
cp vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css \
   vscode/out/vs/workbench/contrib/welcomeGettingStarted/browser/media/
```

### Step 3: Restart RiteMark

**Important**: Electron caches assets in memory. A simple refresh won't work.

1. **Quit completely** (Cmd+Q on Mac)
2. Optionally clear cache: `rm -rf ~/Library/Application\ Support/RiteMark/Cache`
3. **Restart**: `./scripts/code.sh`

### Step 4: For Permanent Changes

Run a full compile to ensure build system picks up changes:

```bash
cd vscode && yarn compile
```

## Common Customizations

### Change the Logo

1. Create/export SVG at 424x130 viewBox
2. Replace `ritemark-logo.svg` in both `src/` and `out/` folders
3. Restart RiteMark

### Change the Tagline

Edit `gettingStarted.ts` around line 823:

```typescript
$('p.subtitle.description', {}, localize({...}, "Your new tagline here"))
```

### Add/Remove Guide Steps

Edit the `steps` array in `buildGuideList()` method (~line 995).

### Change Step Colors

Edit `gettingStartedGuide.css` - the `nth-child` selectors target each step number.

## Important Notes

1. **Don't confuse with extension walkthrough**: The `extensions/ritemark/package.json` defines a separate walkthrough accessed via Command Palette → "Get Started with RiteMark"

2. **Localization**: Use `localize()` for any user-facing strings to support future translations

3. **High contrast support**: Both CSS files include `.hc-black` and `.hc-light` overrides for accessibility

4. **Grid layout**: The page uses CSS Grid with responsive breakpoints for `width-constrained` and `height-constrained` states
