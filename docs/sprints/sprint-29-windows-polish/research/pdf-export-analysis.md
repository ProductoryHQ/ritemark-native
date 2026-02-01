# PDF Export Analysis (Issue #5)

## Problem

PDF export has two issues:
1. **Images replaced with "[Image]" text** - Instead of embedding actual images
2. **Unicode characters render incorrectly** - Checkboxes (☑ ☐) may show as garbage

## Current Implementation

**File:** `extensions/ritemark/src/export/pdfExporter.ts`

### Issue 1: Image Handling

**Current code (line 344):**
```typescript
.replace(/!\[.*?\]\(.+?\)/g, '[Image]')
```

This regex **removes** images and replaces them with literal text "[Image]".

**Why?** Likely a placeholder/TODO that was never implemented.

### Issue 2: Unicode Rendering

**Current font (line ~50):**
```typescript
doc.font('Helvetica')
```

Helvetica is a standard PDF font but has limited unicode glyph support. Characters like ☑ ☐ are not included.

## Solution Strategy

### Part 1: Image Embedding

**PDFKit API:**
```typescript
doc.image(buffer, x, y, {
  fit: [maxWidth, maxHeight],
  align: 'left'
})
```

**Implementation steps:**

1. **Parse markdown images:**
   ```typescript
   const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
   let match
   while ((match = imageRegex.exec(markdown)) !== null) {
     const alt = match[1]
     const path = match[2]
     // Process image...
   }
   ```

2. **Resolve image paths:**
   - Reuse logic from `ritemarkEditor.ts` `transformImagePaths()`
   - Convert relative paths to absolute
   - Support both local files and URLs

3. **Fetch image data:**
   ```typescript
   async function getImageBuffer(imagePath: string, documentUri: vscode.Uri): Promise<Buffer | null> {
     try {
       if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
         // Remote image - fetch
         const response = await fetch(imagePath)
         return Buffer.from(await response.arrayBuffer())
       } else {
         // Local image - resolve relative to document
         const absolutePath = path.isAbsolute(imagePath)
           ? imagePath
           : path.join(path.dirname(documentUri.fsPath), imagePath)
         return fs.readFileSync(absolutePath)
       }
     } catch (error) {
       console.error(`Failed to load image: ${imagePath}`, error)
       return null
     }
   }
   ```

4. **Embed in PDF:**
   ```typescript
   if (imageBuffer) {
     doc.image(imageBuffer, { fit: [500, 400] })
     doc.moveDown()
   } else {
     // Fallback if image fails to load
     doc.text('[Image not available]')
   }
   ```

5. **Update stripMarkdown():**
   - Remove the image-stripping regex
   - Handle images in main export flow instead

**Complexity:** Medium
- PDFKit API is straightforward
- Image path resolution already exists in codebase
- Main challenge: Layout positioning (where to place images in text flow)

### Part 2: Unicode Font Support

**Option A: Embed Unicode Font (Recommended)**

Use a font with broad unicode support:
- DejaVu Sans (open source, good coverage)
- Noto Sans (Google, comprehensive)
- Arial Unicode MS (if available)

**Implementation:**
```typescript
// Register custom font
doc.registerFont('DejaVu', path.join(__dirname, '../fonts/DejaVuSans.ttf'))
doc.font('DejaVu')
```

**Pros:**
- Proper rendering of all unicode characters
- Professional appearance

**Cons:**
- Increases bundle size (~500KB for DejaVu)
- Need to include font file in extension

**Option B: ASCII Fallback**

Replace unicode with ASCII equivalents:
```typescript
const normalizeCheckboxes = (text: string): string => {
  return text
    .replace(/☑/g, '[x]')
    .replace(/☐/g, '[ ]')
}
```

**Pros:**
- No additional dependencies
- Works with any font

**Cons:**
- Less visually appealing
- Loses semantic meaning

**Recommendation:** Start with Option B (simple), upgrade to Option A if needed.

## Testing Plan

### Image Embedding Tests

1. **Local relative image:**
   ```markdown
   ![Logo](./images/logo.png)
   ```
   Expected: Image appears in PDF

2. **Local absolute image:**
   ```markdown
   ![Icon](/Users/jarmo/Desktop/icon.png)
   ```
   Expected: Image appears in PDF

3. **Remote image:**
   ```markdown
   ![Web](https://example.com/image.jpg)
   ```
   Expected: Image appears in PDF

4. **Missing image:**
   ```markdown
   ![Missing](./not-found.png)
   ```
   Expected: Fallback text "[Image not available]"

5. **Large image:**
   Test with 4000x3000px image
   Expected: Scaled to fit page width

### Unicode Tests

1. **Checkboxes:**
   ```markdown
   - ☑ Done
   - ☐ Todo
   ```
   Expected: Either proper rendering (Option A) or `[x]` / `[ ]` (Option B)

2. **Other unicode:**
   ```markdown
   Emoji: 🎉 Arrows: → ← Mathematical: ≈ ≠
   ```
   Expected: Render or fallback gracefully

## Files to Modify

| File | Changes |
|------|---------|
| `extensions/ritemark/src/export/pdfExporter.ts` | Add image parsing, fetching, embedding; change font or add fallback |
| `extensions/ritemark/fonts/` (new) | Optional: Add DejaVu font files if using Option A |

## Example Code Structure

```typescript
export async function exportToPDF(
  markdown: string,
  properties: DocumentProperties,
  documentUri: vscode.Uri
): Promise<void> {
  // ... existing setup ...

  // Parse content
  const sections = parseMarkdownForPDF(markdown, documentUri)

  for (const section of sections) {
    if (section.type === 'text') {
      doc.text(section.content)
    } else if (section.type === 'image') {
      const buffer = await getImageBuffer(section.path, documentUri)
      if (buffer) {
        doc.image(buffer, { fit: [500, 400] })
      } else {
        doc.text('[Image not available]')
      }
      doc.moveDown()
    } else if (section.type === 'heading') {
      doc.font('Helvetica-Bold').fontSize(24)
      doc.text(section.content)
      doc.font('Helvetica').fontSize(12)
    }
    // ... other types ...
  }

  // ... finalize PDF ...
}
```

## Estimated Complexity

**Medium** - Requires:
- Understanding PDFKit image API (well-documented)
- Reusing existing image path logic
- Handling async image fetching
- Layout considerations for image positioning
- Font handling or unicode fallback

**Estimated time:** 2-3 hours
