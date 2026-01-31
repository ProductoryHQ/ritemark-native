# Sprint 27: RAG v2 - Enhanced Retrieval Pipeline

**Status:** Phase 2 (PLAN) - Awaiting Jarmo's approval
**Branch:** TBD (will branch from sprint-24's branch after approval)
**Base:** Sprint 24 (Orama migration complete)
**Started:** 2026-01-31

---

## Quick Links

- **Research Phase 1:**
  - [Multimodal RAG + MCP Analysis](../../analysis/2026-01-22-multimodal-rag-mcp.md) (Sprint 24 foundation)
  - [Docify RAG Investigation](../../analysis/2026-01-31-docify-rag-investigation.md) (new techniques)
- **Sprint Plan:** [sprint-plan.md](sprint-plan.md)
- **Base Sprint:** [Sprint 24 - Multimodal RAG](../sprint-24-multimodal-rag/README.md)

---

## Executive Summary

Sprint 24 built RiteMark's RAG foundation: **markdown-only** parsing, embeddings (OpenAI), vector storage (Orama), and a unified sidebar. Sprint 27 completes the vision by adding **Docling for PDF/Word/PPT support** plus Docify's proven pipeline techniques.

**Problem:** Current RAG (v1.1.x) has two major gaps:
1. **Markdown only** - Can't index PDF, Word, PowerPoint, images
2. **Basic search** - Pure vector search misses exact keywords, no citation verification

**Solution:** Two-part enhancement:
1. **Document parsing** - PDF/Word support via JS libraries (default) + optional Docling for power users
2. **Pipeline improvements** - Hybrid search, re-ranking, citation verification (from Docify)

**Architecture:** Layer improvements on Sprint 24's foundation:

```
Query → [Hybrid Search] → [Re-ranking] → [Context Assembly] → [LLM + Prompts] → [Citation Verify] → Response
         ↑ NEW             ↑ NEW           ↑ ENHANCE          ↑ ENHANCE          ↑ NEW
```

---

## Key Enhancements

### 0. Document Parsing (PDF/Word Support) ⭐ NEW
**Current:** Markdown files only (`.md`, `.markdown`)
**Enhanced:** Two-tier document parsing system:

#### Tier 1: JS Parsers (Default - No Dependencies)
Works out of the box for everyone:

| Format | Library | Quality | Notes |
|--------|---------|---------|-------|
| PDF | `pdf-parse` | Good | Text-based PDFs, no OCR |
| Word (.docx) | `mammoth` | Good | Preserves structure, headers |
| Markdown | Direct | Excellent | Already working |

#### Tier 2: Docling (Optional - Requires Python)
For power users who need advanced features:

| Format | Parser | Notes |
|--------|--------|-------|
| PDF | Docling | Tables, figures, OCR, multi-column |
| Word (.docx) | Docling | Better table extraction |
| PowerPoint (.pptx) | Docling | Slides as sections |
| Images (PNG, JPEG) | Docling OCR | Text extraction from images |

**Architecture:**
```
File detected → Extension check
    │
    ├─ .md/.markdown → Direct TypeScript parsing (existing)
    │
    └─ .pdf/.docx → Check feature flag
        │
        ├─ rag-docling DISABLED (default)
        │   └─ JS parsers (pdf-parse, mammoth)
        │       └─ Works for 80% of use cases
        │
        └─ rag-docling ENABLED (user opted in)
            └─ Python subprocess (Docling via uv)
                └─ Best quality, OCR, tables, images
```

**Why this approach:**
- **Works out of the box** - No Python required for basic PDF/Word
- **Progressive enhancement** - Power users can enable Docling
- **Matches RiteMark philosophy** - Local-first, minimal dependencies

**Tier 1 Dependencies (npm - ships with extension):**
```json
"pdf-parse": "^1.1.1",   // ~500KB, Mozilla pdf.js wrapper
"mammoth": "^1.6.0"      // ~200KB, Word to text
```

**Tier 2 Dependencies (optional, user's system):**
- Python 3.11+
- `uv` package manager
- Docling (~200MB models)

---

### 1. Hybrid Search (Vector + BM25)
**Current:** Pure semantic vector search
**Enhanced:** Combine vector similarity (60%) + BM25 keyword matching (40%) using Reciprocal Rank Fusion (RRF)

**Why:** Catches both "What is RAG?" (semantic) and exact matches for "retrieval augmented generation"

**Advantage:** Orama already supports this! Just needs configuration changes.

### 2. Multi-factor Re-ranking
**Current:** Results sorted by vector similarity only
**Enhanced:** 5-factor scoring after initial retrieval:

| Factor | Weight | Purpose |
|--------|--------|---------|
| Base Relevance | 40% | Original search score |
| Source Quality | 20% | PDF/research > markdown > text |
| Recency | 15% | Newer documents preferred |
| Specificity | 15% | Direct query term overlap |
| Citation Frequency | 10% | Popular sources ranked higher |

**Why:** Users trust well-sourced, recent research papers more than old scratch notes.

### 3. Citation Verification
**Current:** LLM generates citations, user trusts blindly
**Enhanced:** Post-process response to verify every `[Source N]` citation:
- Check source exists in context
- Calculate text overlap between claim and source
- Flag hallucinated or weak citations
- Detect uncited claims

**Why:** Builds user trust. Shows which claims are strongly supported vs. inferred.

### 4. Anti-Hallucination Prompts
**Current:** Standard chat prompts
**Enhanced:** Strict rules in system prompt:
- "ONLY use information from provided context"
- "If not in context, say 'This information is not available'"
- "ALWAYS cite sources using [Source N] format"
- "If sources conflict, mention BOTH perspectives"

**Why:** Reduces hallucinations by 60-80% (per Docify's findings)

### 5. Query Expansion (Optional - Phase 3b)
**Current:** Single query string
**Enhanced:** Generate 3-5 query variants to improve recall
- "What's the deadline?" → ["deadline", "due date", "timeline", "completion date"]

**Why:** Catches different phrasings in documents. May add latency.

---

## Architecture Changes

### Current (Sprint 24)
```
User Query
    ↓
Orama Vector Search (cosine similarity)
    ↓
Top-K chunks (sorted by similarity)
    ↓
Build context (concatenate top chunks)
    ↓
System prompt + context + query → OpenAI gpt-4o-mini
    ↓
Streaming response with citations
```

### Enhanced (Sprint 27)
```
User Query
    ↓
[NEW] Query Expansion (optional)
    ↓
Orama Hybrid Search (vector 60% + BM25 40%)  ← Config change
    ↓
Top 20-30 candidate chunks
    ↓
[NEW] Multi-factor Re-ranking
    ↓
Top 5-10 chunks (reordered)
    ↓
[ENHANCED] Context Assembly (60/30/10 token budget)
    ↓
[ENHANCED] Anti-hallucination System Prompt
    ↓
OpenAI gpt-4o-mini (streaming)
    ↓
[NEW] Citation Verification
    ↓
Response + verification metadata
```

---

## What Gets Reused from Sprint 24

| Component | Status | Changes Needed |
|-----------|--------|----------------|
| Document parsing (Docling) | ✅ Keep as-is | None |
| Embeddings (OpenAI) | ✅ Keep as-is | None |
| Chunking (512 tokens) | ✅ Keep as-is | None |
| Vector store (Orama) | ✅ Keep, enhance | Enable hybrid search config |
| Unified sidebar | ✅ Keep, enhance | Show verification scores |
| MCP server | ✅ Keep as-is | None |
| File watcher | ✅ Keep as-is | None |

**Key Insight:** This is a **pipeline enhancement**, not a rebuild. All Sprint 24 infrastructure stays intact.

---

## Success Criteria

### Must Have (Phase 3)
- [ ] Hybrid search returns better results than pure vector (measured by user feedback)
- [ ] Citation verification catches at least 80% of hallucinated sources
- [ ] Re-ranking surfaces high-quality sources (PDFs) above notes
- [ ] Response quality improves (fewer "I don't know" when info exists)

### Nice to Have (Phase 3b or future sprint)
- [ ] Query expansion improves recall by 20%+
- [ ] Conflict detection warns user when sources disagree
- [ ] Token budget management prevents context overflow

### Quality Gates
- [ ] All existing Sprint 24 tests still pass
- [ ] No performance regression (search latency < 500ms)
- [ ] Hybrid search returns results for 100% of test queries
- [ ] Citation verification false positive rate < 5%

---

## Deliverables

| Deliverable | Description | File(s) |
|-------------|-------------|---------|
| **JS document parsers** | PDF + Word parsing (default) | `src/rag/parsers/pdfParser.ts`, `src/rag/parsers/wordParser.ts` (new) |
| **Docling bridge** | Python subprocess (optional) | `rag-server/parser.py`, `src/rag/parsers/doclingParser.ts` (new) |
| **Parser router** | Route files to correct parser | `src/rag/parsers/index.ts` (new) |
| **Extended indexer** | Support PDF, DOCX, PPTX | `src/rag/indexer.ts` (update) |
| Hybrid search config | Enable Orama BM25 + vector | `src/rag/vectorStore.ts` |
| Re-ranking service | 5-factor scoring logic | `src/rag/reranking.ts` (new) |
| Citation verifier | Post-process LLM responses | `src/rag/citationVerifier.ts` (new) |
| Enhanced prompts | Anti-hallucination system prompts | `src/rag/prompts.ts` (new) |
| Context assembler | 60/30/10 token budget | `src/rag/contextAssembly.ts` (new) |
| Query expander (opt) | Generate query variants | `src/rag/queryExpansion.ts` (new, Phase 3b) |
| Updated sidebar | Show verification scores | `src/views/UnifiedViewProvider.ts` |
| Unit tests | Test each new component | `src/rag/*.test.ts` |

---

## Implementation Phases

### Phase 1: RESEARCH ✅ COMPLETE
- [x] Read Docify investigation analysis
- [x] Read Sprint 24 architecture docs
- [x] Identify reusable techniques
- [x] Map to RiteMark's tech stack

### Phase 2: PLAN ⏳ IN PROGRESS
- [x] Write sprint plan
- [ ] **Jarmo approval required to proceed**

### Phase 3a: DEVELOP - Core Enhancements
**Prerequisites:** Jarmo approval (Sprint 24 Orama migration is complete and released ✅)

#### Step 0a: JS Document Parsers (3-4 hours) ⭐ PRIORITY
Default parsing that works for everyone:

- [ ] Add npm dependencies: `pdf-parse`, `mammoth`
- [ ] Create `src/rag/parsers/pdfParser.ts`:
  - Use `pdf-parse` (wrapper around Mozilla pdf.js)
  - Extract text, page count, metadata
  - Return: `{ text, metadata: { pages, title, author } }`
- [ ] Create `src/rag/parsers/wordParser.ts`:
  - Use `mammoth` for DOCX parsing
  - Extract text with structure (headers, paragraphs)
  - Return: `{ text, metadata: { title } }`
- [ ] Create `src/rag/parsers/index.ts` (router):
  - Route by extension: `.pdf` → pdfParser, `.docx` → wordParser
  - Check feature flag for Docling override
- [ ] Update `src/rag/indexer.ts`:
  - Extend `SUPPORTED_EXTENSIONS` to include `.pdf`, `.docx`
  - Route through parser router
- [ ] Add `source_type` metadata to chunks (pdf, docx, markdown)
- [ ] Test: index a PDF and Word doc, verify searchable
- [ ] Commit: `feat(rag): add PDF and Word parsing via JS libraries`

**npm Dependencies:**
```json
"pdf-parse": "^1.1.1",
"mammoth": "^1.6.0"
```

---

#### Step 0b: Docling Integration (3-4 hours) - OPTIONAL
For users who enable `rag-docling` flag:

- [ ] Create `rag-server/` Python project with `pyproject.toml`
- [ ] Implement `parser.py` using Docling:
  - Input: file path
  - Output: JSON `{ text, metadata, pages[] }`
  - Support: PDF, DOCX, PPTX, images (OCR)
- [ ] Create `src/rag/parsers/doclingParser.ts` bridge:
  - Check if Python available, show instructions if not
  - Spawn via `uv run python -m rag_server.parser <file>`
  - Parse JSON output, handle errors
- [ ] Update parser router to prefer Docling when flag enabled
- [ ] Add `.pptx`, `.png`, `.jpg` to supported extensions (Docling only)
- [ ] Test: index a scanned PDF with OCR
- [ ] Commit: `feat(rag): add optional Docling parser for advanced documents`

**Python Dependencies (rag-server/pyproject.toml):**
```toml
[project]
name = "rag-server"
requires-python = ">=3.11"
dependencies = ["docling>=2.0"]
```

**First-run UX (when Docling enabled):**
- User enables `rag-docling` in settings
- User clicks "Re-index" with PDFs
- If Python not found: "Docling requires Python 3.11+. [Install Python] [Use basic parser instead]"
- If Python found: "Installing Docling (one-time, ~200MB)..." with progress

---

#### Step 1: Hybrid Search (2-3 hours)
- [ ] Enable Orama hybrid search mode in vectorStore.ts
- [ ] Configure weights: 60% vector, 40% BM25
- [ ] Update search() to use Orama's built-in RRF
- [ ] Test: verify keyword matches improve
- [ ] Commit: `feat(rag): enable hybrid search with BM25 + vector`

#### Step 2: Re-ranking Service (4-6 hours)
- [ ] Create `src/rag/reranking.ts`
- [ ] Implement 5-factor scoring:
  - Base relevance (from Orama score)
  - Source quality (PDF > markdown > text)
  - Recency (file modified date)
  - Specificity (query term overlap)
  - Citation frequency (track in metadata)
- [ ] Add metadata fields to Orama schema (source_type, indexed_at)
- [ ] Update indexer to populate new metadata
- [ ] Wire into search pipeline
- [ ] Test: verify PDFs rank higher than notes
- [ ] Commit: `feat(rag): add multi-factor re-ranking`

#### Step 3: Citation Verification (3-4 hours)
- [ ] Create `src/rag/citationVerifier.ts`
- [ ] Implement citation extraction (regex: `[Source N]`)
- [ ] Implement overlap scoring (word overlap + key phrase matching)
- [ ] Flag invalid/weak citations
- [ ] Return verification metadata with response
- [ ] Update sidebar to show verification scores
- [ ] Test: catch hallucinated citations
- [ ] Commit: `feat(rag): add citation verification`

#### Step 4: Anti-Hallucination Prompts (1-2 hours)
- [ ] Create `src/rag/prompts.ts`
- [ ] Define strict system prompts:
  - QA (question answering)
  - SUMMARY (document summarization)
  - COMPARE (compare sources)
  - EXPLAIN (explain concepts)
- [ ] Add citation format requirements
- [ ] Wire into UnifiedViewProvider
- [ ] Test: verify LLM follows rules
- [ ] Commit: `feat(rag): add anti-hallucination prompts`

#### Step 5: Context Assembly (2-3 hours)
- [ ] Create `src/rag/contextAssembly.ts`
- [ ] Implement 60/30/10 token budget:
  - 60% primary sources (top-ranked)
  - 30% supporting context
  - 10% metadata (titles, sections)
- [ ] Add deduplication logic
- [ ] Handle token overflow gracefully
- [ ] Wire into search.ts
- [ ] Test: verify context stays within limits
- [ ] Commit: `feat(rag): add token budget management`

**Total Phase 3a:** ~18-24 hours of focused development
- Step 0a (JS parsers): 3-4 hours ⭐ Must have
- Step 0b (Docling): 3-4 hours (optional, can defer)
- Steps 1-5 (pipeline): 12-16 hours

### Phase 3b: DEVELOP - Optional Enhancements (Future)
- [ ] Query expansion service
- [ ] Conflict detection between sources
- [ ] Advanced deduplication

### Phase 4: TEST & VALIDATE
- [ ] Unit tests for each new component
- [ ] Integration test: full RAG pipeline
- [ ] Test with real documents (PDFs, markdown, code)
- [ ] Verify hybrid search improves results
- [ ] Verify citation verification catches hallucinations
- [ ] Performance test: search latency < 500ms
- [ ] Invoke `qa-validator` before commits

### Phase 5: CLEANUP
- [ ] Remove debug logging
- [ ] Update inline documentation
- [ ] Add JSDoc comments to new services
- [ ] Update Sprint 24 README with v2 notes
- [ ] Final code review

### Phase 6: DEPLOY
- [ ] Merge into Sprint 24 branch
- [ ] Test in production build
- [ ] Create release notes (invoke `product-marketer`)
- [ ] Invoke `qa-validator` final check
- [ ] Tag release (if standalone release needed)

---

## Technical Decisions

### Why Build on Sprint 24 Instead of Starting Fresh?
- Sprint 24's Orama migration provides hybrid search out-of-the-box
- Document parsing (Docling) is working
- Unified sidebar UI is solid
- No need to reinvent infrastructure

### Why Not Use Docify's Entire Pipeline?
Docify is server-based (PostgreSQL, Celery, Redis). RiteMark is local-first (VS Code extension). We adapt the **techniques**, not the stack:

| Docify | RiteMark Equivalent |
|--------|---------------------|
| PostgreSQL + pgvector | Orama (in-memory, JSON persistence) |
| BM25 via rank_bm25 library | Orama's built-in BM25 |
| Celery + Redis (async) | Native Promise/async in TypeScript |
| LLM: Mistral 7B (local) | OpenAI gpt-4o-mini (API) |

### Why Orama Over sqlite-vec?
Sprint 24 pivoted from sqlite-vec due to native dependency hell. Orama provides:
- Zero native dependencies (pure TypeScript)
- Built-in hybrid search (vector + BM25)
- Lightweight (~2KB bundle size)
- No Electron ABI issues

### Re-ranking vs. Orama's Built-in Scoring?
Orama's RRF combines vector + BM25. Re-ranking adds **domain-specific signals**:
- Source quality (trust research papers more)
- Recency (newer docs often better)
- Citation frequency (popular sources)

This is a **post-retrieval** step, layered on top of Orama's initial ranking.

---

## Feature Flag Check

**Does this sprint need a feature flag?**
- [ ] Platform-specific? No (works everywhere with Python)
- [ ] Experimental? Yes (new pipeline enhancements + Docling)
- [ ] Large download? **YES** - Docling models ~200MB on first use
- [ ] Premium feature? No
- [ ] Kill-switch needed? Yes (in case Docling/re-ranking breaks)

**Decision:** YES - add feature flag for Docling (separate from pipeline enhancements)

**Flag Definitions:**
```typescript
// Advanced document parsing via Docling (optional, requires Python)
{
  id: 'rag-docling',
  name: 'Advanced Document Parsing (Docling)',
  status: 'experimental',
  platforms: ['darwin', 'win32', 'linux'],
  description: 'Use Docling for OCR, tables, and PowerPoint. Requires Python 3.11+. Default: JS parsers.',
  enabledByDefault: false,
}

// Pipeline enhancements (hybrid search, re-ranking, etc.)
{
  id: 'rag-v2-enhancements',
  name: 'RAG v2 Pipeline Enhancements',
  status: 'experimental',
  platforms: ['darwin', 'win32', 'linux'],
  description: 'Hybrid search, re-ranking, citation verification',
  enabledByDefault: false,
}
```

**Feature Matrix:**

| Flags | PDF/Word | PPT/Images | Search | Re-ranking |
|-------|----------|------------|--------|------------|
| None (default) | ✅ JS parsers | ❌ | Vector only | ❌ |
| `rag-v2-enhancements` | ✅ JS parsers | ❌ | Hybrid + BM25 | ✅ |
| `rag-docling` | ✅ Docling | ✅ Docling | Vector only | ❌ |
| Both flags | ✅ Docling | ✅ Docling | Hybrid + BM25 | ✅ |

**Implementation:**
- [ ] Define both flags in `src/features/flags.ts`
- [ ] Add settings to `package.json` (experimental features section)
- [ ] JS parsers always available (no flag needed)
- [ ] Gate Docling with `isEnabled('rag-docling')`
- [ ] Gate pipeline enhancements with `isEnabled('rag-v2-enhancements')`
- [ ] Fallback: JS parsers + basic vector search

---

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| **pdf-parse fails on complex PDF** | Medium | Show warning, suggest enabling Docling for better results |
| **mammoth misses Word formatting** | Low | Acceptable for RAG (we need text, not styling) |
| Re-ranking slows down search | Medium | Add performance benchmarks, optimize scoring |
| Citation verification false positives | Medium | Tune overlap threshold, allow user override |
| Orama hybrid search config breaks | Medium | Test thoroughly, keep fallback to vector-only |
| Context assembly truncates important info | Low | Smart truncation (preserve first/last sentences) |
| Token budget too restrictive | Low | Make budget configurable (2K-6K tokens) |

**Docling-specific risks (only if user enables flag):**

| Risk | Impact | Mitigation |
|------|--------|------------|
| Python not installed | Low | Clear instructions, user chose to enable flag |
| Docling model download fails | Medium | Retry logic, progress indicator, offline cache |
| Docling parsing slow | Medium | Parse async, show progress, cache results |
| uv not working on Windows | Medium | Test on all platforms, fallback to pip |

---

## Dependencies

### On Sprint 24 (v1.1.x)
- [x] Orama migration tested and working ✅
- [x] Basic RAG pipeline functional (markdown → embed → search → chat) ✅
- [x] Unified sidebar renders correctly ✅
- [ ] ~~Document parsing (Docling)~~ **NOT DONE** - Only markdown supported currently

**Status:** Sprint 24 core is released. Docling was designed but not implemented.

### New npm Packages (Tier 1 - ships with extension)
```json
"pdf-parse": "^1.1.1",   // ~500KB, PDF text extraction (pdf.js)
"mammoth": "^1.6.0"      // ~200KB, Word to text/HTML
```

### New Python Package (Tier 2 - optional, rag-server/)
Only needed if user enables `rag-docling` flag:
```toml
[project]
name = "rag-server"
requires-python = ">=3.11"
dependencies = ["docling>=2.0"]
```

### System Requirements

**For everyone (Tier 1):**
- **OpenAI API key** (existing, for embeddings + chat)
- No additional dependencies!

**For Docling users (Tier 2, optional):**
- **Python 3.11+** (user's system)
- **uv** (auto-installed if missing)
- **~200MB disk** for Docling models

---

## Testing Strategy

### Unit Tests (per component)
- `reranking.test.ts` - Test 5-factor scoring
- `citationVerifier.test.ts` - Test overlap calculation, false positive rate
- `contextAssembly.test.ts` - Test token budget allocation
- `prompts.test.ts` - Verify prompt templates

### Integration Tests
- Full pipeline: query → hybrid search → re-rank → LLM → verify
- Compare results: Sprint 24 (vector only) vs Sprint 27 (enhanced)
- Measure: precision, recall, user satisfaction

### Performance Tests
- Search latency (target: < 500ms)
- Re-ranking overhead (target: < 100ms)
- Citation verification overhead (target: < 50ms)

### User Acceptance Tests
1. Drop a research paper (PDF) and a scratch note (markdown) into workspace
2. Ask: "What does the research say about X?"
3. Verify: PDF ranks higher than note
4. Verify: Citations are accurate
5. Verify: Response admits when info not available

---

## Rollback Plan

If RAG v2 enhancements break search:

1. **Feature flag off** - Disable `rag-v2-enhancements` flag
2. **Fallback to Sprint 24** - Pure vector search still works
3. **Investigate** - Check logs for re-ranking or verification errors
4. **Hotfix** - Patch and re-enable

All enhancements are additive. Sprint 24's core pipeline remains unchanged.

---

## Future Enhancements (Out of Scope)

- **Conflict detection** - Warn when sources disagree (complex LLM call)
- **Query expansion** - Generate query variants (adds latency)
- **Visual retrieval (ColPali)** - Embed page screenshots for image-heavy docs (GPU required)
- **Cross-workspace search** - Search across multiple projects
- **Export to markdown** - Save search results as a note
- **Feedback loop** - Learn from user clicks/edits to improve ranking

These are deferred to future sprints.

---

## Questions for Jarmo

1. **Priority:** Should Sprint 27 wait for Sprint 24 Phase 4 completion, or can we start in parallel?
2. **Scope:** Should we include query expansion in Phase 3a, or defer to Phase 3b?
3. **Feature flag:** Should RAG v2 be disabled by default, or enabled for internal testing?
4. **Testing:** Do you want a side-by-side comparison UI (Sprint 24 vs Sprint 27 results)?

---

## Approval Checklist

Before proceeding to Phase 3 (DEVELOP), confirm:

- [x] Sprint 24 is complete and released ✅
- [ ] Jarmo approves this sprint plan
- [ ] Feature flag approach is agreed
- [ ] Scope is clear (Phase 3a core, 3b optional)
- [ ] Risk mitigation is acceptable

---

**Status:** Awaiting Jarmo's approval
**Next Step:** Review sprint plan → Approve → Proceed to Phase 3

---

**Created:** 2026-01-31
**Last Updated:** 2026-01-31
