# Writing-Specific Agent Tools

**Sprint 33: Agentic GUI - Phase 1**
**Date:** 2026-02-07

## Problem Statement

The Claude Agent SDK provides code-focused tools:
- Bash (run shell commands)
- Read (read file)
- Write (write file)
- Edit (find-replace in file)
- Glob (file pattern matching)
- Grep (search file contents)

These are powerful for coding but awkward for writing workflows.

**Example:** A writer asks, "Reorganize my research notes into a thesis outline."

With code tools, the agent must:
1. Grep to find all markdown files
2. Read each file
3. Think about organization
4. Write a new outline file
5. Edit individual files to add cross-references

With writing tools, the agent could:
1. **Research** (built-in RAG search) to find related notes
2. **Reorganize** to create structure from existing content
3. **Cross-reference** to link related sections

## Proposed Writing Tools

These tools extend the Claude Agent SDK's capabilities for writing workflows.

### Tool 1: Research

**What it does:** Semantic search over workspace documents using RAG.

**Parameters:**
- `query` (string): Search query
- `topK` (number, default 5): Number of results
- `fileTypes` (array, optional): Filter by file types (e.g., ['md', 'txt'])

**Example usage:**
```
User: "Find all my notes about climate change impacts"

Agent: [Using Research tool]
→ query: "climate change impacts"
→ topK: 10
→ fileTypes: ['md']

Result: Found 10 documents with relevant content
```

**Implementation:**
- Calls existing RAG vector store
- Returns citations with file path, section, score
- Agent can then Read specific files for details

### Tool 2: Reorganize

**What it does:** Extract sections from multiple files and create a new structured document.

**Parameters:**
- `sourceFiles` (array): List of file paths to pull content from
- `outputFile` (string): New file to create
- `structure` (array): Ordered list of sections with source mappings

**Example usage:**
```
Agent: [Using Reorganize tool]
→ sourceFiles: ['notes/intro.md', 'notes/methods.md', 'notes/results.md']
→ outputFile: 'thesis-outline.md'
→ structure: [
    { heading: 'Introduction', source: 'notes/intro.md', section: 'Background' },
    { heading: 'Methodology', source: 'notes/methods.md', section: '*' },
    { heading: 'Results', source: 'notes/results.md', section: 'Findings' }
  ]
```

**Implementation:**
- Parse source markdown files
- Extract specified sections
- Create new file with reorganized content
- Add source attribution as comments

### Tool 3: Expand

**What it does:** Take bullet points or brief notes and expand into full paragraphs.

**Parameters:**
- `file` (string): File to edit
- `section` (string): Section heading to expand
- `tone` (string, optional): Writing tone (e.g., 'academic', 'casual', 'technical')

**Example usage:**
```
User: "Expand the methodology section with more detail"

Agent: [Using Expand tool]
→ file: 'thesis.md'
→ section: 'Methodology'
→ tone: 'academic'

Result: Expanded bullet points into full paragraphs
```

**Implementation:**
- Read section content
- Call OpenAI/Gemini LLM to expand (not Claude SDK)
- Replace section with expanded version
- Mark as agent-modified

### Tool 4: Format

**What it does:** Apply consistent formatting to markdown files.

**Parameters:**
- `files` (array): Files to format
- `rules` (object): Formatting rules (heading levels, list styles, etc.)

**Example usage:**
```
Agent: [Using Format tool]
→ files: ['*.md']
→ rules: {
    headingStyle: 'atx',
    listMarker: '-',
    codeBlockStyle: 'fenced',
    lineLength: 80
  }
```

**Implementation:**
- Use remark/unified pipeline
- Apply consistent markdown formatting
- Preserve content, fix syntax

### Tool 5: Cross-reference

**What it does:** Create bidirectional links between related documents.

**Parameters:**
- `sourceFile` (string): File to add links from
- `relatedFiles` (array): Files to link to
- `context` (string): Why these files are related

**Example usage:**
```
Agent: [Using Cross-reference tool]
→ sourceFile: 'chapter-1.md'
→ relatedFiles: ['appendix-a.md', 'methodology.md']
→ context: 'Related methodology details'

Result: Added "See also: [[methodology]] for details" at relevant points
```

**Implementation:**
- Parse markdown structure
- Find appropriate insertion points
- Add wiki-style [[links]] or standard markdown links
- Update both files (bidirectional)

### Tool 6: Summarize

**What it does:** Generate executive summaries or abstracts.

**Parameters:**
- `file` (string): File to summarize
- `length` (number): Target word count
- `style` (string): 'abstract', 'executive', 'tweet', etc.

**Example usage:**
```
User: "Create a 200-word abstract for my paper"

Agent: [Using Summarize tool]
→ file: 'research-paper.md'
→ length: 200
→ style: 'abstract'

Result: Created abstract.md with 198-word summary
```

**Implementation:**
- Read full document
- Call LLM for summarization
- Write summary to new file or section

## Implementation Strategy

### Phase 1 (This Sprint): Research Tool Only

- **Why:** Research integrates existing RAG system
- **Effort:** Low (RAG already works)
- **Impact:** High (makes agent aware of workspace knowledge)

**Task:** Create custom tool definition for Claude Agent SDK

```typescript
// agent/tools/research.ts
export const researchTool = {
  name: 'research',
  description: 'Search workspace documents using semantic search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      topK: { type: 'number', default: 5 },
      fileTypes: { type: 'array', items: { type: 'string' } }
    },
    required: ['query']
  },
  handler: async (params, context) => {
    const results = await searchDocuments(
      context.vectorStore,
      params.query,
      { topK: params.topK, fileTypes: params.fileTypes }
    );
    return {
      results: results.map(r => ({
        file: r.source,
        section: r.section,
        score: r.score,
        snippet: r.content.substring(0, 200)
      }))
    };
  }
};
```

### Phase 2+ (Future Sprints): Additional Tools

- **Reorganize:** Medium complexity, high value
- **Expand/Summarize:** Easy (LLM calls), high value
- **Format:** Low complexity, medium value
- **Cross-reference:** Medium complexity, medium value

## Alternative: Let Agent Use Existing Tools Creatively

**Counterargument:** Maybe we don't need writing-specific tools. The agent can compose existing tools to achieve writing workflows.

**Example:**
- "Reorganize notes" → Agent uses Read + Write + Edit
- "Expand section" → Agent uses Read + Edit (with LLM reasoning)
- "Cross-reference" → Agent uses Grep to find related content, Edit to add links

**Trade-offs:**
- Pro: Less code, more flexible
- Con: More token usage (agent plans each step)
- Con: Less reliable (agent might make mistakes in composition)
- Con: Harder to provide progress updates ("Reading 12 files" vs "Researching topic")

**Recommendation:** Start with Research tool only. Observe how agents compose other workflows. Add purpose-built tools if composition is awkward.

## Open Questions

1. **Should writing tools call external LLMs?**
   - Research: No (uses RAG)
   - Expand/Summarize: Yes (requires LLM reasoning)
   - Format: No (deterministic formatting)
   - Reorganize: No (structural transformation)
   - Cross-reference: Maybe (finding insertion points is hard)

2. **How do writing tools report progress?**
   - Same as code tools (tool_use events)
   - Add custom event types for writing-specific progress?

3. **Should tools be opt-in or always available?**
   - Recommendation: Always available in writing contexts
   - Hide code tools (Bash) unless user opts in

4. **Can tools be model-agnostic?**
   - Research: Yes (RAG is local)
   - Expand/Summarize: Must specify which LLM to use (OpenAI? Gemini? Claude?)
   - Recommendation: Use user's configured AI provider (same as chat)
