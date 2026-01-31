# Sprint 27: RAG v2 - Enhanced Retrieval Pipeline

## Goal
Enhance Sprint 24's RAG system with:
1. **Document parsing** - PDF/Word support via JS libraries (default) + optional Docling for power users
2. **Pipeline improvements** - Hybrid search, re-ranking, citation verification (from Docify research)

---

## Feature Flag Check
- [x] **Does this sprint need a feature flag?**
  - Experimental? **YES** (new pipeline enhancements)
  - Kill-switch needed? **YES** (in case re-ranking breaks search)

**Flag ID:** `rag-v2-enhancements`
**Status:** experimental
**Platforms:** darwin, win32, linux
**Enabled by default:** false (enable after Phase 4 testing)

---

## Success Criteria
- [ ] Hybrid search improves results quality vs pure vector search
- [ ] Citation verification catches 80%+ of hallucinated sources
- [ ] Re-ranking surfaces high-quality sources (PDFs) above scratch notes
- [ ] No performance regression (search latency stays < 500ms)
- [ ] All Sprint 24 tests still pass
- [ ] Feature flag allows graceful fallback to Sprint 24's basic search

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| **JS document parsers** | PDF + Word parsing via pdf-parse and mammoth (default, no Python) |
| **Docling bridge** | Optional Python parser for OCR, tables, PPT (requires Python 3.11+) |
| **Parser router** | Route files to correct parser based on extension + feature flag |
| Hybrid search config | Enable Orama's built-in BM25 + vector search with RRF |
| Re-ranking service | 5-factor post-retrieval scoring (quality, recency, specificity, etc.) |
| Citation verifier | Post-process LLM responses to verify `[Source N]` citations |
| Anti-hallucination prompts | Strict system prompts requiring citations, admitting unknowns |
| Context assembler | 60/30/10 token budget allocation (primary/supporting/metadata) |
| Feature flags | `rag-docling` + `rag-v2-enhancements` in flags.ts |
| Updated sidebar | Display citation verification scores in UI |
| Unit tests | Test coverage for all new components |
| Documentation | Update Sprint 24 README with v2 enhancements |

---

## Implementation Checklist

### Phase 1: RESEARCH ✅ COMPLETE
- [x] Read Docify RAG investigation analysis
- [x] Read Sprint 24 architecture and status
- [x] Identify applicable techniques for RiteMark
- [x] Map Docify's stack to RiteMark's tech (Orama, TypeScript, OpenAI)
- [x] Document findings in analysis docs

**Research artifacts:**
- `docs/analysis/2026-01-31-docify-rag-investigation.md`
- `docs/analysis/2026-01-22-multimodal-rag-mcp.md`

---

### Phase 2: PLAN ⏳ IN PROGRESS
- [x] Create sprint directory structure
- [x] Write sprint plan (this file)
- [x] Write README.md with architecture overview
- [x] Define success criteria
- [x] List deliverables and risks
- [x] Create feature flag definition
- [ ] **GATE: Jarmo approval required**

**Plan artifacts:**
- `docs/sprints/sprint-27-rag-v2/README.md`
- `docs/sprints/sprint-27-rag-v2/sprint-plan.md`

**BLOCKED:** Cannot proceed to Phase 3 without Jarmo's approval.

---

### Phase 3a: DEVELOP - Core Enhancements

**Prerequisites:**
- [ ] Jarmo approval received
- [x] Sprint 24 complete and released (v1.1.x) ✅
- [ ] Branch created from main

---

#### Step 0a: JS Document Parsers (3-4 hours) ⭐ PRIORITY
Default parsing that works for everyone - no Python required:

- [ ] Add npm dependencies to `package.json`:
  ```json
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0"
  ```
- [ ] Create `src/rag/parsers/pdfParser.ts`:
  - [ ] Use `pdf-parse` (wrapper around Mozilla pdf.js)
  - [ ] Extract text, page count, metadata
  - [ ] Return: `{ text, metadata: { pages, title, author } }`
  - [ ] Handle errors gracefully (corrupted PDFs, password protected)
- [ ] Create `src/rag/parsers/wordParser.ts`:
  - [ ] Use `mammoth` for DOCX parsing
  - [ ] Extract text with structure (headers, paragraphs)
  - [ ] Return: `{ text, metadata: { title } }`
