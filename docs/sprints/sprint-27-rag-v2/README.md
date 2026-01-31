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
1. **Docling integration** - Parse PDF, DOCX, PPTX, images via Python subprocess
2. **Pipeline improvements** - Hybrid search, re-ranking, citation verification (from Docify)

**Solution:** Layer Docify's 5-stage enhancement pipeline on top of Sprint 24's architecture:

```
Query → [Hybrid Search] → [Re-ranking] → [Context Assembly] → [LLM + Prompts] → [Citation Verify] → Response
         ↑ NEW             ↑ NEW           ↑ ENHANCE          ↑ ENHANCE          ↑ NEW
```

---

## Key Enhancements

### 0. Docling Integration (PDF/Word/PPT Support) ⭐ NEW
**Current:** Markdown files only (`.md`, `.markdown`)
**Enhanced:** Full document support via Docling:

| Format | Parser | Notes |
|--------|--------|-------|
| PDF | Docling | Tables, figures, OCR, multi-column |
| Word (.docx) | Docling | Formatting, headers, tables |
| PowerPoint (.pptx) | Docling | Slides as sections |
| Images (PNG, JPEG) | Docling OCR | Text extraction from images |
| Markdown | Direct (no Python) | Already working |

**Architecture:**
```
File detected → Extension check
    ├─ .md/.markdown → Direct TypeScript parsing (existing)
    └─ .pdf/.docx/.pptx/.png/.jpg → Python subprocess (Docling via uv)
        └─ Returns: JSON { text, metadata, pages[] }
```

**Why:** This is the #1 missing feature. Users have PDFs and Word docs in their workspace that are invisible to RAG.

**Dependencies:**
- Python 3.11+ (user's system)
- `uv` package manager (auto-install on first use)
- Docling (~200MB models, downloaded on first use)

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
| **Docling parser** | Python subprocess for PDF/Word/PPT | `rag-server/parser.py` (new) |
| **Document parser bridge** | TypeScript ↔ Python interface | `src/rag/documentParser.ts` (new) |
| **Extended indexer** | Support all file types | `src/rag/indexer.ts` (update) |
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

#### Step 0: Docling Integration (4-6 hours) ⭐ PRIORITY
- [ ] Create `rag-server/` Python project with `pyproject.toml`
- [ ] Implement `parser.py` using Docling:
  - Input: file path
  - Output: JSON `{ text, metadata, pages[] }`
  - Support: PDF, DOCX, PPTX, images (OCR)
- [ ] Create `src/rag/documentParser.ts` bridge:
  - Spawn Python via `uv run python -m rag_server.parser <file>`
  - Parse JSON output
  - Handle errors gracefully
- [ ] Update `src/rag/indexer.ts`:
  - Extend `SUPPORTED_EXTENSIONS` to include `.pdf`, `.docx`, `.pptx`, `.png`, `.jpg`
  - Route non-markdown files through Docling
  - Preserve markdown direct parsing (no Python needed)
- [ ] Add `source_type` metadata to chunks (pdf, docx, markdown, etc.)
- [ ] Test: index a PDF, verify chunks are searchable
- [ ] Commit: `feat(rag): add Docling for PDF/Word/PPT parsing`

**Python Dependencies (rag-server/pyproject.toml):**
```toml
[project]
name = "rag-server"
dependencies = ["docling>=2.0"]
```

**First-run UX:**
- User clicks "Re-index" with PDFs in workspace
- Extension detects Python not ready, shows: "Installing document parser (one-time, ~200MB)..."
- `uv` auto-creates venv and installs Docling
- Progress shown in footer

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

**Total Phase 3a:** ~18-26 hours of focused development (including Docling)

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
// Docling document parsing (PDF/Word/PPT)
{
  id: 'rag-docling',
  name: 'Document Parsing (PDF, Word, PowerPoint)',
  status: 'experimental',
  platforms: ['darwin', 'win32', 'linux'],
  description: 'Parse PDF, DOCX, PPTX via Docling. Requires Python 3.11+.',
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

**Implementation:**
- [ ] Define both flags in `src/features/flags.ts`
- [ ] Add settings to `package.json` (experimental features section)
- [ ] Gate Docling with `isEnabled('rag-docling')`
- [ ] Gate pipeline enhancements with `isEnabled('rag-v2-enhancements')`
- [ ] Fallback: markdown-only + basic vector search if disabled

---

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Python not installed** | High | Detect on startup, show install instructions, graceful fallback to markdown-only |
| **Docling model download fails** | High | Retry logic, progress indicator, allow offline mode with cached models |
| **Docling parsing slow** | Medium | Parse async in background, show progress, cache results |
| **uv not working on Windows** | Medium | Test on all platforms, fallback to pip if needed |
| Re-ranking slows down search | Medium | Add performance benchmarks, optimize scoring |
| Citation verification false positives | Medium | Tune overlap threshold, allow user override |
| Orama hybrid search config breaks | Medium | Test thoroughly, keep fallback to vector-only |
| Context assembly truncates important info | Low | Smart truncation (preserve first/last sentences) |
| Token budget too restrictive | Low | Make budget configurable (2K-6K tokens) |

---

## Dependencies

### On Sprint 24 (v1.1.x)
- [x] Orama migration tested and working ✅
- [x] Basic RAG pipeline functional (markdown → embed → search → chat) ✅
- [x] Unified sidebar renders correctly ✅
- [ ] ~~Document parsing (Docling)~~ **NOT DONE** - Only markdown supported currently

**Status:** Sprint 24 core is released. Docling was designed but not implemented.

### New npm Packages
None! TypeScript enhancements use existing dependencies.

### New Python Package (rag-server/)
```toml
[project]
name = "rag-server"
requires-python = ">=3.11"
dependencies = ["docling>=2.0"]
```

### System Requirements
- **Python 3.11+** (user's system - for Docling)
- **uv** (auto-installed if missing via curl/powershell)
- **OpenAI API key** (existing, for embeddings + chat)
- **~200MB disk** for Docling models (first-run download)

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
