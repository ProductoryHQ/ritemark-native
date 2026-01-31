# Docify RAG Investigation

**Date:** 2026-01-31
**Repository:** https://github.com/keshavashiya/docify
**Purpose:** Investigate RAG techniques that could improve RiteMark's retrieval-augmented generation capabilities

---

## Executive Summary

Docify is an open-source "AI Second Brain" application with a sophisticated 11-stage RAG pipeline. It offers several innovative approaches to RAG that could significantly enhance RiteMark's document intelligence capabilities:

1. **Hybrid Search** (vector + BM25 with Reciprocal Rank Fusion)
2. **Multi-factor Re-ranking** (5-factor scoring with conflict detection)
3. **Adaptive Chunking** (document-type aware sizing)
4. **Citation Verification** (post-generation hallucination detection)
5. **Token Budget Management** (60/30/10 context assembly)

---

## Architecture Overview

Docify's RAG pipeline integrates 11 core services in sequence:

```
User Query
    │
    ▼
┌──────────────────┐
│ Query Expansion  │ → Generates 3-5 query variants
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Hybrid Search    │ → Semantic + BM25 scoring
├──────────────────┤
│ Results: Top-K   │ → 20-30 candidate chunks
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Re-Ranking       │ → 5-factor scoring + conflict detection
├──────────────────┤
│ Reordered:       │ → Top 5-10 chunks
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Context Assembly │ → Build context (60/30/10 split)
├──────────────────┤
│ Token Budget:    │ → Max 2000-6000 tokens
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Prompt Engineer  │ → Anti-hallucination prompts
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ LLM Call         │ → Ollama/OpenAI/Anthropic
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Citation Verify  │ → Check [Source N] in chunks
└──────────────────┘
    │
    ▼
Response with Citations
```

---

## Key Techniques Analysis

### 1. Hybrid Search with Reciprocal Rank Fusion (RRF)

**Location:** `backend/app/services/hybrid_search.py`

Docify combines two search strategies:
- **Semantic Search:** Vector similarity via pgvector (cosine distance)
- **Keyword Search:** BM25 ranking using `rank_bm25` library

**RRF Formula:**
```
RRF(d) = w₁ × (1 / (k + rank_vector)) + w₂ × (1 / (k + rank_bm25))
```
Where k=60 is a constant that prevents high-ranking documents from dominating.

**Default Weights:** 60% vector, 40% BM25

**Why This Matters for RiteMark:**
- Pure semantic search misses exact keyword matches
- Pure keyword search misses synonyms and concepts
- Hybrid approach catches both "What is RAG?" and "retrieval augmented generation"

**Implementation Notes:**
```python
# Configurable search strategies
class SearchStrategy(Enum):
    SEMANTIC = "semantic"   # Vector only
    KEYWORD = "keyword"     # BM25 only
    HYBRID = "hybrid"       # Combined

# BM25 index is cached per workspace to avoid rebuilding
self._bm25_cache: Dict[str, tuple] = {}
```

---

### 2. Multi-factor Re-ranking

**Location:** `backend/app/services/reranking.py`

After initial retrieval, Docify re-ranks results using 5 weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Base Relevance | 40% | Initial hybrid search score |
| Citation Frequency | 15% | How often the source is cited in past responses |
| Recency | 15% | Document upload date (newer = higher) |
| Specificity | 15% | Direct query term overlap |
| Source Quality | 15% | Document type credibility (PDF research > web) |

**Source Quality Scores:**
```python
type_scores = {
    'pdf': 1.0, 'research': 1.0, 'academic': 1.0,
    'word': 0.8, 'markdown': 0.8,
    'url': 0.7, 'web': 0.7,
    'excel': 0.6, 'csv': 0.6,
    'text': 0.5, 'txt': 0.5,
}
```

**Conflict Detection:**
- Compares top 5 results for contradictions
- Uses LLM with low temperature (0.1) for consistency
- Conflicting sources get score penalty: `final_score *= (1 - conflicts × 0.05)`

**Why This Matters for RiteMark:**
- Users trust research papers more than random web pages
- Newer documents may have more current information
- Conflict detection warns users about contradictory sources

---

### 3. Adaptive Chunking

**Location:** `backend/app/services/adaptive_chunking.py`

Docify adjusts chunk size based on document type:

| Document Type | Chunk Size | Overlap | Rationale |
|---------------|------------|---------|-----------|
| Code | 512 tokens | 100 | Preserve function/class boundaries |
| Papers/PDFs | 1024 tokens | 150 | Larger semantic units for arguments |
| Web Content | 768 tokens | 100 | Balanced for mixed content |
| Markdown | 768 tokens | 100 | Similar to web |
| Text/Notes | 512 tokens | 50 | Standard paragraphs |