- [ ] Create `src/rag/parsers/index.ts` (router):
  - [ ] Route by extension: `.pdf` → pdfParser, `.docx` → wordParser, `.md` → direct
  - [ ] Check feature flag for Docling override (Step 0b)
  - [ ] Return consistent `ParseResult` interface
- [ ] Update `src/rag/indexer.ts`:
  - [ ] Extend `SUPPORTED_EXTENSIONS` to include `.pdf`, `.docx`
  - [ ] Route through parser router instead of direct text read
  - [ ] Add `source_type` metadata to chunks (pdf, docx, markdown)
- [ ] Test: index a PDF and Word doc, verify searchable
- [ ] Commit: `feat(rag): add PDF and Word parsing via JS libraries`

**Expected changes:**
- `extensions/ritemark/package.json` (~2 lines)
- `extensions/ritemark/src/rag/parsers/pdfParser.ts` (new, ~60 lines)
- `extensions/ritemark/src/rag/parsers/wordParser.ts` (new, ~50 lines)
- `extensions/ritemark/src/rag/parsers/index.ts` (new, ~40 lines)
- `extensions/ritemark/src/rag/indexer.ts` (~30 lines modified)

---

#### Step 0b: Docling Integration (3-4 hours) - OPTIONAL
For users who enable `rag-docling` flag (requires Python 3.11+):

- [ ] Create `rag-server/pyproject.toml`:
  ```toml
  [project]
  name = "rag-server"
  requires-python = ">=3.11"
  dependencies = ["docling>=2.0"]
  ```
- [ ] Create `rag-server/parser.py`:
  - [ ] Input: file path as CLI argument
  - [ ] Output: JSON to stdout `{ text, metadata, pages[] }`
  - [ ] Support: PDF, DOCX, PPTX, images (OCR)
- [ ] Create `src/rag/parsers/doclingParser.ts`:
  - [ ] Check if Python available (`which python3`)
  - [ ] If not found: show instructions, fallback to JS parser
  - [ ] Spawn via `uv run python -m rag_server.parser <file>`
  - [ ] Parse JSON output, handle errors
  - [ ] Show progress for Docling model download (~200MB first run)
- [ ] Define `rag-docling` feature flag in `src/features/flags.ts`
- [ ] Update parser router to prefer Docling when flag enabled
- [ ] Add `.pptx`, `.png`, `.jpg` to supported extensions (Docling only)
- [ ] Test: index a scanned PDF with OCR
- [ ] Commit: `feat(rag): add optional Docling parser for advanced documents`

**Expected changes:**
- `rag-server/pyproject.toml` (new, ~10 lines)
- `rag-server/parser.py` (new, ~80 lines)
- `extensions/ritemark/src/rag/parsers/doclingParser.ts` (new, ~100 lines)
- `extensions/ritemark/src/features/flags.ts` (~10 lines)

---

#### 3.1: Feature Flag Setup (30 min)
- [ ] Define `rag-v2-enhancements` flag in `src/features/flags.ts`:
  ```typescript
  {
    id: 'rag-v2-enhancements',
    name: 'RAG v2 Pipeline Enhancements',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
    description: 'Hybrid search, re-ranking, citation verification',
    enabledByDefault: false,
  }
  ```
- [ ] Add setting to `package.json` under experimental features
- [ ] Test: verify flag can be toggled in settings
- [ ] Commit: `feat(flags): add rag-v2-enhancements feature flag`

#### 3.2: Hybrid Search Configuration (2-3 hours)
- [ ] Read Orama documentation for hybrid search mode
- [ ] Update `src/rag/vectorStore.ts`:
  - [ ] Enable hybrid mode in Orama create() options
  - [ ] Configure BM25 tokenizer (language: 'english')
  - [ ] Set RRF weights: 60% vector, 40% BM25
  - [ ] Update search() method to use hybrid mode when flag enabled
  - [ ] Add fallback to vector-only if flag disabled
- [ ] Test with sample queries:
  - [ ] Exact keyword match (e.g., "API key")
  - [ ] Semantic match (e.g., "authentication method")
  - [ ] Verify both return relevant results
- [ ] Performance test: measure search latency (target < 500ms)
- [ ] Commit: `feat(rag): enable Orama hybrid search (vector + BM25)`

**Expected changes:**
- `extensions/ritemark/src/rag/vectorStore.ts` (~30 lines)

#### 3.3: Source Metadata Enhancement (1-2 hours)
- [ ] Update Orama schema in `vectorStore.ts`:
  - [ ] Add `source_type` field (pdf, markdown, text, code, etc.)
  - [ ] Add `indexed_at` field (timestamp)
  - [ ] Add `file_size` field (bytes)
  - [ ] Add `citation_count` field (default 0, incremented on use)
