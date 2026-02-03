# Technical Decisions - Claude Code Node

**Sprint:** 01 - Claude Code Node for Flows
**Date:** 2026-02-03

---

## Decision 1: CLI Subprocess vs Agent SDK

**Options:**
- A) CLI subprocess (`claude -p "prompt" --output-format json`)
- B) Agent SDK integration (`@anthropic-ai/claude-agent-sdk`)

**Decision:** Option A (CLI subprocess)

**Rationale:**
- Uses official CLI with full capabilities
- Inherits auth from `~/.claude/` (no additional key management)
- JSON output is structured and parseable
- No additional npm dependencies
- Follows existing subprocess pattern from whisperCpp.ts
- Can evolve to Agent SDK later if needed

**Trade-offs:**
- Pro: Simplest implementation, reuses existing patterns
- Pro: Users already have CLI if they use Claude Code
- Con: Requires CLI installed (but this is a reasonable prerequisite)
- Con: No streaming progress (future enhancement)

---

## Decision 2: Direct File Modification vs Output-Only

**Options:**
- A) Direct modification - Claude Code writes to workspace
- B) Output-only - Return file paths, require Save File node

**Decision:** Option A (Direct modification)

**Rationale:**
- Matches Claude Code's native behavior
- Enables "office automation" use case (Jarmo's #1 priority)
- Simpler flow graphs (no extra Save File nodes)
- Users expect AI to "do the work" not just suggest changes

**Safety measures:**
- Runs in workspace context only
- User-initiated (flow must be explicitly executed)
- Output includes list of modified/created files for transparency

---

## Decision 3: Timeout Configuration

**Options:**
- A) Fixed timeout (5 minutes)
- B) Configurable timeout per node (1-60 minutes)

**Decision:** Option B (Configurable with defaults)

**Rationale:**
- Different tasks have different time requirements
  - Simple: "Create README" = 1 minute
  - Complex: "Refactor codebase" = 30+ minutes
- Allows power users to optimize
- Default of 5 minutes covers most use cases
- Max of 60 minutes prevents runaway processes

**Implementation:**
- User sets in minutes (clearer than milliseconds)
- Convert to ms in executor: `timeout * 60 * 1000`
- Show remaining time in UI (future enhancement)

---

## Decision 4: Output Format

**Options:**
- A) Text only (like LLM node)
- B) Structured: `{ text, files, sessionId }`

**Decision:** Option B (Structured output)

**Rationale:**
- Text alone loses important information
- File list enables downstream processing
- SessionId enables future resume capability
- Matches Claude Code's JSON output format

**Output structure:**
```typescript
{
  text: string;        // Summary of what was done
  files?: string[];    // Modified/created file paths
  sessionId?: string;  // For potential resume (future)
  error?: string;      // Error message if failed
}
```

**Variable interpolation:**
- `{ClaudeCode}` resolves to `text` field
- `{ClaudeCode.files}` could resolve to file array (future)

---

## Decision 5: Binary Detection

**Options:**
- A) Hardcode path `/usr/local/bin/claude`
- B) Check multiple common paths
- C) Use `which claude` command

**Decision:** Option B (Check common paths)

**Rationale:**
- Different installation methods use different paths:
  - Homebrew: `/opt/homebrew/bin/claude`
  - Direct install: `/usr/local/bin/claude`
  - NPM global: `~/.npm/bin/claude` or `/usr/local/bin/claude`
- `which` requires shell execution (less reliable)
- Checking 3-4 common paths is fast and reliable

**Implementation:**
```typescript
const possiblePaths = [
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  path.join(os.homedir(), '.npm/bin/claude'),
  path.join(os.homedir(), '.local/bin/claude'),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    return p;
  }
}
```

---

## Decision 6: Authentication Strategy

**Options:**
- A) Inherit from `~/.claude/` (CLI's auth)
- B) Separate API key in VS Code secrets
- C) Reuse Anthropic API key from settings

**Decision:** Option A (Inherit from CLI)

**Rationale:**
- Claude Code CLI manages its own auth
- No need to duplicate key management
- Simpler user experience (one auth flow)
- Prerequisite: User must run `claude` in terminal first

**Auth check:**
```typescript
const claudeConfigDir = path.join(os.homedir(), '.claude');
if (!fs.existsSync(claudeConfigDir)) {
  throw new Error('Claude Code not authenticated...');
}
```

---

## Decision 7: AbortSignal Integration

**Options:**
- A) No cancellation support
- B) AbortSignal with subprocess kill

**Decision:** Option B (Full cancellation support)

**Rationale:**
- Long-running tasks MUST be cancellable
- Existing flow executor passes AbortSignal
- Killing subprocess is straightforward
- Matches whisperCpp.ts pattern

**Implementation:**
```typescript
if (abortSignal?.aborted) {
  proc.kill();
  return { text: '', error: 'Cancelled by user' };
}

abortSignal?.addEventListener('abort', () => {
  proc.kill();
});
```

---

## Decision 8: Feature Flag

**Decision:** NO feature flag needed

**Rationale:**
- Not platform-specific (works where Claude Code CLI works)
- Not experimental (Claude Code CLI is stable)
- User-initiated (only runs when added to flow)
- No large downloads
- No kill-switch needed (synchronous, user-controlled)
- If issues arise, users simply don't add the node to flows

---

## Decision 9: Progress Indication

**Options:**
- A) No progress (just "Running...")
- B) Streaming step-by-step output
- C) Simple timeout countdown

**Decision:** Option A for MVP, Option B for Phase 2

**Rationale:**
- MVP: Simple "Running..." indicator
  - Show elapsed time
  - Show timeout remaining
- Phase 2: Parse Claude Code's structured output
  - Show current tool being used
  - Show file being modified
  - Requires parsing --output-format json streaming

**MVP implementation:**
```typescript
// UI shows: "Running... (2:34 / 5:00)"
```

---

## Decision 10: Node Type Name

**Options:**
- A) `claude-code`
- B) `agent`
- C) `code-task`

**Decision:** Option A (`claude-code`)

**Rationale:**
- Clear and specific
- Matches the tool name
- Distinguishes from LLM node
- Future-proof (can add other agent types later)

---

## Summary

| Decision | Choice | Key Benefit |
|----------|--------|-------------|
| Implementation | CLI subprocess | Simplest, reuses patterns |
| File modification | Direct | Matches user expectations |
| Timeout | Configurable (1-60 min) | Flexible for different tasks |
| Output | Structured (text + files) | Enables downstream processing |
| Binary detection | Multiple common paths | Works across installations |
| Authentication | Inherit from CLI | No duplicate key management |
| Cancellation | AbortSignal + kill | Must-have for long tasks |
| Feature flag | None | Not needed (user-initiated) |
| Progress (MVP) | Simple indicator | Ship fast, enhance later |
| Node type | `claude-code` | Clear and specific |