**Document Type Detection:**
```python
def detect_document_type(content, resource_type, file_extension):
    # 1. Check by extension (py, js, pdf, md)
    # 2. Check by content patterns:
    #    - Code: def, function, class, import patterns
    #    - Academic: "abstract", "introduction", "et al.", "doi:"
    #    - Markdown: starts with # or contains ```
```

**Code-specific Chunking:**
- Splits at function/class definitions
- Preserves logical boundaries instead of arbitrary token limits

**Why This Matters for RiteMark:**
- Markdown files should preserve heading structure
- Code blocks should stay intact
- Academic content benefits from larger context windows

---

### 4. Token Budget Management

**Location:** `backend/app/services/context_assembly.py`

Docify uses a 60/30/10 budget allocation:

| Category | Budget | Description |
|----------|--------|-------------|
| Primary Sources | 60% | Top-ranked, most relevant chunks |
| Supporting Context | 30% | Additional relevant context |
| Metadata/Structure | 10% | Document titles, section headers |

**Default Token Budget:** 2,000 tokens (configurable up to 6,000)

**Context Assembly Features:**
- Automatic deduplication of near-identical chunks
- Primary chunks: top 30% OR score > 0.7
- Truncation with "..." when chunks exceed budget
- Conflict summary included when sources disagree

**Why This Matters for RiteMark:**
- Prevents context overflow
- Ensures most relevant content gets priority
- Maintains coherent context structure

---

### 5. Query Expansion

**Location:** `backend/app/services/query_expansion.py`

Two approaches:

**LLM-based Expansion (default):**
```python
prompt = f"""Generate {max_variants - 1} alternative ways to phrase the SAME question...
Original question: "{user_query}"
"""
# Generates 3-5 variants using local Mistral model
```

**Rule-based Fallback:**
```python
# Remove question words
"what is X" → "X"
"how do I Y" → "Y"
"why Z" → "Z"

