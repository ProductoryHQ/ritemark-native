# Sprint 113 Design — Insights Language and Document Action

## Design Intent

The Insights rail remains a calm, dense writing-tool surface. Language is a small explicit setting near generation; creating a document is a deliberate secondary action after useful Insights exist.

## Rail Contract

- Keep the existing **Insights** heading, cards, timestamp controls, model attribution, and 288 px rail structure.
- Place an **Insights language** labelled select above the Generate action in the empty state and keep it available beside/near Regenerate after generation.
- Use Auto plus localized language names; expose the resolved Auto value in helper text such as “Auto · Estonian”.
- The control uses existing Ritemark/shadcn select primitives, Sofia Sans, role tokens, 6 px input radius, 1 px border, and the standard indigo focus ring.
- Do not add flags, colorful language badges, gradients, oversized headings, or custom modal chrome.

## Action Copy

- Empty state primary action: **Generate insights**.
- Existing result action: **Regenerate**.
- File action: **Create insights document**.
- The file action is secondary because generation is the main rail task.
- Helper copy makes the consequence explicit: “Creates a new Markdown file. Your transcript is not changed.”

## File Selection

- Use the native VS Code save dialog so filename and folder are chosen together and platform filename rules remain familiar.
- Suggest a readable `.md` filename approved in Phase 0.
- Existing targets are refused with concise copy: “Choose a new filename. Insights documents do not replace existing files.”
- Cancel returns focus to **Create insights document** and changes nothing.
- Success uses a non-blocking notification naming the created file and offers/open behavior only as approved in Phase 0.

## Accessibility and Responsive Rules

- Every control has a persistent accessible name; language state is not conveyed by color alone.
- Keyboard order follows heading → language → Generate/Regenerate → result cards/timestamps → Create document.
- Standard 4 px translucent indigo focus ring; no focus traps in the rail.
- At 200% zoom and narrow editor widths, labels may wrap but controls do not overlap or clip.
- Reduced motion preserves meaning; high contrast keeps native borders/focus visible.

## Speaker Name Display

- The transcript's speaker gutter keeps its fixed width; long labels never wrap or widen the column.
- Speaker labels use a single-line ellipsis. The timestamp stays visible beneath the label and transcript text begins at the same horizontal position for every turn.
- Speaker chips have a bounded maximum width. The color dot and click target remain visible while only the text span truncates.
- Native `title` plus an accessible full-name label expose the complete name; the rename input always shows the full editable value.
- Ellipsis is a display treatment only. Stored labels, transcript exports, and Insights prompts retain the complete full name.

## Design Acceptance

- The action cannot be mistaken for updating the transcript.
- Current and selected language are visible before generation.
- The new controls reuse the existing Indigo-Editorial vocabulary and add no new primitive.
- Names such as `Jarmo Tuisk` can be typed normally, and names longer than the available column/chip width never disturb layout.
