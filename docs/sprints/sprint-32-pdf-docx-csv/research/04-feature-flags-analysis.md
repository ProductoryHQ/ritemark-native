# Feature Flags Analysis

## Feature Flag Framework

Ritemark Native uses a feature flag system for gating features. See `.claude/skills/feature-flags/SKILL.md` for implementation details.

## Sprint 32 Features Analysis

### 1. PDF Preview

**Flag needed?** NO

**Reasoning:**
- Not platform-specific (works on all platforms)
- Not experimental (standard PDF viewing)
- Not large download (library bundled in webview)
- Not premium feature
- No kill-switch needed (low risk feature)

**Decision:** Ship enabled by default, no flag.

### 2. DOCX Preview

**Flag needed?** NO

**Reasoning:**
- Not platform-specific (works on all platforms)
- Not experimental (standard DOCX viewing)
- Not large download (mammoth is small ~150KB)
- Not premium feature
- No kill-switch needed (low risk feature)

**Decision:** Ship enabled by default, no flag.

### 3. CSV Editing Improvements

**Flag needed?** NO

**Reasoning:**
- Enhances existing feature (CSV editing already exists)
- Not experimental (standard spreadsheet operations)
- No external dependencies (uses existing libraries)
- Not platform-specific
- Not premium feature
- No kill-switch needed (can revert code if bugs found)

**Decision:** Ship enabled by default, no flag.

## When Would We Use Flags?

Examples from the codebase:

### voice-dictation Flag (Existing)
```typescript
{
  id: 'voice-dictation',
  status: 'experimental',
  platforms: ['darwin'],
  requiresDownload: true,
  description: 'Voice dictation using Whisper'
}
```

**Why flagged:**
- macOS only (platform-specific)
- Requires 75MB Whisper model download
- Experimental feature
- Can break if Whisper setup fails

### Future Example: AI Image Generation
```typescript
{
  id: 'ai-image-generation',
  status: 'experimental',
  platforms: ['darwin', 'win32'],
  requiresApiKey: true,
  description: 'Generate images using Gemini API'
}
```

**Why would be flagged:**
- Requires API key (user setup)
- External service dependency (can fail)
- Experimental feature
- Premium/paid API usage

## Sprint 32 Risk Assessment

### PDF Preview Risks
- **Low risk:** PDF.js is mature, battle-tested library
- **Failure mode:** If PDF.js fails, show error → user opens in external app
- **No data loss risk:** Read-only viewer
- **Mitigation:** Error boundaries, fallback to "Open in external app"

### DOCX Preview Risks
- **Low risk:** Mammoth is stable library
- **Failure mode:** If conversion fails, show error → user opens in Word
- **No data loss risk:** Read-only viewer
- **Mitigation:** Error boundaries, clear error messages

### CSV Editing Risks
- **Medium risk:** Data manipulation (add/delete rows/columns)
- **Failure mode:** User could accidentally delete data
- **Data loss risk:** Moderate (but Cmd+Z undo works, file history in VS Code)
- **Mitigation:**
  - Careful testing
  - VS Code auto-saves create file history
  - User can revert via Git or file history
  - No flag needed (standard spreadsheet operations)

## Conclusion

**No feature flags needed for Sprint 32.**

All features are:
- Standard functionality (not experimental)
- Low-risk implementations
- Built on proven libraries
- Cross-platform compatible
- No external dependencies requiring setup

Ship all features enabled by default.

## Flag Checklist (For Future Reference)

Use a feature flag if ANY of these are true:

- [ ] Platform-specific (macOS-only, Windows-only, etc.)
- [ ] Requires large download (>50MB)
- [ ] Experimental/beta quality
- [ ] Premium/paid feature
- [ ] Requires API key or external service
- [ ] High risk of breaking existing functionality
- [ ] Needs kill-switch for remote disable
- [ ] Performance impact on some systems
- [ ] Requires user setup/configuration

**Sprint 32:** All checkboxes are unchecked → No flags needed.