# Add prefixes
"explain X"
```

**Why This Matters for RiteMark:**
- Catches different phrasings in source documents
- "What's the main finding?" also matches "primary conclusions", "key results"
- Improves recall significantly

---

### 6. Citation Verification

**Location:** `backend/app/services/citation_verification.py`

Post-generation verification that checks every `[Source N]` citation:

**Verification Process:**
1. Extract all citations from response using regex
2. Build source map from context chunks
3. For each citation:
   - Check if source exists in context
   - Calculate text overlap between claim and source
   - Find best matching text segment
4. Flag invalid source references
5. Detect uncited claims (potential hallucinations)

**Overlap Calculation:**
- For quotes: exact match → 1.0, near-match → 0.9
- For paraphrased claims: word overlap + key phrase matching

**Thresholds:**
- MIN_OVERLAP_SCORE = 0.3 (minimum to verify)
- HIGH_CONFIDENCE_THRESHOLD = 0.7 (strong verification)

**Hallucination Indicators:**
```python
claim_indicators = [
    r'according to',
    r'research shows',
    r'studies indicate',
    r'\d+%',  # Percentages
    r'the study found',
]
```

**Why This Matters for RiteMark:**
- Catches LLM hallucinations before showing to user
- Provides verification score for response quality
- Identifies claims that need source verification

---

### 7. Anti-Hallucination Prompt Engineering

**Location:** `backend/app/services/prompt_engineering.py`

Aggressive system prompts with strict rules:

```
CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use information from the provided context below
2. If information is NOT in the context, say "This information is not available..."
3. ALWAYS cite your sources using [Source N] format
4. NEVER make up or infer information not explicitly stated
5. NEVER cite sources that weren't provided
6. If sources disagree, mention BOTH perspectives with citations
```

**Citation Format Requirements:**
```
- For direct quotes: "quoted text" [Source N]
- For paraphrased info: paraphrased statement [Source N]
- For synthesized info: statement [Source N, Source M]
```

**Response Structure:**
```
1. Answer the question directly first
2. Provide supporting details with citations
3. Note any limitations or gaps in available information
```

**Prompt Types:**
- QA (default): Question answering
- SUMMARY: Document summarization
- COMPARE: Compare documents
- EXTRACT: Extract specific info
- EXPLAIN: Explain concepts

---

### 8. Smart Deduplication

**Location:** `backend/app/services/deduplication.py`

Content-based fingerprinting using SHA-256:

**Normalization:**
1. Convert to lowercase
2. Remove extra whitespace
3. Remove boilerplate (page numbers, copyright)
4. Remove URLs
5. Strip leading/trailing whitespace

**Duplicate Handling:**
- New uploads check hash against existing resources
- Duplicates reuse original's chunks and embeddings
- Saves processing time and storage

---

## Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Embeddings | all-minilm:22m via Ollama | 384 dimensions, fast |
| Vector Store | PostgreSQL + pgvector | HNSW indexing |
| LLM | Mistral 7B (4-bit quantized) | Local-first |
| Keyword Search | rank_bm25 library | Pure Python BM25Okapi |
| Token Counting | tiktoken (cl100k_base) | OpenAI tokenizer |
| Async Tasks | Celery + Redis | Non-blocking embeddings |

---

## Recommendations for RiteMark

### High Priority (Quick Wins)

1. **Implement Hybrid Search**
   - Add BM25 scoring alongside existing vector search
   - Use Reciprocal Rank Fusion to combine results
   - ~200 lines of code, significant retrieval improvement

2. **Add Citation Verification**
   - Post-process LLM responses to verify claims
   - Flag potential hallucinations before displaying
   - Builds user trust in AI-generated content

3. **Adopt Anti-Hallucination Prompts**
   - Use strict citation format requirements
   - Instruct LLM to admit when information is unavailable
   - Easy to implement, immediate quality improvement

### Medium Priority (Significant Effort)

4. **Multi-factor Re-ranking**
   - Score results by recency, source quality, specificity
   - Detect conflicts between sources
   - Requires metadata tracking, database changes

5. **Adaptive Chunking**
   - Adjust chunk sizes based on document type
   - Preserve code blocks and heading structure
   - Better suited to markdown-heavy use case

### Lower Priority (Nice to Have)

6. **Query Expansion**
   - Generate query variants for better recall
   - Useful when users don't know exact terminology
   - Adds latency (LLM call) per query

7. **Token Budget Management**
   - 60/30/10 context allocation
   - Helps with very long documents
   - May be overkill for note-taking use case

---

## Implementation Considerations

### For Electron/VS Code Extension Context

Unlike Docify (server-based), RiteMark runs locally in VS Code. Considerations:

1. **Local-first is already our model** - aligns well with Docify's privacy-first approach

2. **No PostgreSQL/pgvector** - Need alternative:
   - SQLite with sqlite-vss extension
   - In-memory vector store (Faiss, hnswlib)
   - LanceDB (local vector database)

3. **No Celery/Redis** - Alternative:
   - Web Workers for async processing
   - VS Code's task system
   - Background workers via electron

4. **Smaller embedding models** - all-minilm is already small (22M params)

5. **MCP Server integration** - Could implement these as MCP tools:
   - `rag_search` - Hybrid search
   - `verify_citations` - Check response quality
   - `expand_query` - Generate variants

---

## Code Samples Worth Adopting

### RRF Implementation (Simple)
```python
def reciprocal_rank_fusion(vector_ranks, bm25_ranks, k=60):
    combined = {}
    for doc_id in set(vector_ranks) | set(bm25_ranks):
        rrf_score = 0
        if doc_id in vector_ranks:
            rrf_score += 0.6 * (1.0 / (k + vector_ranks[doc_id]))
        if doc_id in bm25_ranks:
            rrf_score += 0.4 * (1.0 / (k + bm25_ranks[doc_id]))
        combined[doc_id] = rrf_score
    return sorted(combined.items(), key=lambda x: x[1], reverse=True)
```

### Citation Pattern (Regex)
```python
CITATION_PATTERN = re.compile(r'\[Source\s*(\d+)\]', re.IGNORECASE)
QUOTE_PATTERN = re.compile(r'"([^"]+)"\s*\[Source\s*(\d+)\]', re.IGNORECASE)
```

### Source Quality Scoring
```python
type_scores = {
    'pdf': 1.0,
    'markdown': 0.8,
    'text': 0.5,
}
```

---

## Conclusion

Docify offers a well-architected RAG pipeline with several innovations worth adopting:

1. **Hybrid Search with RRF** - Most impactful, relatively easy to implement
2. **Citation Verification** - Unique differentiator, builds trust
3. **Anti-Hallucination Prompts** - Low effort, high impact
4. **Adaptive Chunking** - Good for markdown-heavy content

The modular service architecture (11 separate services) is clean and testable, though perhaps over-engineered for RiteMark's simpler use case. Focus on the 3-4 most impactful techniques rather than replicating the entire pipeline.

---

## References

- Repository: https://github.com/keshavashiya/docify
- Architecture Doc: `ARCHITECTURE.md`
- Key Files:
  - `backend/app/services/hybrid_search.py`
  - `backend/app/services/reranking.py`
  - `backend/app/services/citation_verification.py`
  - `backend/app/services/prompt_engineering.py`
  - `backend/app/services/adaptive_chunking.py`