- [ ] Update `src/rag/indexer.ts`:
  - [ ] Detect source type from file extension
  - [ ] Populate `indexed_at` with current timestamp
  - [ ] Add file size to metadata
- [ ] Re-index test documents to populate new fields
- [ ] Commit: `feat(rag): add metadata fields for re-ranking`

**Expected changes:**
- `extensions/ritemark/src/rag/vectorStore.ts` (~20 lines)
- `extensions/ritemark/src/rag/indexer.ts` (~15 lines)

#### 3.4: Re-ranking Service (4-6 hours)
- [ ] Create `src/rag/reranking.ts`
- [ ] Implement `Reranker` class:
  ```typescript
  interface RerankingFactors {
    baseRelevance: number;    // From Orama score (40%)
    sourceQuality: number;    // PDF/research > markdown > text (20%)
    recency: number;          // Newer = higher (15%)
    specificity: number;      // Query term overlap (15%)
    citationFrequency: number; // Popular sources (10%)
  }

  class Reranker {
    rerank(results: SearchResult[], query: string): RankedResult[]
  }
  ```
- [ ] Implement source quality scoring:
  ```typescript
  const typeScores = {
    'pdf': 1.0, 'research': 1.0,
    'markdown': 0.8, 'md': 0.8,
    'code': 0.7, 'ts': 0.7, 'js': 0.7,
    'text': 0.5, 'txt': 0.5,
  };
  ```
- [ ] Implement recency scoring (decay over time):
  ```typescript
  const daysSinceIndexed = (Date.now() - indexedAt) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.exp(-daysSinceIndexed / 365); // Decay over 1 year
  ```
- [ ] Implement specificity scoring (query term overlap):
  ```typescript
  const queryTerms = query.toLowerCase().split(/\s+/);
  const contentTerms = content.toLowerCase().split(/\s+/);
  const overlap = queryTerms.filter(t => contentTerms.includes(t)).length;
  const specificityScore = overlap / queryTerms.length;
  ```
- [ ] Combine factors with weights:
  ```typescript
  finalScore =
    0.40 * baseRelevance +
    0.20 * sourceQuality +
    0.15 * recency +
    0.15 * specificity +
    0.10 * citationFrequency;
  ```
- [ ] Add conflict detection (compare top 5 results for contradictions):
  - [ ] Use low-temp LLM call (0.1) to check if sources agree
  - [ ] Apply score penalty: `finalScore *= (1 - conflicts * 0.05)`
  - [ ] Store conflict metadata for UI display
- [ ] Gate with feature flag check
- [ ] Unit tests:
  - [ ] Test source quality ranking (PDF > markdown)
  - [ ] Test recency (newer > older)
  - [ ] Test specificity (exact match > semantic)
  - [ ] Test weighted combination
- [ ] Commit: `feat(rag): add multi-factor re-ranking service`

**Expected changes:**
- `extensions/ritemark/src/rag/reranking.ts` (new, ~200 lines)
- `extensions/ritemark/src/rag/reranking.test.ts` (new, ~150 lines)

#### 3.5: Context Assembly (2-3 hours)
- [ ] Create `src/rag/contextAssembly.ts`
- [ ] Implement `ContextAssembler` class:
  ```typescript
  interface ContextBudget {
    total: number;           // 2000-6000 tokens (configurable)
    primary: number;         // 60% for top-ranked chunks
    supporting: number;      // 30% for additional context
    metadata: number;        // 10% for titles, sections
  }

  class ContextAssembler {
    assemble(chunks: RankedResult[], budget: number): AssembledContext
  }
  ```
- [ ] Implement token counting (use tiktoken or simple word-based estimate)
- [ ] Implement 60/30/10 budget allocation:
  - [ ] Primary: Top 30% of chunks OR score > 0.7
  - [ ] Supporting: Next 50% by rank
  - [ ] Metadata: Document titles, section headers
- [ ] Implement deduplication:
  - [ ] Calculate content hash (first 100 chars)
  - [ ] Skip chunks with >80% similarity
- [ ] Implement smart truncation:
  - [ ] If chunk exceeds budget, truncate at sentence boundary
  - [ ] Preserve first and last sentences
  - [ ] Add "..." indicator
