Sprint 116 establishes one reproducible runtime and model baseline for v1.11.0 before later feature sprints validate against it. Jarmo approved the sprint scope, exact Phase 0 package, and implementation on 2026-09-13.

The branch pins Claude Code/SDK 2.1.270/0.3.270, Codex 0.154.0, OpenCode 1.18.30 with runtime-owned ripgrep 15.1.0, and ACP SDK 1.4.0. Schema-v3 packaging preserves Codex's complete official tree, verifies 12 source rows producing 25 installed files, and adds safe staged extraction. The measured adapter work covers Codex discovery, stale catalog floors, unknown-thread isolation, immediate Stop, and OpenCode's packaged dependency path.

Windows packaging now validates the exact unsigned manifest payload before Authenticode signing, then checks the complete signed tree and every nested runtime PE afterward.

Plan: `docs/development/releases/v1.11.0/sprint-116-runtime-model-baseline/sprint-plan.md`.

The canonical catalog now includes the approved current Claude, Codex/OpenAI, and Gemini choices; image Flow defaults move to GPT Image 2 and Gemini 3.1 Flash Image. Apple Silicon startup and authenticated Codex immediate cancellation/resend pass, every target archive/hash/architecture passes cross-inspection, and repository QA passes. Native Intel/Windows execution and signed artifact verification remain release CI gates.
