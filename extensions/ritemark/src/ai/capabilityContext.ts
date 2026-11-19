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

import type { AgentId } from '../agent/types';
import { DECK_FONT_LIST, THEMES_FOLDER } from '../decks/deckTheme';
import { ACCENT_RATIO, TEXT_RATIO } from '../decks/themeChange';
import { RITEMARK_ICON_NAMES } from '../../webview/src/components/decks/slide/iconSet';
import type { PageIconName } from '../../webview/src/components/decks/slide/pageIcons';

/**
 * Sprint 169 (the Experience lead, 19 November): common names a training deck reaches for, so the AI writes Phosphor's
 * names in Phosphor's way. Typed, so each is a real regular icon.
 */
const ICON_EXAMPLES: readonly PageIconName[] = [
  'truck', 'users-three', 'user-circle', 'envelope-simple', 'chat-circle-text', 'calendar-check', 'clock',
  'chart-line-up', 'chart-pie-slice', 'currency-eur', 'shopping-cart', 'buildings', 'briefcase', 'graduation-cap',
  'lightbulb', 'brain', 'robot', 'shield-check', 'lock-key', 'gear', 'rocket-launch', 'handshake',
];

/**
 * #850 (Sprint 166 PR 9): the names a box's icon may carry, read from the icon set the slide draws with. Sprint 169
 * (#866): any Phosphor regular icon name, a few common ones as examples (the whole list would cost thousands of tokens
 * on every deck turn), then Ritemark's own names with the icon each draws; the dashed circle stays the net for a name
 * that is neither.
 */
const ICON_LINE = (() => {
  const own = RITEMARK_ICON_NAMES.map(({ name, phosphor }) => `\`${name}\` (${phosphor})`).join(', ');
  const examples = ICON_EXAMPLES.map((name) => `\`${name}\``).join(', ');
  return `- A box's \`icon\` is the name of any Phosphor regular icon (lower case, words joined by hyphens), for example ${examples}. These names are read too, each as the icon in brackets: ${own}. A name that is neither draws a dashed circle in the icon's place. For a box with no icon, write \`::: box\`.`;
})();

function iconLine(): string {
  return ICON_LINE;
}

/**
 * Sprint 162 PR 5: the DECKS lines on themes. The folder, the fonts and the ratios come from the theme reader's own
 * constants, so the words never name a font or a rule the engine doesn't have. Kept short: it goes with every deck turn.
 */
function themeLines(): string[] {
  const fonts = DECK_FONT_LIST.map((font) => font.name).join(', ');
  return [
    `- A deck's look is its theme: a \`<Name>.theme.md\` file in \`${THEMES_FOLDER}/\`, which the deck names in its \`theme:\` line. Its fields: \`name\`; \`background\`, \`headings\`, \`text\`, \`accent\` (each "#RRGGBB"); \`soft-light\` (true or false); \`heading-font\` and \`text-font\`; \`corners\` (square, soft or round); \`boxes\` (filled or outline). The fonts are the six Ritemark ships, by exact name: ${fonts}.`,
    `- Make or change a theme, and point decks at it, only with set_deck_theme: never write a theme file or a \`theme:\` line yourself. For a look, change the theme file, never individual slides. Text and headings need ${TEXT_RATIO} : 1 against the background, the accent ${ACCENT_RATIO} : 1 (check_theme_colours measures them; set_theme_draft_colours moves colours in an open theme tab's draft, unsaved).`,
    '- For a brand\'s look, read its brand guide (PDF or Word), logo (SVG or PNG) or `.pptx` in the folder (read_pptx_theme gives a PowerPoint theme\'s colours and fonts). A brand font that isn\'t one of the six gets the closest of them, and you say so in one line: "Fernhollow\'s guide uses Futura; the closest here is Space Grotesk."',
    '- When the folder holds more than one deck, ask "this deck or all of them?" before you write, unless the user already said.',
  ];
}

