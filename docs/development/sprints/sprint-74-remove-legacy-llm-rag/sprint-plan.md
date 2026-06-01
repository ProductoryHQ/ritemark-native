# Sprint 74 — Remove legacy direct-LLM chat runtime + RAG

**Track:** SDD · **Phase:** R2–R5 implemented + compile/test-verified; awaiting manual QA + qa-validator + commit ·
**Branch:** `sprint-74-remove-legacy-llm-rag` · **Worktree:** main checkout

## Summary

Delete the deprecated "Legacy Agent" (direct OpenAI/Gemini chat) runtime and the unused RAG /
vector-index subsystem that only it consumed. Derived from TO BE architecture proposal **win #4**.
Pure subtraction — Claude Code, Codex, and Flows are untouched. The only dependency removed is
`@orama/orama`; `openai` / `apiKeyManager` / `modelConfig` stay because Flows use them.

## Why now

- The "Legacy Agent" runtime is deprecated; canonical runtimes are Claude Code + Codex.
- The RAG subsystem is no longer surfaced as a product feature but still ships, signs, and
  notarises — and pre-shrinks the tree for the future host-bundling sprint (win #1).

## MVP Scope

| Req | What |
| --- | --- |
| R1 | Audit-first reachability + dependency-ownership map (done) |
| R2 | Remove RAG / vector-index subsystem + `@orama/orama` |
| R3 | Remove the legacy direct-LLM runtime (`openAIClient`, `ai-execute`, `ritemark-agent`) |
| R4 | Guard: Claude Code, Codex, Flows, key config, legacy-history compat all intact |
| R5 | Reconcile architecture docs + changelog |

## Product Decisions

- **2026-05-31** — Scope set to full win #4 (RAG + legacy runtime + ghost client) by Jarmo.
- **2026-05-31** — Phase 0 audit found the legacy runtime is still *user-selectable* ("Legacy
  Agent" in `AgentSelector`) and has saved-conversation compat. Two decisions raised to the gate:
  (1) remove the selectable runtime entirely — default **yes**; (2) saved legacy conversations —
  default **keep read-only** via existing `legacy-ritemark` mapping. *Awaiting confirmation.*

## Success Criteria
- [x] R2: RAG subsystem gone; `@orama/orama` dropped; host `tsc` clean
- [x] R3: legacy runtime gone; selector shows only Claude Code + Codex; webview builds
- [x] R4 (automated): legacy history opens read-only; ai-sidebar + flow tests green
- [ ] R4 (manual, Jarmo): Claude Code + Codex + Flows + key config verified in running app
- [x] R5: docs + changelog reconciled
- [ ] qa-validator + pre-commit green; PR opened

## SDD Artifacts
- [spec.md](spec.md) — product and behaviour contract.
- [technical-plan.md](technical-plan.md) — deletion map across host + webview.
- [scenarios.md](scenarios.md) — behaviour examples incl. guard / data-safety negatives.
- [tasks.md](tasks.md) — implementation checklist (R2/R3 blocked on gate).
- [research/legacy-llm-reachability-audit.md](research/legacy-llm-reachability-audit.md) — Phase 0 findings.

## Status / Next step
R2–R5 implemented on the branch. Host `tsc` clean; webview `tsc` shows only 5 **pre-existing**
errors (unrelated files, confirmed absent-from-our-diff); webview bundle rebuilds; targeted
ai-sidebar + flow tests pass; straggler greps clean. **Next:** Jarmo runs manual guard QA
(Claude / Codex / Flows / key config in the app), then `qa-validator` + commit per workstream +
PR. Nothing committed yet.