- [ ] Include conflict summary if detected
- [ ] Gate with feature flag check
- [ ] Unit tests:
  - [ ] Test budget allocation (60/30/10 split)
  - [ ] Test deduplication (skip similar chunks)
  - [ ] Test truncation (preserve sentences)
  - [ ] Test token overflow handling
- [ ] Commit: `feat(rag): add context assembly with token budget`

**Expected changes:**
- `extensions/ritemark/src/rag/contextAssembly.ts` (new, ~180 lines)
- `extensions/ritemark/src/rag/contextAssembly.test.ts` (new, ~120 lines)

#### 3.6: Anti-Hallucination Prompts (1-2 hours)
- [ ] Create `src/rag/prompts.ts`
- [ ] Define prompt templates:
  ```typescript
  enum PromptType {
    QA = 'qa',
    SUMMARY = 'summary',
    COMPARE = 'compare',
    EXPLAIN = 'explain',
  }

  class PromptBuilder {
    build(type: PromptType, context: string, query: string): string
  }
  ```
- [ ] Implement QA prompt (default):
  ```typescript
  const qaPrompt = `You are RiteMark AI, a document assistant.

  CRITICAL RULES - YOU MUST FOLLOW THESE:
  1. ONLY use information from the provided context below
  2. If information is NOT in the context, say "This information is not available in the indexed documents"
  3. ALWAYS cite your sources using [Source N] format
  4. NEVER make up or infer information not explicitly stated
  5. NEVER cite sources that weren't provided
  6. If sources disagree, mention BOTH perspectives with citations

  CITATION FORMAT:
  - Direct quotes: "quoted text" [Source N]
  - Paraphrased info: statement [Source N]
  - Synthesized info: statement [Source N, Source M]

  RESPONSE STRUCTURE:
  1. Answer the question directly first
  2. Provide supporting details with citations
  3. Note any limitations or gaps in available information

  CONTEXT:
  ${context}

  USER QUESTION:
  ${query}`;
  ```
- [ ] Implement SUMMARY prompt (for "Summarize X" queries)
- [ ] Implement COMPARE prompt (for "Compare X and Y" queries)
- [ ] Implement EXPLAIN prompt (for "Explain X" queries)
- [ ] Wire into `UnifiedViewProvider.ts` (replace current simple prompts)
- [ ] Gate with feature flag check (fallback to basic prompts if disabled)
- [ ] Test with LLM:
  - [ ] Verify citations are included
  - [ ] Verify "not available" response when info missing
  - [ ] Verify conflicting sources are mentioned
- [ ] Commit: `feat(rag): add anti-hallucination prompt templates`

