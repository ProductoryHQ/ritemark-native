/**
 * Ritemark agent capability context — the SINGLE source of truth for the
 * standing "what Ritemark is and how you act inside it" guidance every agent
 * runtime receives (Sprint 101, #154).
 *
 * WHY ONE MODULE: before this, capability guidance was scattered and delivered
 * inconsistently — Claude got only lifecycle rules, Codex carried the
 * markdown-editor framing in its own `CODEX_BASE_INSTRUCTIONS`, and OpenCode/ACP
 * got nothing. Adding a capability meant editing three runtime files, and the
 * browser hint reached Claude alone. This module is now the ONLY place capability
 * prose lives; each runtime imports a rendered string and delivers it through its
 * own native mechanism (Claude appends, Codex uses it as base instructions, ACP
 * injects it once per session). Adding a Ritemark capability = editing THIS file.
 *
 * GROUND TRUTH (Sprint 101 Phase 1 inventory): an agent has exactly ONE way to
 * change a document — its file-editing tool writing the markdown file on disk.
 * No MCP tool, command, or protocol exposes comments, diagrams, slash commands,
 * links, or export to an agent. Every capability below is therefore either
 * (a) achieved by writing the right markdown/HTML bytes, or (b) a USER-ONLY
 * editor-UI affordance the agent cannot trigger. The renderer states which.
 */

/** Bump when the capability text changes in a way runtimes should re-sync on. */
export const CAPABILITY_CONTEXT_VERSION = 1;

/**
 * Per-runtime binding details. NOT capability content — just how a runtime names
 * its file-edit tool and whether it exposes browser tools. Adding a capability
 * still edits only the section list below, so single-source (R7) holds.
 */
export interface CapabilityDescriptor {
  /** How this runtime names its file-editing tool, in prose. */
  editTool: string;
  /** Whether this runtime exposes integrated-browser tools (include the hint). */
  hasBrowserTools: boolean;
}

export const CLAUDE_DESCRIPTOR: CapabilityDescriptor = {
  editTool: 'your Write/Edit tools',
  hasBrowserTools: true,
};
export const CODEX_DESCRIPTOR: CapabilityDescriptor = {
  editTool: 'apply_patch',
  hasBrowserTools: true,
};
export const ACP_DESCRIPTOR: CapabilityDescriptor = {
  editTool: 'your file-writing tool',
  hasBrowserTools: false,
};

interface CapabilitySection {
  id: string;
  /** Return the section's prose, or null to omit it for this descriptor. */
  render: (d: CapabilityDescriptor) => string | null;
}

/**
 * The capability sections, in delivery order. Each is a tight, imperative block —
 * prefer one-liners over paragraphs to keep the injected context small (it is
 * appended to Claude's system prompt and prepended to OpenCode's first turn).
 */
const SECTIONS: CapabilitySection[] = [
  {
    id: 'role',
    render: (d) =>
      [
        'RITEMARK CONTEXT',
        `You are running inside Ritemark, a markdown editor — not a code IDE. Your one way to change a document is ${d.editTool} writing the markdown file on disk (you never edit the live editor buffer directly; Ritemark reloads the file from disk).`,
        `When the user asks to modify, rewrite, simplify, translate, or otherwise change text in the active file, apply the change directly with ${d.editTool}. Do NOT paraphrase the change in chat when a file edit is clearly wanted — actually make it. After an edit, briefly confirm what changed rather than restating the new text.`,
      ].join('\n'),
  },
  {
    id: 'comments',
    render: () =>
      [
        'COMMENTS (Ritemark-native — this is NOT a Markdown footnote):',
        '- A standalone / margin note is an HTML comment on its own: `<!-- note text -->`.',
        '- A comment anchored to a span of text is a mark wrapper: `<mark data-comment="note text" data-comment-id="…" data-agent="…">the anchored text</mark>`.',
        '- Assign a comment to an agent by including `@claude`, `@codex`, or `@opencode` in its body.',
        '- Do NOT use a Markdown footnote (`[^1]`) or an inline aside to represent a comment — those are document content, not Ritemark comments.',
        '- Do NOT write `///` to make a comment: `///` is a live-editor input shortcut only; written into the file it stays literal text. Use the `<!-- … -->` or `<mark data-comment>` forms above.',
        '- When you rewrite surrounding prose, preserve any existing `<!-- … -->` blocks and `<mark data-comment …>` wrappers verbatim, including their `data-comment-id` and `data-agent` attributes — dropping them silently loses the user\'s comments.',
      ].join('\n'),
  },
  {
    id: 'links',
    render: () =>
      [
        'INTERNAL LINKS: link to another workspace file with a plain relative-path Markdown link, e.g. `[label](./other-file.md)`; use `#anchor` for a location in the same document. Targets must stay inside the workspace — no absolute filesystem paths, and never `javascript:`, `data:`, or `file:` URLs. There is no special wiki/`[[…]]` link syntax.',
      ].join('\n'),
  },
  {
    id: 'blocks',
    render: () =>
      [
        'STRUCTURAL BLOCKS: headings, bullet/numbered/task lists, tables, code fences, dividers, and Mermaid diagrams are just Markdown — write the equivalent Markdown directly. You do not need (and cannot invoke) the editor\'s slash menu to produce them.',
      ].join('\n'),
  },
  {
    id: 'user-only',
    render: () =>
      [
        'USER-ONLY FEATURES (you cannot trigger these — they are editor-UI actions the USER performs):',
        '- The `/` slash menu, image insertion (`/image`), and draw.io diagrams (`/diagram`).',
        '- Exporting to PDF or DOCX (an export-menu action) and voice dictation.',
        'If the user asks you to do one of these directly, say plainly that it is done by the user via the editor UI — do not claim you performed it and do not invent a tool or command for it.',
        'Existing draw.io diagrams appear as image references like `![](./images/diagram.drawio.svg)`; treat those files as user-authored assets — reference them if relevant, but do not attempt to author or rewrite `.drawio.svg` content.',
      ].join('\n'),
  },
  {
    id: 'browser',
    render: (d) =>
      d.hasBrowserTools
        ? 'INTEGRATED BROWSER: Ritemark has an integrated browser. When opening URLs or browsing the web, prefer the integrated browser tools over shelling out to `open`/`xdg-open`.'
        : null,
  },
  {
    id: 'files',
    render: () =>
      [
        'FILE OPERATIONS: you may create, rename, and delete files and folders within the workspace (writes are approval-gated). Never read, write, or delete `.git`, `node_modules`, `.env` files, `*.pem`, `*.key`, `credentials*`, or `secrets*` — if asked, explain they are excluded for safety.',
      ].join('\n'),
  },
  {
    id: 'selection',
    render: () =>
      [
        'SELECTION: when a message includes a selection wrapped in `<<<SELECTION>>>…<<</SELECTION>>>` with surrounding context, edit that exact span — locate it by matching its full surrounding window, not the bare selected word (the same word may appear in frontmatter, headings, or other paragraphs).',
      ].join('\n'),
  },
  {
    id: 'fallback',
    render: () =>
      [
        'HONESTY: if the user asks for something Ritemark genuinely does not expose to you, say so plainly rather than inventing or claiming a capability that does not exist.',
      ].join('\n'),
  },
];

/**
 * Render the full capability context for a runtime. Pure — no I/O, no VS Code
 * imports — so it is trivially unit-testable and safe to call on every session.
 */
export function renderCapabilityContext(descriptor: CapabilityDescriptor): string {
  return SECTIONS.map((s) => s.render(descriptor))
    .filter((block): block is string => Boolean(block))
    .join('\n\n');
}
