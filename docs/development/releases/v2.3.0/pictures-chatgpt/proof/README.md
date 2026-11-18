# Pictures with ChatGPT: proof

One isolated dev run at 1440 × 900 (`scripts/qa/dev-launch-isolated.sh`, AI homes isolated, no sign-in), on a synthetic project ("Harbour Logistics": one document, one deck, a drawn harbour picture). No AI was asked: the development build's stand-in (`RITEMARK_PICTURE_STANDIN`) answered each request after four seconds with a second drawn picture (the harbour at night). The live picture from ChatGPT is Jarmo's own test.

| Shot | What it shows |
| --- | --- |
| `01-slide-make-new-picture-empty-place.png` | An empty side place says "or make one with ChatGPT"; its field, "Make a new picture with ChatGPT", starts from the slide's title. |
| `02-doc-making-with-cancel.png`, `02b-slide-making-with-cancel.png` | "ChatGPT is making the picture…" with Cancel, in a document and on a slide. |
| `03-doc-result-undo-try-another.png`, `03b-slide-result-undo-try-another.png` | The made picture in its place: "ChatGPT changed the picture. The old one is still in images/." and "ChatGPT made the picture. It's in images/.", with Undo and Try another. |
| `03c-slide-picture-in-words-changed.png` | A picture in a slide's words changed, its size kept. |
| `04a-doc-chatgpt-menu.png`, `04-doc-change-this-picture.png` | The bar's ChatGPT menu (Change this picture…, Make a new picture…) and the field for a change. |
| `05-not-signed-in-sign-in-card.png` | ChatGPT not signed in: the AI's sheet shows ChatGPT's own sign-in card, and the strip says to sign in first. Nothing was sent. |
| `06-doc-bar-comment-chatgpt.png`, `06b-slide-side-bar-comment-chatgpt.png` | The picture bar with Comment and ChatGPT, in a document and on a slide's side picture. |
| `06c-slide-bar-folded-to-icons.png` | A picture in a slide's words with the AI sheet open: the bar is narrower than its words and shows icons only (the fold rule of experience 49), ChatGPT's word going with Description's. |

Checked in the run, on the files: Change in the document wrote `./images/the-same-quay-at-night-with.png`; Try another wrote `…-2.png` and kept the first; Undo on the strip brought the first back; the slide's picture was named after its title (`images/the-quay-at-night.png`), and one Undo emptied the place again; Cancel wrote nothing.
