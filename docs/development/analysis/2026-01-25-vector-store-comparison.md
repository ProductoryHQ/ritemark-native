# Vector Store Comparison for Local RAG

**Date:** 2026-01-25
**Context:** Ritemark Native Sprint 24 - Multi-Modal RAG
**Problem:** sqlite-vec + better-sqlite3 version mismatch causing system failures

---

## Problem Diagnosis: sqlite-vec + better-sqlite3

Current `package.json` has a version mismatch:
```json
"sqlite-vec": "^0.1.0",           // JS wrapper - resolves path to platform package
"sqlite-vec-darwin-arm64": "^0.1.6"  // native .dylib - platform binary
```

### Issues Stack

1. **Version mismatch** - The main `sqlite-vec` package at `^0.1.0` may not correctly resolve the platform package at `^0.1.6`. These should always be at the same version.

2. **Alpha status** - Latest npm version is `0.1.7-alpha.2` (published over a year ago). The project is actively developed on GitHub (latest stable: v0.1.6, Nov 2024) but npm publishing seems neglected.

3. **Electron/VS Code `.dylib` bug** - [electron-builder #8824](https://github.com/electron-userland/electron-builder/issues/8824) documents a path resolution bug where sqlite-vec tries to load `vec0.dylib.dylib` (doubled extension) in packaged apps. Works in dev, breaks in production.

4. **better-sqlite3 Node.js compatibility** - better-sqlite3 breaks on Node.js v24/v25 due to deprecated V8 APIs. VS Code's Electron ships its own Node.js version, adding another compatibility layer.

5. **VS Code extension distribution** - [better-sqlite3 #1194](https://github.com/WiseLibs/better-sqlite3/issues/1194) and [#1321](https://github.com/WiseLibs/better-sqlite3/issues/1321) document issues with using better-sqlite3 inside VS Code extensions specifically. Native binaries need to be compiled for the correct Electron ABI.

**Bottom line:** This stack (sqlite-vec + better-sqlite3) has 3 layers of native dependency problems that compound in a VS Code extension context.

---

## Real-World Local RAG Implementations (2025)

### 1. Continue (VS Code extension) → LanceDB

The closest comparison to our project. [Continue uses LanceDB](https://lancedb.com/blog/the-future-of-ai-native-development-is-local-inside-continues-lancedb-powered-evolution/) because it's "the only vector database with an embedded TypeScript library capable of fast lookup times while being stored on disk."

- Indexes codebases into ~10-line chunks
- Default embeddings: `all-MiniLM-L6-v2` (local, free)
- Storage: `~/.continue/index/lancedb/`
- Metadata: SQLite alongside
- Known bugs: ["lance.connect is not a function"](https://github.com/continuedev/continue/issues/7192), indexing failures

### 2. AnythingLLM (Electron desktop) → LanceDB

[The leading desktop RAG app](https://github.com/Mintplex-Labs/anything-llm) (~30K GitHub stars). Uses LanceDB as default embedded vector store.

- Zero config, fully local, stored in app data folder
- Scales to millions of vectors on disk
- Also supports Chroma, Pinecone, Milvus, Qdrant as alternatives

### 3. VS Code RAG extensions (MCP-based) → ChromaDB

The most common pattern for VS Code + MCP RAG uses a Python MCP server with ChromaDB.

- Requires separate Python process
- ChromaDB 2025 Rust rewrite = 4x faster
- But: external dependency, not truly embedded

### 4. Orama → Pure TypeScript (<2KB!)

[Full search engine + RAG pipeline](https://github.com/oramasearch/orama) in pure TypeScript. Under 2KB minified.

- **Full-text + vector + hybrid search** in one package
- Typo tolerance, BM25 ranking, 30 languages
- Works in browser, Node.js, edge, mobile
- Apache 2.0
- No native dependencies

### 5. Vectra → Pure TypeScript, JSON files

[Local vector database](https://github.com/Stevenic/vectra) for Node.js with Pinecone-like features.

- Purpose-built for document RAG in Node.js
- OpenAI embeddings integration built-in
- JSON file persistence
- In-memory queries (1-2ms)
- Zero native dependencies

---

## Comparison Matrix

| Solution | Native Deps | Bundle Size | Max Scale | Hybrid Search | Proven In |
|----------|------------|-------------|-----------|---------------|-----------|
| **Vectra** | None | ~50KB | ~10K items | No (vector only) | OpenAI community |
| **Orama** | None | <2KB | ~100K+ items | **Yes** (full-text + vector) | Production sites |
| **LanceDB** | Rust bindings | ~50MB | Millions | SQL-like filters | Continue, AnythingLLM |
| ChromaDB | Python | Server process | Millions | Yes | MCP RAG extensions |
| sqlite-vec | C binaries | ~5MB | Millions | No | Few (alpha) |

---

## Option A: Fix sqlite-vec versions

Align all packages to `0.1.7-alpha.2`:
```json
"sqlite-vec": "0.1.7-alpha.2",
"sqlite-vec-darwin-arm64": "0.1.7-alpha.2",
"better-sqlite3": "^11.0.0"
```

**Pros:** Minimal code changes
**Cons:** Still alpha, still native deps, still Electron ABI issues, still `.dylib.dylib` bug in production builds

---

## Option B: Vectra

[Vectra](https://github.com/Stevenic/vectra) - pure TypeScript local vector DB, JSON-file backed.

| Property | Value |
|----------|-------|
| Language | 100% TypeScript |
| Native deps | **Zero** |
| Storage | JSON files on disk (`index.json` per index) |
| Query speed | 1-2ms (in-memory linear scan) |
| Embedding support | OpenAI, Azure OpenAI, any compatible endpoint |
| Search | Cosine similarity + MongoDB-style metadata filtering |
| Scale target | Hundreds to thousands of items |

**How it works:**
- Each index is a folder with `index.json` (vectors + metadata)
- Loaded entirely into RAM for queries
- Pre-normalized vectors, cosine similarity ranking
- `LocalDocumentIndex` handles chunking + embedding + retrieval automatically

**For our use case (workspace RAG):**
- A workspace with 100 documents → ~500-2000 chunks
- 2000 chunks × 1536 dims × 4 bytes = ~12MB RAM (trivial)
- Query: 1-2ms
- No compilation, no platform binaries, no Electron ABI issues

---

## Option C: Orama (Recommended)

[Orama](https://github.com/oramasearch/orama) - full search engine in pure TypeScript.

| Property | Value |
|----------|-------|
| Language | 100% TypeScript |
| Native deps | **Zero** |
| Bundle size | <2KB minified |
| Storage | In-memory + JSON persistence |
| Search types | Full-text (BM25) + Vector + **Hybrid** |
| Features | Typo tolerance, facets, filters, 30 languages |
| Scale | ~100K+ items |

**Why hybrid search matters:**
- Vector-only: "find semantically similar content"
- Full-text-only: "find exact keyword matches"
- Hybrid: Combines both for better retrieval quality

Example: Searching for "authentication" finds:
- Vector: code about "login", "user sessions", "credentials"
- Full-text: exact matches of "authentication", "auth", "authenticate"
- Hybrid: Best of both, ranked together

---

## Option D: LanceDB

[LanceDB](https://lancedb.com/) - embedded vector DB used by Continue and AnythingLLM.

**Pros:**
- Battle-tested in major VS Code extensions
- Scales to millions of vectors
- SQL-like filtering
- Disk-based (low memory)

**Cons:**
- Rust native bindings (~50MB)
- Known bugs in VS Code context
- Same class of problems as sqlite-vec (native deps)
- Overkill for workspace-level search

---

## Recommendation

| Priority | Choice | Why |
|----------|--------|-----|
| 1st | **Orama** | Hybrid search (better results), <2KB, zero deps, actively maintained, 7.5K stars |
| 2nd | **Vectra** | Simpler API, purpose-built for document RAG, OpenAI integration |
| 3rd | **LanceDB** | If we ever need million-scale (we don't) |

### Why Not LanceDB?

The big players (Continue, AnythingLLM) chose LanceDB because they need to scale to million-line codebases. But they also suffer from [native dependency bugs](https://github.com/continuedev/continue/issues/1218).

For a workspace-level RAG (50-500 documents, few thousand chunks), the pure-JS options are sufficient and eliminate all native dep headaches.

### Why Orama > Vectra?

Orama's hybrid search means we can combine keyword matching ("find mentions of authentication") with semantic similarity ("find code related to user login") - which is exactly what workspace search needs.

Both eliminate the sqlite-vec/better-sqlite3 native dependency problem entirely.

---

## Implementation Impact

The refactor is contained to `extensions/ritemark/src/rag/vectorStore.ts`. The external API stays the same:
- `insertChunks()`
- `search()`
- `removeBySource()`
- `getStats()`
- `isFileIndexed()`

Dependencies to remove:
```json
- "better-sqlite3": "^11.0.0"
- "sqlite-vec": "^0.1.0"
- "sqlite-vec-darwin-arm64": "^0.1.6"
- "@types/better-sqlite3": "^7.6.0"
```

Dependencies to add:
```json
+ "@orama/orama": "^3.0.0"
```
or
```json
+ "vectra": "^0.9.0"
```

---

## Sources

- [sqlite-vec official docs - Node.js usage](https://alexgarcia.xyz/sqlite-vec/js.html)
- [sqlite-vec GitHub releases](https://github.com/asg017/sqlite-vec/releases)
- [electron-builder #8824 - sqlite-vec native loading error](https://github.com/electron-userland/electron-builder/issues/8824)
- [better-sqlite3 #1411 - Node.js v25 build failure](https://github.com/WiseLibs/better-sqlite3/issues/1411)
- [better-sqlite3 #1194 - VS Code extension errors](https://github.com/WiseLibs/better-sqlite3/issues/1194)
- [Vectra GitHub](https://github.com/Stevenic/vectra)
- [Orama GitHub](https://github.com/oramasearch/orama)
- [Continue + LanceDB integration](https://lancedb.com/blog/the-future-of-ai-native-development-is-local-inside-continues-lancedb-powered-evolution/)
- [AnythingLLM GitHub](https://github.com/Mintplex-Labs/anything-llm)
- [AnythingLLM LanceDB docs](https://docs.anythingllm.com/setup/vector-database-configuration/local/lancedb)
- [Continue codebase embeddings docs](https://docs.continue.dev/features/codebase-embeddings)
- [Continue LanceDB indexing issue](https://github.com/continuedev/continue/issues/7192)
