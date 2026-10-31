# Reviewing a Ritemark PR

Every PR gets an AI review before it merges. This file says what counts as a failure here, what not to report,
how to write a finding and how closely to look (the tier). `CLAUDE.md`'s rules apply too. Why and how this came
about: ritemark-dev `releases/v2.2.0/analysis/2026-10-27-review-process-plan.md`.

## What counts as a failure in Ritemark

- A feature stubbed, removed or turned off without Jarmo's word (`CLAUDE.md`, hard rule 1).
- Docs, notes or comments that say something the code doesn't do.
- A model ID outside `extensions/ritemark/src/ai/modelConfig.ts`.
- A stale or oversize webview bundle, or raw `@tailwind`.
- A VS Code change outside `patches/vscode/`.
- A layout invariant broken (patches 002, 018 and 019; `.claude/skills/vscode-development/references/layout-invariants.md`),
  a join between two surfaces included.
- A runtime-specific approval or tool path: one approval gate (`UnifiedApprovalGate`), one tool registry (`src/runtime/ritemarkTools.ts`).
- A secret or key in the repo, a log or a URL.
- A usage event that carries words, names, paths or a model name.
- Bundle-unsafe host code: `__dirname` depth, or a native, runtime-asset or dynamic-path dependency missing from esbuild's `external` list.
- A screen that restyles a `webview/src/components/ui/` control locally, or adds its own focus or open/close handling,
  instead of changing the control.
- A fix in one place for a defect a shared control or helper has, without finding the other places.

## What not to report

- Style a formatter or linter owns.
- Wording the Experience lead has set.
- Generated files: `media/webview.js` and `media/office-preview.js` (review their source), and lockfile churn.
- Screenshots and other evidence images (`qa/`, `qa-evidence/`, `frame-baseline/`).
- An old issue presented as new. Report it as Pre-existing.

## How to write a finding

- `file:line`, never a guessed name.
- Severity: **Important** (blocks the merge), **Nit**, or **Pre-existing** (there before this PR).
- One line on how it fails: the input or state, then the wrong result.
- Name the whole class of the bug, so the author fixes every case of it at once.

The review ends with a summary that gives the count, or says "No issues found."

## Review tiers

The paths a PR touches set its tier. The highest wins, and the author never lowers it. The PR template's Risk
section names the tier and the paths that set it. Paths below are under `extensions/ritemark/` unless they start at the root.

| Tier | Paths | Review |
| --- | --- | --- |
| **High** | Every path on `CLAUDE.md`'s shell-tier list; every other file in `.github/workflows/`; `src/update/`; `src/runtime/UnifiedApprovalGate.ts` and each runtime's permission handling (`canUseTool` in `src/agent/`, `src/codex/codexApproval.ts`, `session/request_permission` in `src/acp/`); `src/agent/setup.ts` (sign-in); `src/googleDocs/oauth.ts`; API-key storage (`src/ai/apiKeyManager.ts`, the key handling in `src/settings/`); `src/analytics/` (consent and events); `src/ai/modelConfig.ts` | `/code-review` at high, plus `/security-review`. An open finding of either blocks the merge. Jarmo checks the proof and merges, or the Development manager while he has delegated merging |
| **Standard** | The rest of `src/` and `webview/src/`; `scripts/` outside the High list; `.claude/` agents, skills and hooks; any path not listed here | `/code-review` at medium. A UI change also goes to the Experience lead with screenshots |
| **Light** | `docs/`, Markdown outside `.claude/`, tests only, copy-only changes | `/code-review` at low |

## Before the merge

- The merging session runs the review at the tier's level on the PR's head and puts its findings on the PR (`--comment`).
- Every finding is answered: fixed in a new commit, or resolved on the PR with a one-line reason (wrong, intentional, doesn't matter).
- Merge only when no Important finding is open, and only at the reviewed head (`gh pr merge --match-head-commit`).
  A commit after the review needs a review of that commit.
- At most three rounds. Round one reads the whole PR; rounds two and three read only the new commits, and report
  nothing already reported. After round three, stop and rethink the approach with Jarmo or the Experience lead.
  Don't re-tag `@codex review`.
- The record: a comment by the merging session that starts with **Review record**, posted after the last round. It
  names the reviewed head commit (SHA), the rounds and each finding's outcome (fixed, rejected, intentional, didn't
  matter), and the security review's outcome for High tier. The merge uses that SHA in `--match-head-commit`.