/** Bump when the capability text changes in a way runtimes should re-sync on. */
export const CAPABILITY_CONTEXT_VERSION = 5;

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
  /** Whether this runtime has the task board tools (include the TASK BOARD section). */
  hasBoardTools: boolean;
  /** Whether this runtime has the deck tools (include the DECKS section). */
  hasDeckTools?: boolean;
}

export const CLAUDE_DESCRIPTOR: CapabilityDescriptor = {
  editTool: 'your Write/Edit tools',
  hasBrowserTools: true,
  hasBoardTools: true,
};
export const CODEX_DESCRIPTOR: CapabilityDescriptor = {
  editTool: 'apply_patch',
  hasBrowserTools: true,
  hasBoardTools: true,
};
export const ACP_DESCRIPTOR: CapabilityDescriptor = {
  editTool: 'your file-writing tool',
  hasBrowserTools: true,
  hasBoardTools: true,
};

const DESCRIPTORS: Record<AgentId, CapabilityDescriptor> = {
  'claude-code': CLAUDE_DESCRIPTOR,
  codex: CODEX_DESCRIPTOR,
  opencode: ACP_DESCRIPTOR,
};

/**
 * The descriptor to render for one session. Each section follows the same
 * check that gives the runtime its tools, so the guidance appears exactly when
 * the tools do: `browser` is the `browser-agent-control` flag, `board` whether
 * this window has a task board (Sprint 130, W5). OpenCode has had the browser
 * tools since Sprint 79 yet was the one runtime whose hint did not follow them;
 * routing all three through here keeps it so.
 */
