# Ritemark 1.11.0 Release Notes

## Runtime and model baseline

Sprint 116 refreshes the foundation used by Agent Chat and Flows:

- Claude Code 2.1.270 with Claude Agent SDK 0.3.270
- Codex 0.154.0 with its complete official app-server package
- OpenCode 1.18.30 with ACP SDK 1.4.0 and a bundled runtime-owned ripgrep
- GPT-6 Astra, Claude Fable 5.1, and current Gemini text choices in the model catalog
- GPT Image 2 and Gemini 3.1 Flash Image as defaults for new image Flows

Codex cancellation is more reliable when Stop is pressed immediately, and late events from an old explicit thread cannot be routed into another conversation. Successful OpenCode turns now end as **Done** instead of showing a false **Failed** marker after the answer and document edit completed. Runtime packaging verifies every archive and installed file across Apple Silicon, Intel macOS, and Windows; native Intel and Windows execution remains part of the release CI gate.
