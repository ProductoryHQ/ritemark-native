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

The effort follows what a mistake costs (Jarmo, 1 November 2026). The full process is for the shell (which draws the
start), a person's documents and the release, where a mistake is expensive to undo. Extension UI and small fixes get
one round and one piece of proof.

| Tier | Paths | Review |
| --- | --- | --- |
| **High** | Every path on `CLAUDE.md`'s shell-tier list; every other file in `.github/workflows/`; `src/update/`; `src/runtime/UnifiedApprovalGate.ts` and each runtime's permission handling (`canUseTool` in `src/agent/`, `src/codex/codexApproval.ts`, `session/request_permission` in `src/acp/`); `src/agent/setup.ts` (sign-in); `src/googleDocs/oauth.ts`; API-key storage (`src/ai/apiKeyManager.ts`, the key handling in `src/settings/`); `src/analytics/` (consent and events); `src/ai/modelConfig.ts`; saving and merging a person's documents: `src/editorSync/`, `src/ritemarkEditor.ts`, `webview/src/documentSyncReducer.ts`, `webview/src/editorValueReconciliation.ts`, `webview/src/types/documentSync.ts`, and a change to how `webview/src/App.tsx` applies or sends document state | `/code-review` at high, plus `/security-review`, up to three rounds. An open finding of either blocks the merge. Jarmo checks the proof and merges, or the Development manager while he has delegated merging |
| **Standard** | The rest of `src/` and `webview/src/`; `scripts/` outside the High list; `.claude/` agents, skills and hooks; any path not listed here | `/code-review` at medium, one round. A change to how a surface looks also goes to the Experience lead with its one screenshot; a fix that restores the look already drawn doesn't |
| **Light** | `docs/`, Markdown outside `.claude/`, tests only, copy-only changes | `/code-review` at low, one round |

## Before the merge

- The merging session runs the review at the tier's level on the PR's head and puts its findings on the PR (`--comment`).
- Every finding is answered: fixed in a new commit, or resolved on the PR with a one-line reason (wrong, intentional, doesn't matter).
- Merge only when no Important finding is open, and only at the reviewed head (`gh pr merge --match-head-commit`).
  A commit after the review needs a review of that commit. After the last round, on every tier, a commit is checked
  against the findings it answers, and anything in it beyond those fixes gets a round of its own.
- Rounds follow the tier. **High:** at most three. Round one reads the whole PR, round two reads only the new
  commits, and round three runs only when round two found something Important. No round reports what an earlier one
  already reported. **Standard and Light:** one round. The commits that fix its findings, or answer Codex, are
  checked against those findings only, not reviewed afresh. If the approach itself is in doubt after the last round,
  stop and rethink it with Jarmo or the Experience lead.
- Proof follows the tier too. **High:** the fault shown first, then shown fixed, on each platform it touches, with
  the measurements kept in the sprint's research. **Standard and Light:** one screenshot or one log line that shows
  the change works, and a research note only when the cause wasn't known.
- Codex reviews a PR by itself once, when it opens ready or goes from draft to ready. That review is its one loop:
  answer it once, in one commit, and stop. Never tag `@codex review`, and never toggle draft and ready to get
  another: each pass finds something new and the loop never ends (Jarmo, 1 November 2026). Open a PR as a draft
  and mark it ready once, after round one, so Codex's review is answered after it (on High, inside rounds two and
  three).
- The record: a comment by the merging session that starts with **Review record**, posted after the last round. It
  names the reviewed head commit (SHA), the rounds and each finding's outcome (fixed, rejected, intentional, didn't
  matter), and the security review's outcome for High tier. The merge uses that SHA in `--match-head-commit`.