**Expected changes:**
- `extensions/ritemark/src/rag/prompts.ts` (new, ~120 lines)
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` (~30 lines modified)

#### 3.7: Citation Verification (3-4 hours)
- [ ] Create `src/rag/citationVerifier.ts`
- [ ] Implement `CitationVerifier` class:
  ```typescript
  interface VerificationResult {
    citation: string;          // e.g., "[Source 3]"
    verified: boolean;
    confidence: number;        // 0-1 (overlap score)
    sourceIndex: number;
    matchedText: string;       // Best matching segment
    issues: string[];          // e.g., ["weak match", "source not found"]
  }

  class CitationVerifier {
    verify(response: string, context: AssembledContext): VerificationResult[]
  }
  ```
- [ ] Implement citation extraction (regex):
  ```typescript
  const CITATION_PATTERN = /\[Source\s*(\d+)\]/gi;
  const QUOTE_PATTERN = /"([^"]+)"\s*\[Source\s*(\d+)\]/gi;
  ```
- [ ] Implement text overlap scoring:
  - [ ] For quotes: exact match → 1.0, near-match → 0.9
  - [ ] For paraphrased claims: word overlap + key phrase matching
  - [ ] Thresholds:
    - MIN_OVERLAP_SCORE = 0.3 (minimum to verify)
    - HIGH_CONFIDENCE_THRESHOLD = 0.7 (strong verification)
- [ ] Implement best match finder:
  - [ ] Split source into sentences
  - [ ] Calculate overlap for each sentence
  - [ ] Return highest-scoring segment
- [ ] Detect hallucination indicators:
  ```typescript
  const claimIndicators = [
    /according to/i,
    /research shows/i,
    /studies indicate/i,
    /\d+%/,
    /the study found/i,
  ];
  ```
- [ ] Flag uncited claims (strong claims without citations)
- [ ] Gate with feature flag check
- [ ] Unit tests:
  - [ ] Test citation extraction (regex accuracy)
  - [ ] Test overlap scoring (exact/near/weak matches)
  - [ ] Test hallucination detection (uncited claims)
  - [ ] Test false positive rate (target < 5%)
- [ ] Commit: `feat(rag): add citation verification service`

**Expected changes:**
- `extensions/ritemark/src/rag/citationVerifier.ts` (new, ~220 lines)
- `extensions/ritemark/src/rag/citationVerifier.test.ts` (new, ~180 lines)

#### 3.8: Pipeline Integration (2-3 hours)
- [ ] Update `src/rag/search.ts`:
  - [ ] Import new services (reranker, assembler, prompts, verifier)
  - [ ] Modify `searchDocuments()`:
    ```typescript
    // 1. Hybrid search (if flag enabled)
    const rawResults = await vectorStore.search(query, embedding, 20);

    // 2. Re-rank (if flag enabled)
    const reranked = featureFlags.isEnabled('rag-v2-enhancements')
      ? reranker.rerank(rawResults, query)
      : rawResults;

    // 3. Assemble context (if flag enabled)
    const context = featureFlags.isEnabled('rag-v2-enhancements')
      ? assembler.assemble(reranked.slice(0, 10), 2000)
      : buildBasicContext(reranked.slice(0, 5)); // Sprint 24 fallback

    return context;
    ```
  - [ ] Add `buildRAGPrompt()` method using PromptBuilder
  - [ ] Add `verifyResponse()` method using CitationVerifier
- [ ] Update `src/views/UnifiedViewProvider.ts`:
  - [ ] Call `buildRAGPrompt()` instead of inline template
  - [ ] After LLM streaming completes, call `verifyResponse()`
  - [ ] Display verification metadata in UI:
    ```typescript
    interface MessageMetadata {
      verifiedCitations: VerificationResult[];
      conflictWarning?: string;
      confidence: number; // Average of all citation scores
    }
    ```
  - [ ] Show verification badges next to citations (✓ verified, ⚠ weak, ✗ invalid)
- [ ] Gate all enhancements with feature flag check
- [ ] Commit: `feat(rag): integrate v2 pipeline enhancements`

**Expected changes:**
- `extensions/ritemark/src/rag/search.ts` (~60 lines modified)
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` (~80 lines modified)

#### 3.9: UI Updates (2 hours)
- [ ] Update webview template in `UnifiedViewProvider.ts`:
  - [ ] Add verification badge CSS:
    ```css
    .citation-badge {
      font-size: 0.7em;
      vertical-align: super;
      padding: 0 4px;
      border-radius: 3px;
    }
    .verified { background: #4caf50; color: white; }
    .weak { background: #ff9800; color: white; }
    .invalid { background: #f44336; color: white; }
    ```
  - [ ] Add verification score display in message footer
  - [ ] Add conflict warning banner (if sources disagree)
  - [ ] Add feature flag toggle in settings (if experimental)
- [ ] Update message rendering to show badges:
  ```html
  [Source 3]<span class="citation-badge verified">✓</span>
  [Source 5]<span class="citation-badge weak">⚠</span>
  ```
- [ ] Add tooltip on hover (show matched text excerpt)
- [ ] Test UI rendering in dev mode
- [ ] Commit: `feat(rag): add citation verification UI`

