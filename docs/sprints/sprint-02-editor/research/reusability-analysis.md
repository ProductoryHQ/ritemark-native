# Reusability Analysis - RiteMark Web App

## Summary

**80% of the code can be reused** from ritemark web app.

* * *

## Tier 1: Direct Copy (Ready to Use)

| Component |  | Lines |
| --- | --- | --- |
| 17 UI Components |  | ~2000 |
| Tailwind Config |  | ~100 |
| Utility Functions |  | ~500 |
| Type Definitions |  | ~1000 |
| CloudStorageProvider |  | ~400 |
| AI Services |  | ~500 |
| Settings Context |  | ~100 |

**Total: ~4,600 lines ready to copy**

* * *

## Tier 2: Small Modifications Needed

| Component | Source Path | What to Change |
| --- | --- | --- |
| Editor.tsx | `components/Editor.tsx` | Remove image upload to Drive, make injectable |
| FormattingBubbleMenu | `components/FormattingBubbleMenu.tsx` | None (self-contained) |
| TableOverlayControls | `components/TableOverlayControls.tsx` | None |
| SlashCommands | `extensions/SlashCommands.tsx` | Remove Drive-specific commands |
| TipTap Extensions | `extensions/*.ts` | None |

* * *

## Tier 3: Not Reusable for Native

-   Google Picker integration (web-only)
    
-   Netlify Functions backend
    
-   OAuth flow (needs native implementation)
    
-   Landing pages
    

* * *

## Recommended Approach for Sprint 02

### Step 1: Copy Reusable Code

```bash
# From ritemark-app/src/ to ritemark-native/extensions/ritemark/webview/src/

# UI Library
cp -r components/ui/ → webview/src/components/ui/
cp lib/utils.ts → webview/src/lib/utils.ts

# Editor (modify after copy)
cp components/Editor.tsx → webview/src/components/Editor.tsx
cp components/FormattingBubbleMenu.tsx → webview/src/components/
cp components/TableOverlayControls.tsx → webview/src/components/
cp components/TablePicker.tsx → webview/src/components/

# Extensions
cp -r extensions/ → webview/src/extensions/

# Types
cp types/editor.ts → webview/src/types/

# Config
cp tailwind.config.ts → webview/tailwind.config.ts
```

### Step 2: Modify Editor.tsx

Remove:

-   `DriveImageUpload` import and usage
    
-   `AIChatSidebar` (defer to Sprint 03)
    
-   Google Drive specific code
    

Add:

-   `onImageUpload?: (file: File) => Promise<string>` prop
    
-   postMessage bridge for VS Code communication
    

### Step 3: Create Webview Build

Use Vite to bundle React + TipTap for VS Code webview:

-   Output single JS + CSS file
    
-   Configure CSP-compatible build
    
-   Include all TipTap extensions
    

* * *

## Dependencies to Include

From ritemark-app package.json:

```json
{
  "@tiptap/react": "^3.4.3",
  "@tiptap/starter-kit": "^3.4.3",
  "@tiptap/extension-table": "^3.6.6",
  "@tiptap/extension-link": "^3.4.3",
  "@tiptap/extension-placeholder": "^3.4.3",
  "@tiptap/extension-code-block-lowlight": "^3.4.4",
  "@tiptap/extension-bubble-menu": "^3.6.6",
  "marked": "^16.3.0",
  "turndown": "^7.2.1",
  "turndown-plugin-gfm": "^1.0.2",
  "lowlight": "^3.3.0",
  "react": "^19.1.1",
  "react-dom": "^19.1.1",
  "lucide-react": "^0.544.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0"
}
```

* * *

## Time Savings Estimate

| Approach | Estimated Time |
| --- | --- |
| Build from scratch | 3-4 days |
| Reuse existing code | 1-2 days |

**Savings: 50-60%**