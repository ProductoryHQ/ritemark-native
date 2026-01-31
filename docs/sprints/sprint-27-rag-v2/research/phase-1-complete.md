# Phase 1 Research - Complete

**Date:** 2026-01-31
**Status:** ✅ Complete

---

## Research Artifacts

All Phase 1 research has been documented in the analysis directory:

### 1. Multimodal RAG + MCP Analysis
**File:** `docs/analysis/2026-01-22-multimodal-rag-mcp.md`

**Key Findings:**
- Sprint 24 architecture decisions (Docling, OpenAI, Orama, MCP)
- Document processing pipeline design
- Unified sidebar approach
- MCP server design
- Technology stack choices

**Relevance to Sprint 27:**
- Provides foundation architecture to build on
- Explains current RAG pipeline implementation
- Documents what's already working (parsing, embeddings, vector store)

### 2. Docify RAG Investigation
**File:** `docs/analysis/2026-01-31-docify-rag-investigation.md`

**Key Findings:**
- 11-stage RAG pipeline architecture
- Hybrid search with Reciprocal Rank Fusion (vector 60% + BM25 40%)
- Multi-factor re-ranking (5 weighted factors)
- Citation verification post-processing
- Anti-hallucination prompt engineering
- Token budget management (60/30/10 split)
- Query expansion techniques

**Relevance to Sprint 27:**
- Specific techniques to implement in this sprint
- Code samples and formulas (RRF, overlap scoring)
- Performance benchmarks and thresholds
- Anti-hallucination best practices

---

## Research Summary

### What We Learned

**1. Hybrid Search is Critical**
- Pure vector search misses exact keyword matches
- Pure BM25 misses semantic similarity
- Combining both with RRF improves recall by 30-40%
- Orama already supports this natively!

**2. Re-ranking Adds Domain Intelligence**
- Initial search retrieves 20-30 candidates
- Re-ranking applies domain-specific signals:
  - Source quality (research papers > notes)
  - Recency (newer docs often better)
  - Citation frequency (popular sources)
  - Specificity (exact term matches)
- Final top 5-10 are significantly more relevant

**3. Citation Verification Builds Trust**
- LLMs hallucinate sources 20-30% of the time
- Post-processing can catch most hallucinations
- Text overlap scoring is effective (0.3-0.7 thresholds)
- Users trust AI more when citations are verified

**4. Prompts Matter More Than Expected**
- Strict system prompts reduce hallucinations by 60-80%
- Explicit citation format requirements help
- Instructing LLM to admit unknowns works well
- Different prompt types needed (QA, summary, compare)

**5. Token Budget Prevents Context Overflow**
- 60/30/10 allocation works well in practice
- Primary sources need majority of budget
- Supporting context fills gaps
- Metadata provides structure

### What We're NOT Implementing (Yet)

- **Query expansion** - Adds latency, defer to Phase 3b or future sprint
- **Conflict detection** - Complex LLM calls, defer to future sprint
- **Visual retrieval (ColPali)** - Requires GPU, defer to future sprint
- **Cross-workspace search** - Scope creep, defer to future sprint

### Key Adaptations for RiteMark

| Docify (Server) | RiteMark (Local) |
|-----------------|------------------|
| PostgreSQL + pgvector | Orama (in-memory) |
| rank_bm25 library | Orama built-in BM25 |
| Celery + Redis | Native TypeScript async |
| Mistral 7B (local) | OpenAI gpt-4o-mini (API) |

All techniques are adaptable to our local-first architecture.

---

## Technical Decisions Made

**1. Build on Sprint 24, Don't Rebuild**
- Orama provides hybrid search out-of-the-box
- Document parsing (Docling) is working
- Unified sidebar UI is solid
- Reuse 100% of infrastructure

**2. Feature Flag All Enhancements**
- ID: `rag-v2-enhancements`
- Status: experimental
- Default: disabled (enable after testing)
- Allows graceful rollback to Sprint 24

**3. Incremental Implementation**
- Phase 3a: Core enhancements (hybrid, re-rank, verify, prompts)
- Phase 3b: Optional (query expansion, conflict detection)
- Each component is independently testable
- No big-bang rewrites

**4. Keep Performance in Mind**
- Target: < 500ms total search latency
- Re-ranking: < 100ms overhead
- Citation verification: < 50ms overhead
- Performance tests in Phase 4

---

## Open Questions (Answered in Planning)

**Q: Should we use Docify's entire pipeline?**
**A:** No - adapt techniques, not stack. Server-based tools (PostgreSQL, Celery) don't fit local-first architecture.

**Q: Can Orama handle hybrid search?**
**A:** Yes! Built-in BM25 + vector support. Just need to configure it.

**Q: How do we verify citations without slowing down responses?**
**A:** Post-process after streaming completes. User sees response immediately, verification badges appear afterward.

**Q: What if re-ranking breaks search?**
**A:** Feature flag provides fallback. If disabled, falls back to Sprint 24's vector-only search.

**Q: Should query expansion be in Phase 3a or 3b?**
**A:** Phase 3b (optional). Adds latency, not critical for MVP. Re-ranking and citation verification are higher priority.

---

## Next Steps

Phase 1 research is complete. Proceed to Phase 2 (PLAN):

- [x] Create sprint directory
- [x] Write sprint-plan.md with detailed checklist
- [x] Write README.md with architecture overview
- [ ] Wait for Jarmo's approval
- [ ] Proceed to Phase 3 (DEVELOP)

---

**Research Phase Complete:** 2026-01-31
**Ready for Planning Phase:** ✅
