# Sprint 168 scenarios

Examples for the manual and test matrix. Synthetic decks only, never Jarmo's real decks. Each names its requirement in the spec.

## R1: the quote's look
- A quote with two paragraphs and an attribution line ("— A. Writer") on a dark theme: no fill, a full accent bar, words in the heading colour, the attribution smaller, bolder and in the sub colour. Same on the editor, wall, presenter view, strip and page.
- The same on Paper.
- A quote with an en dash ("– A. Writer") is drawn as an attribution too.
- A quote whose last line starts with a hyphen or no dash is drawn as plain words.
- A quote with only one line "— A. Writer": drawn as words.
- A deck with no quote reads as today.

## R2: a prompt out of a quote
- Cursor in one paragraph of a three-paragraph quote, Code block from the bubble: that paragraph becomes a code block at that place, the other two stay in the quote (split around it); Copy and ↗ show.
- Several paragraphs chosen: one code block holds them.
- The whole quote chosen: the quote is gone and one code block stands in its place.
- Code block from the / menu inside a quote: the same.
- Undo once: the quote is back exactly as it was.
- Code block outside a quote: unchanged. Code block on a code block: unchanged (toggles back).
- A quote in a column or a box: the code block stays in that box.

## R3: heading levels
- A slide with h1, h2 and h3 together: three clearly different sizes in order, h2 in the heading colour, bold.
- An h2 directly after the h1: the title's line, weight 500, sub colour, at 1.3em.
- A box's h3: as it is today.
- The / menu on a slide shows Heading 1, Heading 2, Heading 3 with `#`, `##`, `###`; typing "title" finds Heading 1, "subtitle" Heading 2, "heading" Heading 3, "pealkiri" Heading 1, "alapealkiri" Heading 2.
- The bubble still offers H1/H2/H3.
- A realistic synthetic deck with an h2 in the middle of a slide: the fit steps the words down and nothing overflows, on the editor, wall and page.
