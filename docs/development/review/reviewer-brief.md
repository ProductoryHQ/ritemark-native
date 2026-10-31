# The reviewer brief, and how the diffs were cut

How the baseline score in [`incidents.md`](incidents.md) was produced on 31 October 2026, so a re-score can run
the same way. A re-score uses this brief, these diffs and today's `REVIEW.md`, and adds a diff for each new
incident row.

## The diffs

Each item is one diff from a base to a head commit, cut by the script below. Incident items and clean items were
mixed and numbered so the number says nothing about which is which.

| Item | Base | Head | Tier | What it is |
| --- | --- | --- | --- | --- |
| D01 | `53a0456a^` | `53a0456a` | High | Incident 10, PR #543 |
| D02 | `e265e20b^` | `e265e20b` | High | Clean, PR #575 |
| D03 | `4eddf7d6^1` | `4eddf7d6` | Standard | Incident 11, PR #255 |
| D04 | `f04dc202^1` | `f04dc202` | High | Incident 4, PR #113 |
| D05 | `ad9bcc61^` | `ad9bcc61` | Light | Clean, PR #519 |
| D06 | `473e3da4^1` | `473e3da4` | Standard | Incident 1, PR #8 |
| D07 | `7852c9f3^` | `7852c9f3` | Standard | Clean, PR #587 |
| D08 | `f8acfb17^` | `f8acfb17` | High | Incident 5, second commit |
| D09 | `f0b9d34a^1` | `f0b9d34a` | High | Incident 3, PR #141 |
| D10 | `e91c3d9a^` | `e91c3d9a` | Standard | Clean, PR #523 |
| D11 | `9cc928ed^` | `9cc928ed` | High | Incident 5, first commit |
| D12 | `beac93b2^` | `beac93b2` | High | Incident 9, PR #565 |
| D13 | `46380193^` | `46380193` | Standard | Incident 6, PR #27 |
| D14 | `7810385d^` | `7810385d` | High | Clean, PR #528 |
| D15 | `640e2aac^1` | `640e2aac` | Standard | Incident 8, PR #266 |

A PR's diff runs from the merge's first parent to the merge (`^1`), or covers the squash commit; a commit with no
PR is diffed against its parent. The tier is `REVIEW.md`'s, from the paths.

### The script

Run it from the repository root with the item lines on standard input (`id base head tier`, one per line, as in
the table). Each diff starts with a header: the tier, both commits, the commit messages, and the generated files
left out, as `REVIEW.md` says to review their source.

```bash
#!/bin/bash
# Usage: cut-review-diffs.sh <output-folder>   (item lines on stdin: id base head tier)
set -e
W=$(git rev-parse --show-toplevel)
S=$1; mkdir -p "$S"
LEFT_OUT=('extensions/ritemark/media/webview.js' 'extensions/ritemark/media/office-preview.js'
  'extensions/ritemark/media/*.mjs' '*.map' '*.png' '*.jpg' '*package-lock.json' 'docs/development/frame-baseline/**')
EXC=(); for p in "${LEFT_OUT[@]}"; do EXC+=(":(exclude)$p"); done
while read -r id base head tier; do
  [ -z "$id" ] && continue
  {
    echo "# Review item $id"
    echo "# Tier: $tier"
    echo "# Base commit (the tree before this change): $(git -C "$W" rev-parse --short=8 "$base")"
    echo "# Head commit (the tree after this change): $(git -C "$W" rev-parse --short=8 "$head")"
    echo "#"
    echo "# Commit messages in this change:"
    git -C "$W" log --format='## %h%n%B' "$base..$head" | sed 's/^/# /'
    echo "#"
    echo "# Generated or binary files changed but left out of this diff (REVIEW.md: review their source):"
    git -C "$W" diff --stat=200 "$base" "$head" -- "${LEFT_OUT[@]}" | sed 's/^/#   /'
    echo "#"
    echo "# Files in the diff:"
    git -C "$W" diff --stat=200 "$base" "$head" -- . "${EXC[@]}" | sed 's/^/#   /'
    echo
    git -C "$W" diff "$base" "$head" -- . "${EXC[@]}"
  } > "$S/$id.diff"
done
```

## Who reviewed

Five fresh-context general-purpose agents (Claude Opus 5.5), one pass each, no vote, each given a mix of items:
D01–D03; D04–D05; D06, D07, D08, D10; D09, D11, D14; D12, D13, D15. Each got this one-line task, and the brief
below:

> Read the brief at `<brief>` and follow it exactly. Your items: D01, D02, D03 (files D01.diff, D02.diff, D03.diff
> in the review-diffs folder named in the brief). Review each at the tier in its header and return all three
> reviews in one SubagentHandback call.

The scorer, who knew the outcomes, then matched the findings to the incidents (`incidents.md`, Method).

## The brief

Exact text, with its three absolute paths written as `<W>` (the repository's worktree), `<diffs>` (the folder of
`Dnn.diff` files) and the brief's own path as `<brief>` above.

````markdown
# Brief: review a set of Ritemark PR diffs, blind

You are an AI code reviewer for Ritemark Native (a VS Code OSS fork with a built-in Markdown editor extension).
Review each diff listed in your task the way the merging session would before a merge, applying the rules in
REVIEW.md at the tier given in each diff's header:

- Light: review at a low level (only a few high-confidence findings).
- Standard: medium (the usual careful review of correctness and Ritemark's failure list).
- High: high (thorough: read surrounding code, follow callers and callees, think about every platform and state).

## Rules to apply
- `<W>/REVIEW.md` (read it first).
- `<W>/CLAUDE.md` (its rules apply too).

## The diffs
Each `Dnn.diff` file in
`<diffs>/`
starts with a header: the tier, the base commit (the tree before), the head commit (the tree after), the commit
messages, and the generated or binary files that changed but were left out (REVIEW.md says: review their source).

## Reading context (allowed)
The repository is `<W>` (call it W).
- A file as it was before or after the change: `git -C W show <base>:<path>` or `git -C W show <head>:<path>`.
- Search the tree at a commit: `git -C W grep -n '<pattern>' <base or head> -- <path>`.
- Line numbers for your findings: use the head side (`git -C W show <head>:<path> | grep -n ...`, or the `@@` hunk headers).

## Not allowed (they would show you what happened later, and this review must be blind)
- Reading any file in W's working tree other than REVIEW.md and CLAUDE.md (the working tree is much newer than these diffs).
- `git log`, `git show`, `git blame` or `git diff` on any commit other than the item's own base and head.
- `gh`, GitHub, the web, `~/.claude/` memory, and anything under `docs/development/review/`.
- Editing any file, running builds or tests, or launching any app or window.

## Each review is independent
Don't assume a diff is known to be broken or known to be fine. Some may have defects; some may have none. Report
what a careful reviewer following REVIEW.md would report, and nothing you can't support from the code. "No issues
found" is a valid result.

## Output, per item
```
### Dnn (tier)
- `path/to/file.ts:123` — Important|Nit|Pre-existing — <input or state> → <wrong result>.
...
Summary: N findings (I Important, N Nit, P Pre-existing) | No issues found.
```
Keep each finding to one line, as REVIEW.md says. Put your whole report in one SubagentHandback call.
````

## When re-scoring

- Cut the diffs again with the script; the commits don't change.
- Give the reviewers this brief unchanged, so scores stay comparable. If the brief must change, say so in
  `incidents.md` beside the new score.
- Keep `docs/development/review/` out of the reviewers' reach: it holds the answers.
