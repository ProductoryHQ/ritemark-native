# Clean builds and worktree hygiene

**Status:** mandatory repository policy

**Validated:** 2026-09-02 · **Updated:** 2026-09-14 (release closeout)
**Scope:** shell-release builds and local Git worktree storage

## One rule

Git is the build recipe. A developer machine supplies compute, disk and signing
credentials only. A local patched VS Code tree, shared dependency directory, or
previous build output is never a release input.

## Shell-release source lifecycle

```text
origin/main at one exact commit
          ↓
new detached release worktree
          ↓
physical VS Code submodule at the recorded gitlink
          ↓
frozen npm installs from committed lockfiles
          ↓
canonical patches from patches/vscode
          ↓
new empty build output
          ↓
embedded provenance manifest
          ↓
signing and packaging may begin
```

Create the worktree with:

```bash
./scripts/create-release-worktree.sh
```

The command fetches `origin/main`, creates a new detached worktree, initializes
the exact `vscode` gitlink as a physical submodule, marks the worktree as
disposable release infrastructure, and runs the pristine source gate.

Inside that worktree:

```bash
./scripts/release-preflight.sh
./scripts/build-prod.sh
```

Both commands enforce the source gate themselves. `build-prod.sh` installs from
lockfiles with `npm ci`, rebuilds committed bundles, applies canonical patches,
and refuses an existing `VSCode-<target>` output. It embeds
`ritemark-build-provenance.json` in the app. Signing and DMG creation verify the
manifest again and refuse an untraceable app.

Any new source commit invalidates the candidate. Delete the old release
worktree and create a new one; never pull, rebase, or hot-copy files into an RC
worktree.

### Product source versus release harness

A "source commit" above means the commit whose *product* bytes ship. The
scripts and workflows that build, verify, sign, and package are a **harness**.
Fixing the harness after an artifact exists does not change the artifact and
does not require rebuilding it; every artifact record carries both identities
(the Windows record already writes `source_commit` and `workflow_commit`).

Artifacts that CI builds on another machine (macOS x64, Windows) are therefore
signed and packaged from a **harness worktree** — any clean checkout with an
initialized `vscode` submodule — with `RITEMARK_RELEASE_COMMIT` set to the
approved 40-character source commit. `build-provenance.mjs --release-commit`
then verifies the embedded source commit, VS Code gitlink, patch-set digest,
and lock-file digests against that commit's git objects, and requires (without
recomputing) the build machine's VS Code working-tree digest. The commit must
be on `origin/main`. Without the anchor, verification compares against this
checkout's working tree, which is correct only for the machine that ran the
build.

## Hard failures

The release source gate blocks when any of these is true:

- `HEAD` is not exactly `origin/main`;
- the checkout is neither `main` nor detached at that exact commit;
- tracked or untracked superproject files differ;
- `vscode/` is missing, a symlink, not its own Git checkout, dirty before patching,
  or at a commit different from the superproject gitlink;
- a top-level `node_modules` directory is a symlink;
- the Ritemark extension link resolves outside the same release worktree;
- the patched VS Code state differs from the fingerprint recorded by the
  canonical patch applicator (CI's same-worktree physical extension copy is an
  explicitly checked layout);
- a previous target build output exists;
- the embedded provenance differs from the current committed inputs or the
  actual derived VS Code state used for the build.

Warnings are not used for these conditions.

## Worktree retention and cleanup

Worktrees are disposable workspaces; commits and remote branches are the
retained history.

### Reporting is automatic; removal is not

```bash
node ./scripts/worktree-hygiene.mjs --report   # deletes nothing, safe any time
node ./scripts/worktree-hygiene.mjs --check    # same classification, terse
node ./scripts/worktree-hygiene.mjs --clean    # human-authorized only
```

A local scheduled task mails the `--report` output to Jarmo weekly, and the
`worktree-janitor` agent produces the same report on demand. Neither deletes
anything. `--clean` runs only after Jarmo has read a report and said so.

