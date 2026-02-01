# Word Export Analysis (Issue #6)

## Problem

Word export produces raw markdown instead of formatted document:
- Shows `# Header` instead of formatted heading
- Shows `**bold**` instead of bold text
- Shows `- [ ] Task` instead of checkbox
- Shows `- Item` instead of bullet list

## Current Implementation

**File:** `extensions/ritemark/src/export/wordExporter.ts`

The code structure looks correct:
- Uses `docx` library (well-maintained, 10M+ downloads)
- Has parsing logic for headings, bold, italic, lists, code blocks
- Creates proper Word document structure

**So why doesn't it work?**

## Investigation Required

### Hypothesis 1: Wrong Content Passed to Exporter

**Check:** What content reaches `exportToWord()`?

The function receives `markdown: string` from the extension. Need to verify:
- Is it raw markdown from document?
- Is it TipTap HTML?
- Is it something else?

**Debug approach:**
```typescript
export async function exportToWord(
  markdown: string,
  properties: DocumentProperties,
  documentUri: vscode.Uri
): Promise<void> {
  // DEBUG: Log first 500 chars
  console.log('Word export input:', markdown.substring(0, 500))

  // ... rest of function
}
```

**Expected:** Raw markdown like `# Heading\n\nSome **bold** text`
**If different:** Need to trace back where content comes from

### Hypothesis 2: Windows Line Endings Break Regex

**Problem:** Windows uses `\r\n` (CRLF) while Unix uses `\n` (LF)

**Current parsing code (line ~120):**
```typescript
function parseMarkdownToDocx(markdown: string, properties: DocumentProperties): Paragraph[] {
  const lines = markdown.split('\n')
  // ... process lines
}
```

If markdown contains `\r\n`, splitting on `\n` leaves `\r` at end of each line:
- Line becomes: `"# Heading\r"`
- Regex: `/^(#{1,6})\s+(.+)$/` expects line to end with `$`
- But `\r` causes mismatch!

**Fix:**
```typescript
// Normalize line endings before processing
const normalizedMarkdown = markdown.replace(/\r\n/g, '\n')
const lines = normalizedMarkdown.split('\n')
```

**Likelihood:** HIGH - This is a very common cause of cross-platform parsing bugs

### Hypothesis 3: Regex Patterns Need Refinement

**Current patterns:**

```typescript
// Heading (line ~130)
const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

// Bold (line ~180)
text.replace(/\*\*(.+?)\*\*/g, ...)

// List item (line ~140)
const listMatch = line.match(/^\s*[-*+]\s+(.+)$/)
```

These look correct, but might fail on edge cases:
- Trailing whitespace: `# Heading  \n`
- Mixed formatting: `**bold _italic_**`
- Nested lists with different indentation

**Potential improvements:**
```typescript
// More lenient heading regex (allow trailing whitespace)
const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/)

// Trim whitespace before processing
const trimmedLine = line.trim()
```

## Solution Strategy

### Step 1: Add Debug Logging

```typescript
export async function exportToWord(
  markdown: string,
  properties: DocumentProperties,
  documentUri: vscode.Uri
): Promise<void> {
  // Log input
  console.log('=== WORD EXPORT DEBUG ===')
  console.log('Input length:', markdown.length)
  console.log('First 200 chars:', markdown.substring(0, 200))
  console.log('Has \\r\\n:', markdown.includes('\r\n'))
  console.log('Has \\n:', markdown.includes('\n'))

  // ... rest of function
}
```

### Step 2: Normalize Line Endings

```typescript
function parseMarkdownToDocx(markdown: string, properties: DocumentProperties): Paragraph[] {
  // CRITICAL FIX: Normalize line endings
  const normalized = markdown.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  console.log('Total lines:', lines.length)
  console.log('First 5 lines:', lines.slice(0, 5))

  // ... rest of parsing
}
```

### Step 3: Test Parsing with Sample Content

Create test markdown file with all features:
```markdown
# Heading 1

Some **bold** and *italic* text.

- Item 1
- Item 2

1. Numbered item
2. Another item

- [ ] Unchecked task
- [x] Checked task

`inline code` and:

```
code block
```
```

Export and verify each element is formatted correctly.

### Step 4: Handle Edge Cases

```typescript
// Trim whitespace from lines
const trimmedLine = line.trim()

// Skip empty lines
if (!trimmedLine) {
  paragraphs.push(new Paragraph({ text: '' }))
  continue
}

// Process line...
```

## Root Cause Prediction

**Most likely:** Windows line endings (`\r\n`) breaking regex patterns.

**Confidence:** 80%

**Why:** This is an extremely common bug in cross-platform text processing:
- Extension runs on Windows
- Document has Windows line endings
- `split('\n')` leaves `\r` at end of lines
- Regex `$` anchors don't match `\r`
- Parsing fails silently
- Raw text output to Word

**Quick test:** Open document in VS Code, check line ending indicator in status bar. If it shows "CRLF", this is the issue.

## Testing Plan

### Test 1: Line Ending Normalization

1. Create test.md with Windows line endings (CRLF)
2. Add content: `# Test\r\n\r\n**Bold** text\r\n`
3. Export to Word
4. Verify: Heading is formatted, text is bold

### Test 2: All Markdown Features

Test markdown:
```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text* and ***both***.

- Unordered list
- Second item
  - Nested item

1. Ordered list
2. Second item

- [ ] Todo item
- [x] Done item

`inline code` here.

```
code block here
```

Link: [Text](https://example.com)
```

Expected: All elements formatted correctly in Word.

### Test 3: Edge Cases

- Empty lines
- Trailing whitespace
- Mixed formatting
- Windows vs Unix line endings
- Very long lines

## Files to Modify

| File | Changes |
|------|---------|
| `extensions/ritemark/src/export/wordExporter.ts` | Add line-ending normalization, improve regex patterns, add debug logging |

## Fix Implementation (Predicted)

**Minimal fix (most likely to solve issue):**

```typescript
function parseMarkdownToDocx(markdown: string, properties: DocumentProperties): Paragraph[] {
  // FIX: Normalize line endings (Windows \r\n → Unix \n)
  const normalized = markdown.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  // ... rest of existing code unchanged
}
```

**That's it.** One line of code may fix the entire issue.

## Verification Strategy

1. Test on Windows with CRLF file
2. Test on macOS with LF file
3. Test with mixed line endings
4. Compare output to expected formatting
5. Use Word to open and verify all elements

## Estimated Complexity

**Low-Medium** - Most likely a simple fix:
- If it's line endings: 1 line of code, 30 minutes to test
- If it's more complex: 1-2 hours to debug and fix

**High confidence** this is a simple normalization issue.

## Related Code

**Where markdown comes from:**

Trace back from `ritemarkEditor.ts`:
```typescript
case 'export:word':
  await exportToWord(
    document.getText(),  // <-- Raw document text
    this.parseProperties(document),
    document.uri
  );
```

So it's definitely raw markdown from the document, which means it includes the file's actual line endings (CRLF on Windows).

## Conclusion

**Root cause:** 80% confident it's Windows line endings (`\r\n`) breaking regex patterns

**Fix:** Normalize line endings before parsing

**Testing:** Create test files with both CRLF and LF line endings

**Time estimate:** 1-2 hours (including testing and verification)
