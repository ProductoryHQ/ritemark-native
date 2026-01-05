# Sprint 02 - Research Context

## Goal

Integrate real RiteMarcok WYSIWYG editor into the VS Code webview.

![](./images/002A821E-268B-4764-BDA8-6B867AC618EA.jpeg)

* * *

## RiteMark Web Editor Analysis

### Editor Stack

| Component | Technology |
| --- | --- |
| Editor framework | TipTap v3.4+ (React wrapper for ProseMirror) |
| Markdown conversion | Turndown (HTML→MD) + Marked (MD→HTML) |
| UI components | Radix UI + Lucide icons |
| Styling | Inline CSS in React |

### Main Editor Location

`/Users/jarmotuisk/Projects/ritemark/ritemark-app/src/components/Editor.tsx` (756 lines)

### Key Features

-   Bold, Italic, Underline, Strikethrough
    
-   Headings (H1-H6)
    
-   Lists (bullet, ordered, nested)
    
-   Code blocks with syntax highlighting
    
-   Tables with resize, header rows
    
-   Images with resize
    
-   Blockquotes, horizontal rules
    
-   Slash commands (`/Heading1`, `/Table`, etc.)
    
-   Formatting bubble menu
    
-   Selection tracking
    

### Files to Extract

```plaintext
ritemark-app/src/
├── components/
│   ├── Editor.tsx                    # Main editor (756 lines)
│   ├── FormattingBubbleMenu.tsx      # Toolbar
│   ├── TableOverlayControls.tsx      # Table UI
│   └── TablePicker.tsx               # Table dialog
├── extensions/
│   ├── SlashCommands.tsx             # Slash commands
│   ├── tableExtensions.ts            # Table config
│   ├── imageExtensions.ts            # Image resize
│   └── PersistedSelectionExtension.ts
└── types/
    └── editor.ts                     # TypeScript types
```

* * *

## VS Code Webview Integration Approach

### How It Works

1.  VS Code webview = embedded Chromium browser
    
2.  Can run full React + TipTap stack
    
3.  Communication via `postMessage` API
    
4.  File I/O through extension host
    

### Architecture

```plaintext
┌─────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)       │
│  - File read/write                      │
│  - Document management                  │
│  - postMessage bridge                   │
└────────────────┬────────────────────────┘
                 │ postMessage
┌────────────────▼────────────────────────┐
│  Webview (Chromium)                     │
│  - React app                            │
│  - TipTap editor                        │
│  - Full web capabilities                │
└─────────────────────────────────────────┘
```

### Message Flow

```plaintext
1. User opens .md file
2. Extension reads file from disk
3. Extension sends content to webview via postMessage
4. Webview renders TipTap editor with content
5. User edits
6. Webview sends changes back via postMessage
7. Extension writes to disk
```

* * *

## Sprint 02 Approach Options

### Option A: Embed Full Web App Bundle (Recommended)

-   Build ritemark-app as standalone bundle
    
-   Load bundle in VS Code webview
    
-   Fastest path to working editor
    
-   Reuses existing tested code
    

### Option B: Extract @ritemark/core Package

-   Create shared package from web app
    
-   More work upfront
    
-   Better long-term maintainability
    
-   Enables web + native to share code
    

### Recommendation

**Start with Option A** for Sprint 02 (get it working), then refactor to Option B in Sprint 03 (shared packages).

* * *

## Technical Considerations

### Webview Limitations

-   No direct filesystem access (must go through extension)
    
-   CSP restrictions (can be configured)
    
-   No Node.js APIs (pure browser environment)
    

### What Works in Webview

-   React, TipTap, ProseMirror ✅
    
-   All CSS/styling ✅
    
-   Local state management ✅
    
-   postMessage communication ✅
    

### What Needs Adaptation

-   File I/O → Extension bridge
    
-   Google Drive → Remove for native (local files only)
    
-   Image upload → Local file handling
    

* * *

## Dependencies to Include in Webview

```json
{
  "@tiptap/react": "^3.4.0",
  "@tiptap/starter-kit": "^3.4.0",
  "@tiptap/extension-table": "^3.4.0",
  "@tiptap/extension-image": "^3.4.0",
  "@tiptap/extension-link": "^3.4.0",
  "@tiptap/extension-placeholder": "^3.4.0",
  "turndown": "^7.1.0",
  "marked": "^9.0.0",
  "react": "^18.0.0",
  "react-dom": "^18.0.0"
}
```

* * *

## Success Criteria for Sprint 02

From master plan (Week 2):

- [ ] Real editor component renders in webview
- [ ] Can edit and save .md files
- [ ] All editor features work (formatting, tables, etc.)
- [ ] Jarmo: "I can do real work in this"