Nothing is ever removed automatically, because the classifier decides from
evidence that can be incomplete: it reads Git state and the filesystem, and a
worktree can hold value neither of them describes.

### What the classifier holds back, and why

The cleaner never removes the primary, current, or locked worktree, and it
preserves dirty and unreadable ones.

**Build output.** A non-empty `dist/` or `VSCode-<target>/` blocks the worktree
whatever Git says. Those directories are ignored, so `git status` reports a
release worktree holding signed, notarized DMGs as pristine. That output can
represent hours of compute and spent Apple notarization submissions, and it
exists nowhere else until it is published.

The block lifts only through the release closeout (`release` skill, Step 10;
gate in the `release-manager` agent): verify the published assets against
`dist/` (size and SHA-256 against GitHub's asset digests and the canonical
update feed), archive the local-only evidence to
`docs/releases/vX.Y.Z/evidence/`, and only then delete `dist/` and
`VSCode-<target>/` inside the worktree. The same worktree then classifies
`REVIEW — verified disposable release worktree`, and `--clean` — still
human-authorized — removes it together with its physical `vscode/` submodule.
Deleting the worktree directory by hand to get past the block is never the
answer; a worktree that stays `BLOCKED` after a closeout is a classifier bug
to report.

**Unmerged work.** An unmerged branch needs an upstream and no unpushed
commits. Once the commit is an ancestor of `origin/main` the work is
demonstrably in main, so a missing upstream is not a risk — that is simply what
a branch looks like after a merge deleted its remote.

**Squash merges.** Every PR on `main` is squash-merged, so a merged branch's
commits never become ancestors of `origin/main`. Archiving a session leaves its
worktree detached at the PR's pre-squash commit, and the ancestry check alone
held such worktrees forever. For a clean worktree with no build output, the
audit therefore asks GitHub (`gh`) about each commit ahead of `origin/main`. A
commit is proven when it is in a pull request GitHub reports as merged into
`main`, when it was such a pull request's head before a force-push replaced it
(the PR was rebased just before merging; the branch name comes from the
worktree, its upstream, or its HEAD reflog), when it is an ancestor of a commit
already proven, or when it is a merge of `origin/main` whose tree is exactly
what Git's own merge of its parents produces. One unproven commit keeps the old
verdict, and the reason names it. With `gh` offline or unauthenticated nothing
is proven and every verdict is what it was before the check existed.

**Possible hand-editing in `vscode/`.** A changed submodule is *derived state*,
not user work: `apply-patches.sh` reproduces it exactly. The audit proves this
per worktree by reading the canonical patch targets and the branding assets that
`apply-patches.sh` copies, plus the npm/gulp-regenerated directories. Every
changed path must belong to that set; one path outside it blocks the worktree,
because CLAUDE.md forbids editing the submodule directly and an unexplained
change may be someone's work. The submodule must also sit at the commit the
superproject records: a checkout moved off it may hold commits made inside
`vscode/`, which `git worktree remove` would delete with the worktree.

Treating a patched submodule as unreviewable instead of proving it derived was
why the janitor could not reclaim a single development worktree while offering
to delete the one release worktree that held irreplaceable artifacts.

Branches are always retained.

`--clean` uses `git worktree remove` with an exact path, followed by
`git worktree prune`. It does not recursively delete a guessed directory.

## Validation

The repository QA gate runs both deterministic suites:

```bash
./scripts/test-release-source-integrity.sh
./scripts/test-worktree-hygiene.sh
```

They create disposable local remotes, a real submodule, and real linked
worktrees. Tests prove both acceptance and rejection paths, including actual
safe removal. The same hygiene script must also be run in audit-only mode
against the real repository before changing cleanup policy.

The implementation follows Git's stable `worktree list --porcelain -z`
interface, uses the recorded submodule gitlink, and uses `npm ci` so lockfile
drift fails instead of rewriting dependency metadata.