**Expected changes:**
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` (~40 lines)

**Total Phase 3a estimated time:** 24-33 hours
- Step 0a (JS parsers): 3-4 hours ⭐ Must have
- Step 0b (Docling): 3-4 hours (optional, can defer)
- Steps 3.1-3.9 (pipeline): 18-25 hours

---

### Phase 3b: DEVELOP - Optional Enhancements (Future Sprint)
- [ ] Query expansion service
  - [ ] LLM-based variant generation
  - [ ] Rule-based fallback (remove question words, add prefixes)
  - [ ] Combine results from all variants
- [ ] Advanced conflict detection
  - [ ] Multi-way source comparison
  - [ ] Confidence scoring for conflicting claims
- [ ] Performance optimizations
  - [ ] Cache re-ranking scores
  - [ ] Batch citation verification
  - [ ] Parallel processing for large result sets

---

### Phase 4: TEST & VALIDATE
- [ ] Run all unit tests:
  - [ ] `npm test src/rag/reranking.test.ts`
  - [ ] `npm test src/rag/citationVerifier.test.ts`
  - [ ] `npm test src/rag/contextAssembly.test.ts`
- [ ] Integration tests:
  - [ ] End-to-end RAG pipeline (query → hybrid search → re-rank → LLM → verify)
  - [ ] Feature flag toggle (verify fallback to Sprint 24 works)
  - [ ] Compare Sprint 24 vs Sprint 27 results side-by-side
- [ ] Real-world testing:
  - [ ] Drop test documents into workspace:
    - [ ] Research paper (PDF)
    - [ ] Meeting notes (markdown)
    - [ ] Code documentation (TypeScript)
    - [ ] Scratch notes (text)
  - [ ] Run indexing
  - [ ] Test queries:
    - [ ] "What does the research say about X?" (expect PDF ranked first)
    - [ ] "Find all mentions of Y" (expect keyword match works)
    - [ ] "Summarize Z" (expect citations verified)
  - [ ] Verify re-ranking works (PDFs > markdown > text)
  - [ ] Verify citation verification catches hallucinations
  - [ ] Verify anti-hallucination prompts work (LLM admits unknowns)
- [ ] Performance benchmarks:
  - [ ] Measure search latency (target < 500ms)
  - [ ] Measure re-ranking overhead (target < 100ms)
  - [ ] Measure citation verification overhead (target < 50ms)
- [ ] Regression testing:
  - [ ] All Sprint 24 tests still pass
  - [ ] No breaking changes to existing RAG functionality
- [ ] **GATE: Invoke `qa-validator` before committing**

---

### Phase 5: CLEANUP
- [ ] Remove debug logging from all new files
- [ ] Add JSDoc comments to all public methods:
  - [ ] `Reranker.rerank()`
  - [ ] `CitationVerifier.verify()`
  - [ ] `ContextAssembler.assemble()`
  - [ ] `PromptBuilder.build()`
- [ ] Update README.md files:
  - [ ] `docs/sprints/sprint-27-rag-v2/README.md` (mark complete)
  - [ ] `docs/sprints/sprint-24-multimodal-rag/README.md` (add "Enhanced in Sprint 27" section)
- [ ] Update inline documentation in modified files
- [ ] Final code review (self-review checklist):
  - [ ] All feature flag checks in place
  - [ ] All error handling implemented
  - [ ] All edge cases handled
  - [ ] All tests passing
  - [ ] No TODO comments left
  - [ ] No console.log() statements
- [ ] Commit: `chore(rag): cleanup and documentation`

---

### Phase 6: DEPLOY
- [ ] Merge Sprint 27 branch into Sprint 24 branch (or main if Sprint 24 merged)
- [ ] Build production app with new enhancements
- [ ] Test production build:
  - [ ] Verify hybrid search works
  - [ ] Verify re-ranking works
  - [ ] Verify citation verification works
  - [ ] Verify feature flag toggle works
- [ ] **GATE: Invoke `qa-validator` final check**
- [ ] Create release notes:
  - [ ] Invoke `product-marketer` for changelog entry
  - [ ] Highlight new features (hybrid search, citation verification)
  - [ ] Document feature flag (how to enable)
  - [ ] Document performance improvements
- [ ] Update user documentation (if applicable)
- [ ] Tag release (if standalone release):
  - [ ] Determine release type (extension-only vs full app)
  - [ ] Invoke `release-manager` for release workflow
- [ ] Close sprint issue/branch
- [ ] Retrospective notes:
  - [ ] What worked well?
  - [ ] What could be improved?
  - [ ] Lessons learned for future RAG enhancements

---

## Status Tracking

**Current Phase:** 3a (DEVELOP) ✅

**Approval:** Jarmo approved on 2026-01-31

**Decisions:**
- ✅ Include Docling (Step 0b) behind `rag-docling` feature flag
- ✅ Migration: Re-index required for new features (no migration script)
- ✅ No side-by-side comparison UI needed

**Blockers:**
1. ~~Sprint 24 Phase 4 not complete~~ ✅ Sprint 24 released (v1.1.x)
2. ~~Jarmo approval pending~~ ✅ Approved

**Next Actions:**
1. Create branch from main
2. Begin Step 0a: JS Document Parsers (pdf-parse, mammoth)

---

## Approval

- [x] **Jarmo approved this sprint plan** ✅ (2026-01-31)

**Approval notes:**
- Include Docling behind feature flag
- Re-index required for migration
- No comparison UI needed

---

**Created:** 2026-01-31
**Last Updated:** 2026-01-31