export function capabilityDescriptorFor(runtime: AgentId, tools: { browser: boolean; board: boolean; deck?: boolean }): CapabilityDescriptor {
  return { ...DESCRIPTORS[runtime], hasBrowserTools: tools.browser, hasBoardTools: tools.board, hasDeckTools: tools.deck === true };
}

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
        '- A standalone / margin note is an HTML comment on its own: `<!-- note text -->`. An existing one may carry a Ritemark-owned identity token first, as `<!-- {id:…} note text -->` — that token is not part of the note text.',
        '- A comment anchored to a span of text is a mark wrapper: `<mark data-comment="note text" data-comment-id="…" data-agent="…">the anchored text</mark>`.',
        '- Assign a comment to an agent by including `@claude`, `@chatgpt` (ChatGPT; `@codex` also works), or `@opencode` in its body.',
        '- Do NOT use a Markdown footnote (`[^1]`) or an inline aside to represent a comment — those are document content, not Ritemark comments.',
        '- Do NOT write `///` to make a comment: `///` is a live-editor input shortcut only; written into the file it stays literal text. Use the `<!-- … -->` or `<mark data-comment>` forms above.',
        '- When you rewrite surrounding prose, preserve any existing `<!-- … -->` blocks and `<mark data-comment …>` wrappers verbatim, including their `data-comment-id` and `data-agent` attributes and any leading `{id:…}` token inside a `<!-- … -->` note — dropping a comment loses the user\'s note, and dropping only its identity detaches it from agent work already running on it.',
        '- Never invent an `{id:…}` token or a `data-comment-id`, and never copy one from another comment. Ritemark assigns them; a note you write yourself simply has none.',
        '- When the user assigns you a comment, your FINAL message of that turn becomes the reply shown on the comment itself, under their note. Ritemark drops fenced code blocks and images from it, flattens links and formatting to plain text, and keeps roughly the first 280 characters — so finish with one or two plain sentences saying what you did and where, not a code block, not a bulleted summary, and not a bare `Done`.',
        '- Do NOT write that reply into the document, and do NOT delete or resolve the comment when you are finished. Clearing a comment is the user\'s action.',
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
        '- Sending a copy as PDF or Word, or publishing to Google Docs (the Share menu on the document\'s bar), and voice dictation.',
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
    id: 'board',
    render: (d) =>
      d.hasBoardTools
        ? [
            'TASK BOARD: this project has a task board — cards the user and agents work through (Ideas, To do, Doing, Done).',
            '- Read and change it only with the `ritemark_board` tools (list_cards, read_card, add_card, update_card, move_card, report_result, ask_user). Never edit the files in `.ritemark/tasks/` yourself.',
            '- When a message says it is a card on the task board, work toward the card\'s "Done when", and finish with report_result for that card: one or two sentences on what you did, plus up to three short things the user should check.',
            '- A card\'s id is for the tools only. Never write it in a reply to the user: call it "the task\'s card", or name the task by its title.',
            '- Before long work, put the decisions that would change the result to the user with ask_user first, rather than stopping halfway. For any decision that can wait, use ask_user instead of guessing, then end your turn; the answer comes back to the conversation.',
            '- Only the user marks a card done, and only the user deletes one.',
          ].join('\n')
        : null,
  },
  {
    id: 'decks',
    render: (d) =>
      d.hasDeckTools
        ? [
            'DECKS: a `.deck.md` file is a slide deck. The `Slide library` folder holds one deck per topic: the slides to reuse.',
            '- Find and read slides with the `ritemark_decks` tools (list_decks, read_deck). Put a slide from the library or another deck into a deck only with insert_slides, so the copy gets its `from:` line; never paste a library slide in by hand.',
            '- Never change anything in `Slide library/` unless the user asks for it; then use update_library_slide or add_to_library.',
            // Sprint 161 (PR 2): block slides, written like text (the Pandoc and Quarto `:::` blocks for columns, boxes and steps)
            '- To change a deck\'s own slides, edit the file. Each slide is a fenced block ```` ```slide ```` (the word `slide` alone) holding Markdown: first a short header between `---` lines with `id:` and, when the slide has them, `from:`, `skip: true`, `kept: true`, `section: true` (a section slide: its `# ` title alone, perhaps a short number line over it, and its handout part opening with `# `, not `## `), a picture beside or behind its words (`picture: left`, `right` or `behind` with `image: images/x.png`) and where its content sits (`valign: middle` or `bottom`; a title or section slide sits low by itself, so for it `valign: top` or `middle`; leave the line out for the slide\'s own place); then the slide itself: `# ` its title, a `## ` line under it, text, `-` and `1.` lists, tables and pictures (`![](images/x.png)`). Write a slide\'s words as you would a short document; never put a list number in front of a heading.',
            '- A slide\'s blocks are Pandoc\'s fenced divs, each closed by a line of as many colons as opened it: `:::: columns` holding two or three `::: column` (each with a `### ` heading and its lines); `:::: boxes` (or `:::: {.boxes look="steps"}`, `"arrows"`, `"line"`) holding `::: box` or `::: {.box icon="lightbulb"}`; and `::: steps` around a numbered list.',
            // Sprint 166 PR 9 (#850): the icon names a box may carry
            iconLine(),
            // Sprint 164 PR 3 (the decks README, "Label, a block of its own")
            '- A Label is a short line drawn as a pill in the theme\'s accent: a line of its own, `[Exercise · 1 / 2]{.label}`, with a blank line after it. It may stand anywhere on a slide: over the title, in a column, in a box or in a tab\'s pane. Its words are only what the user wants it to say ("1 / 2" too: nothing counts for them), and no block brings one: a `::: steps` block has none unless you write it. An older slide may still have `tag="…"` on its Steps line: that is its pill, so write it as a Label over the heading above the steps (or over the steps when there is none) and take `tag` off the line.',
            // Sprint 163 PR 5 (the decks README: the workbook, Tabs in the editor, the Button block, an exercise's layout)
            '- A prompt to copy goes in a code block with no language (```` ``` ```` alone), so it gets Copy and ↗ Open in; write each place to fill in in square brackets, `[the client\'s name]`. A slide holding a code block opens and closes with four backticks, ```` ````slide ````, so the code block\'s own ```` ``` ```` never ends the slide. Prompts done in order go in Tabs: `::: {.panel-tabset}` with a `## ` heading per tab and its pane under it; "put these four prompts in tabs" means one Tabs block, a tab per prompt. Never put Tabs inside Tabs, a box, a step or a table cell.',
            '- Material (a sample, a form, the emails) is a Button: a paragraph `[Open the sample](https://…){.button}`, any words beside it before the link. Only a full https address where the file already is (SharePoint, Drive); never copy a file into the project for it.',
            '- An exercise slide is one Columns block, with no title above it: the left column (`{.column width="35%"}`) holds its Label (`[Exercise · 1 / 2]{.label}`), then `# ` the title and right under it its `::: steps`; the right one (`width="65%"`) opens with the Tabs block, the material\'s Button right under it.',
            '- Keep each slide\'s header lines `id:` and `from:` as they are. A deck holding block slides says `deck: 2` in its front matter; keep that line. An older deck has ```` ```slide <kind> ```` blocks with YAML (`title:`, `items:`): read_deck shows them as block slides, the deck view writes the whole deck as block slides at its first edit, and any slide you write or rewrite is a block slide, with `deck: 2` added to the front matter.',
            '- Anything only the presenter should see goes in a Ritemark comment, `<!-- … -->` on its own lines in the slide\'s handout, never on the slide: the published page and the wall never show comments. There is no speaker-notes field; an older ```` ```notes ```` block becomes such a comment when the deck converts.',
            // 16 November: the handout is a Text document, and its headings are its own
            '- The handout is a Text document: the Markdown after a slide, up to the next one, is its handout. Each part opens with its own heading, `## ` and usually the slide\'s title (its first `# `): when you make a slide, write that heading right after its block. The heading is the handout\'s, not the slide\'s: changing a slide\'s title never changes its heading, and a heading never changes the slide, so leave the other one as it is unless the user asks for both. Keep the front matter\'s `handout: text` line as it is: it says the deck\'s handout is written this way.',
            '- A new slide is always a new slide block. In the deck view a line the person types in the handout (`***`) becomes one, with the heading after it as its title; in the file a line is only a line, so never put `***` or `---` between slides.',
            // 17 November (Jarmo: "how else do I say 'make the corrections on this slide'"): the slide the person is on
            '- A message sent while a deck is open in its deck view says which slide the person is on, in a `[Current slide: …]` line with its number, title and id. "This slide", "here" or "siin" means that slide: read it with read_deck and change it in the file, finding its block by its `id:` (by its number when it has none). Change other slides only when the person asks for them.',
            // Sprint 162 PR 5 (step-3-themes.md, "The AI and themes"): themes, from the parser's own fields and fonts
            ...themeLines(),
            // Sprint 159 PR 4: the handout page is made from the deck at Publish
            '- The web page beside a deck (`<deck name>.html`) is made from the deck when it is published: to change the page, change the deck, never the page.',
          ].join('\n')
        : null,
  },
  {
    id: 'files',
    render: () =>
      [
        'FILE OPERATIONS: you may create, rename, and delete files and folders within the workspace (writes are approval-gated). Never read, write, or delete `.git`, `node_modules`, `.env` files, `*.pem`, `*.key`, `credentials*`, or `secrets*` — if asked, explain they are excluded for safety.',
        // Sprint 140 (R5, experience 35 frame 3): Ritemark's name for the file, so "write About this project" lands where Ritemark shows it
        'ABOUT THIS PROJECT: what Ritemark calls "About this project" is the `AGENTS.md` file at the project\'s root. When asked to write or change About this project, write that `AGENTS.md` (never a file named "About this project"). If the root has no `CLAUDE.md`, also create one holding only the line `@AGENTS.md`, so Claude reads it too; never change a `CLAUDE.md` that is already there.',
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
        // Sprint 140 (R1, #497): every AI, whatever the spike decided
        'When you are asked to read a file and cannot open it (a scanned PDF, a password-protected or unreadable document), say which files you could not open rather than leaving them out silently.',
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
