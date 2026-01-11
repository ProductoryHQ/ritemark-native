# Sprint 17 Clarifications (RESOLVED)

Status: All questions resolved. Sprint approved for development.

---

## Resolved Decisions

### 1) File payload format
**Decision:**
- CSV: UTF-8 string (text file, works with TextDocument)
- Excel: Base64 encoded binary (bypass TextDocument, read with fs.readFileSync)

**Rationale:** Excel files are binary (ZIP format). TextDocument corrupts binary data. Direct file read + Base64 is clean and SheetJS natively supports it.

### 2) Message contract
**Decision:** See sprint-plan.md "Message Contract" section for full spec.

Required fields per file type:
- All: `type`, `fileType`, `filename`, `content`
- CSV/Excel: `sizeBytes`
- Excel only: `encoding: 'base64'`
- Markdown: `properties`, `hasProperties`, `imageMappings` (existing fields)

### 3) Sheet selector scope
**Decision:** Default to first sheet in Sprint 17. Sheet selector is out of scope.

### 4) Table UX
**Decisions:**
- Sticky header row: Yes
- First row as header: Yes (default assumption)
- Column sizing: Auto-size with virtualization, no manual resize in Sprint 17

### 5) Size and limits
**Decisions:**
- Display limit: 10k rows rendered (virtualized)
- Parse warning: Show banner if file > 5MB before parsing
- `sizeBytes` in payload allows pre-parse warnings

### 6) Error handling
**Decision:** Compact error view in webview (filename + short message). Detailed errors logged to console.

### 7) Test fixtures
**Decision:** Place in `extensions/ritemark/src/test/fixtures/` (permanent location), not sprint docs folder.

Test files created during research:
- `test-files/test.xlsx` - simple Excel (3 rows)
- `test-files/test.csv` - simple CSV (4 rows)

### 8) Bundle size verification
**Decision:**
- Check: `ls -la extensions/ritemark/media/webview.js`
- Target: < 2MB after Sprint 17 (currently ~900KB, projected ~1.4MB)
- Document in qa-validator checks

---

## Technical Discovery (from sanity testing)

**Excel binary handling tested and verified:**
```
1. fs.readFileSync() returns Buffer (4856 bytes for test file)
2. buffer.toString('base64') encodes to string (6476 chars)
3. JSON.stringify/parse roundtrip works
4. XLSX.read(base64, { type: 'base64' }) parses correctly
5. Data extracted successfully
```

This bypasses the TextDocument limitation without architectural changes.
