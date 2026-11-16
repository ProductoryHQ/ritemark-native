# The AI knows which slide the person is on: the proof

Run on the evening of 16 November 2026 (after 18:00 Tallinn time) on macOS arm64, on one isolated dev instance (`scripts/qa/dev-launch-isolated.sh`: a fresh profile, scratch AI homes, `--use-mock-keychain`), with the demo project from Sprint 157 and the flag `decks` on in that profile. No real key, sign-in or browser was used.

Claude ran on the placeholder `sk-ant-test-placeholder-0000` (not a credential), given as the test channel's Anthropic key (`RITEMARK_BUILD_CHANNEL=test`, `RITEMARK_TEST_KEY_ANTHROPIC`), with `ANTHROPIC_BASE_URL` pointing at [`capture-server.mjs`](capture-server.mjs), a local stand-in that keeps only each request's context lines (`[Currently editing: …]`, `[Current slide: …]`) and the message's last line, and answers 401.

## The chip (the Experience lead's look, 17 November)

- [`01-chip-one-slide-tooltip.png`](01-chip-one-slide-tooltip.png): the chip reads "Slide 5 · Why talk about agents?" with the deck's icon; its tooltip says "AI assistants and agents, slide 5 of 13. Claude reads 'this slide' as this one."
- [`03-caret-in-handout-part-5.png`](03-caret-in-handout-part-5.png): the caret put in the handout's part 5 (the slide showed 1 before) makes slide 5 current, and the chip follows it.
- [`02-message-sent-on-slide-5.png`](02-message-sent-on-slide-5.png): the message "Make the corrections on this slide: shorter points." sent from the stage on slide 5.

## The request (`capture-claude.jsonl`)

Every `POST /v1/messages` of that turn carried:

```
[Currently editing: Harbour Logistics/AI assistants and agents.deck.md]
[Current slide: The person is on slide 5 of 13 ('Why talk about agents?', id g001) in AI assistants and agents.]
```

Then a new chat with `README.md` in front sent "Fix the typos here.": its requests carry `[Currently editing: README.md]` and no slide line.

## Not shown here

- Several slides selected on the strip: the strip has no multi-select yet, so the "Slides 3–5" chip and the list line are unit-tested only (`src/decks/currentSlide.test.ts`).
- The strip's pick: the strip was folded at this window's width (the AI column open); the pick sends the same message (`currentSlideMessage`), unit-tested.
- ChatGPT and OpenCode live turns: their prompts are unit-tested (`CodexRuntime.test.ts` 15b, `AcpRuntime.test.ts` 9b).
- Present: the chip while presenting was not looked at.
