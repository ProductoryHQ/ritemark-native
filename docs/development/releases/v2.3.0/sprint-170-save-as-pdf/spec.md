# Sprint 170 spec: Save as PDF from Publish

The behaviour contract is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`, "Save as PDF, from Publish (19 November)"). This file numbers it for tests. If they differ, the README wins and this file is corrected.

- **R1. The button.** Publish stays the main part. A small ▾ beside it, a separate part with its own hover and focus, opens the menu: Publish…, then one item below it.
- **R2. The item names the view.** "Save slides as PDF…" in Slide only; "Save slides and handout as PDF…" in Slide and handout; "Save handout as PDF…" in Handout only. Under 600 px the view is Slide only.
- **R3. Slides.** One 16:9 page a slide, as on the wall, with the chosen tab and every reveal shown.
- **R4. Slides and handout.** A4 portrait, the published page's print exactly (`pageHtml.ts` `PRINT_CSS`).
- **R5. Handout.** A4 portrait, the text alone; each part starts with its number and heading; no slide pictures.
- **R6. Every kind.** Skipped slides are left out. Comments and notes never appear. Links and Buttons stay clickable. Copy and ↗ are not drawn. Fonts and pictures are embedded; it works offline.
- **R7. File names.** "<deck>.pdf", "<deck> – slides and handout.pdf", "<deck> – handout.pdf".
- **R8. Saving.** The system save dialog starts in the deck's folder. An existing file gets the system's Replace question, as the Text editor's Export as PDF does. Cancelling writes nothing.
- **R9. After saving.** The deck bar says "Saved as <name>.pdf" with Show in folder.
- **R10. Nothing else changes.** Publish itself, the published page and the Text editor's Export as PDF behave as before.
