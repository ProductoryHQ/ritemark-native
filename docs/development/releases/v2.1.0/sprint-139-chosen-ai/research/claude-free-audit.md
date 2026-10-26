# A1: a Claude Free account (R2, R5, R8)

**Not run.** Jarmo answered "Mitte praegu" to test accounts and keys (26 October), so there is no Claude Free account to try, and nobody creates macOS users or signs anyone in or out for it.

## What that leaves out of this sprint (merge 1)

- **The refusal card** (R2, experience 35 frame 6): its words are the drawn draft and are final only after the reproduction. It is not built: building its mechanism needs a matcher for the refusal, and there is no seen refusal to match. The classifier has no `plan` kind; nothing in this branch guesses Claude's refusal.
- **Use ChatGPT / Use Claude** ("ask the same in a new chat with another AI"): Sprint 140 builds the host's "open a visible chat with this request in this AI" path. The refusal card and R5's plan-limit card will reuse it; this sprint builds no copy.
- **The status bar's "Claude needs a paid plan"** with the amber dot: part of the refusal card.
- **A refusal at sign-in** (S14): unknown until the reproduction.
- **What a Free account's billing error means.** The classifier reads Claude's SDK `billing_error` as credits only with an API key; with a Claude.ai sign-in it shows Claude's own sentence (kind `provider`), so a Free-plan refusal that arrives that way shows Claude's words once, with no guessed card.

## What the reproduction must record, when it runs

As the technical plan lists: under a separate macOS user, signed in once by Jarmo; Claude's sign-in page and `claude auth status --json` (does it name the plan?); the first message's SDK result, error category and text, and 2.0.1's screenshot; ChatGPT Free's `planType`, a working turn, and its usage-limit error if reached. Then the decision: where the refusal is caught, the code or anchored matcher, the card's final words (spec first, with the Experience lead), and its `first_reply` outcome (`plan`).
