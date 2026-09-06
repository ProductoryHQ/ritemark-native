# Clean builds and worktree hygiene

**Status:** mandatory repository policy

**Validated:** 2026-09-02
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

Run the audit:

```bash
node ./scripts/worktree-hygiene.mjs --check
```

Run it at four deterministic points:

1. immediately after a PR is merged or closed;
2. at sprint close;
3. before every release-candidate worktree is created;
4. once each week for the whole repository.

After reviewing the report, remove only proven-safe entries with:

```bash
node ./scripts/worktree-hygiene.mjs --clean
```

The cleaner never removes the primary, current, or locked worktree. It also
preserves dirty, unreadable, unpushed, upstream-less, and unmerged worktrees.
Ordinary worktrees are removable only when their full commit is already an
ancestor of `origin/main`. `apply-patches.sh` records the exact derived VS Code
diff in per-worktree Git metadata; a merged development tree with a changed
submodule is removable only while that fingerprint still matches. Any later
manual VS Code edit invalidates the proof and makes the tree `BLOCKED` again.
A marked release worktree is removable when its
tracked source still matches its marker; generated submodule/build state is
then deliberately disposable. Branches are retained.

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
