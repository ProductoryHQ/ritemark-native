# Proof: the published page remembers each reader's place and links to a part

The page was built with the real page builder (`buildDeckPage`) from a synthetic deck, "Demo training / Assistants at work", with seven slides. Slide 5 has no handout, so it is a slide-only part. The page was served from 127.0.0.1 only and opened in a local Chromium. Nothing was published, and the page made no request beyond its own HTML.

A screenshot doesn't include the browser's address bar, so each shot has a black strip at the bottom that the proof script added. It reads `location.href` and the notice's state. The page itself has no such strip.

| Shot | Shows |
| --- | --- |
| `1-address-follows-part-4-1440x900` | Three steps down with j: part 4 is read and the address is `#4`. `history.length` stayed at 2, so no history entry was added. |
| `2-fresh-open-returns-to-part-4-1440x900` | The bare address opened again: the page returns to part 4, the address becomes `#4`, and "Start from the beginning" shows in the bar. |
| `3-link-opens-part-2-1440x900` | A `#2` link opened while part 4 was kept: part 2 opens, with no notice, and part 2 is now the kept place. |
| `4-address-follows-part-4-390x844` | Shot 1 on a phone. |
| `5-fresh-open-returns-to-part-4-390x844` | Shot 2 on a phone. The client's name gets an ellipsis while the notice shows. |
| `6-link-opens-part-2-390x844` | Shot 3 on a phone. |

Also checked in the same browser, without shots:
- `#5` (the slide-only part) shows slide 5 in the band at its place in the order.
- `#42` typed into the address goes to the page's top, and the address becomes the bare one.
- The notice was there at 0 s and at 3 s, and gone at 5.6 s.
- The only network request was the page itself.
