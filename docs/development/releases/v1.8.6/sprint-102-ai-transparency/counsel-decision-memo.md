# Sprint 102 — Counsel Decision Memo

**Prepared:** 2026-08-03  
**Requested decision:** EU AI Act Article 50 and associated Terms/Privacy wording  
**Product evidence:** [evidence-matrix.md](./evidence-matrix.md)  
**Status:** Awaiting counsel; do not treat this memo as legal advice

## Product Flow in One Paragraph

Ritemark is a macOS and Windows desktop editor. Its AI sidebar launches one of three local agent runtimes—Claude Code, Codex, or OpenCode—which connects directly to an external provider/service using the user's sign-in or API key. Ritemark constructs the prompt and can include active-file, selection, attachment, browser, conversation, and tool context. Productory does not operate an AI request proxy. Separately, the desktop app sends anonymous PostHog product events by default unless analytics is disabled.

## Decisions Requested

Please answer each flow separately where the answer differs.

1. **Role:** Is Productory a provider, deployer, both, or neither for the Ritemark sidebar as configured with Claude Code, Codex, and OpenCode?
2. **Article 50(1):** Is the implemented pre-first-interaction disclosure and persistent AI-information entry sufficient in placement and substance? What exact wording must change?
3. **Article 50(2):** Does Ritemark have a machine-readable marking/detectability obligation for generated or manipulated output? If so, which output types, what technique, and by what date? Does any pre-2-August-2026 grace period apply?
4. **Upstream markings:** Must Ritemark detect, preserve, or expose markings supplied by Anthropic, OpenAI, Google, OpenRouter, or models routed through OpenCode? What evidence must Productory retain?
5. **Article 50(4):** What notice, if any, should Ritemark give users who publish AI-generated or manipulated text concerning matters of public interest? What qualifies as meaningful human review or editorial control for the wording we may use?
6. **Privacy roles:** What controller/processor language should the Productory Privacy Policy use for desktop analytics, explicit feedback, and user-directed AI-provider processing?
7. **Terms:** Are the proposed provider, human-review, user-responsibility, and warranty sections acceptable for a free MIT-licensed desktop application?

## Current Engineering Baseline for Review

- A compact notice is visible before the first sidebar interaction and is not a repeated blocking modal.
- The notice states that the user is interacting with AI and names the selected runtime, provider/service, and model.
- A persistent information button remains in the composer.
- The detail view lists context categories that may leave the device, distinguishes Productory analytics from provider processing, and requires human review.
- The UI does not claim that prompts or file contents always remain local.
- No custom machine-readable marking has been added pending counsel's decision.

## Source Note

The European Commission's July 2026 materials state that Article 50 transparency obligations generally apply from 2 August 2026. The Commission's current quick-facts/Q&A materials also describe a limited transition for Article 50(2) marking obligations for certain systems placed on the market before that date. Counsel should determine whether that distinction affects Ritemark; engineering will not infer eligibility.
